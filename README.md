# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário conversa num chat. O agent busca na central de ajuda, consulta e prepara chamados e chama um analista quando precisa. O analista atende as conversas transferidas num console.

## Como rodar

Requisitos: Node 22+ e pnpm.

```bash
pnpm install
cp .env.example .env        # preencha GOOGLE_GENERATIVE_AI_API_KEY e SESSION_SECRET
pnpm db:seed                # cria data/tickets.db e data/app.db com dados de exemplo
pnpm dev                    # serviço de chamados em :4001 e app em :3000
```

A chave do Gemini é gratuita e pode ser criada em <https://aistudio.google.com/apikey>.

Abra <http://localhost:3000>. Qualquer senha funciona para as contas de exemplo:

| Conta | Papel | Para testar |
| --- | --- | --- |
| `ana.souza@nexo.com.br` | Funcionária | Tem um chamado vencido (INC-20311), um resolvido há 4 dias (INC-20150) e outros abertos |
| `bruno.tavares@nexo.com.br` | Funcionário | Dono do INC-20402, útil para testar privacidade |
| `rafael.lima@nexo.com.br` | Analista | Console com duas conversas já transferidas |

Outros comandos:

```bash
pnpm test        # testes unitários e de integração (não chamam o LLM)
pnpm eval        # cenários de conversa contra o Gemini de verdade
pnpm typecheck
```

## Arquitetura

```
apps/web            Next.js: telas, rotas de API, sessão, persistência das conversas
packages/agent      Agent Mastra: instruções, ferramentas, trace de cada turno
packages/shared     Domínio: categorias, prioridade, SLA em horas úteis, tipos
services/tickets    Serviço de chamados simulado (Hono + SQLite), processo separado
```

```
navegador ──SSE──▶ apps/web ──▶ packages/agent ──▶ Gemini
                      │                │
                      │                └──HTTP──▶ services/tickets ──▶ tickets.db
                      └──▶ app.db (conversas, mensagens, rascunhos, estado)
```

- **O serviço de chamados é outro processo** e só fala HTTP. Ele simula o sistema legado: tem latência variável e responde 503 em 10% das chamadas (`TICKETS_FAILURE_RATE`). O client (`services/tickets/src/client.ts`) repete leituras com backoff exponencial. As escritas levam uma chave de idempotência (`idempotency-key`, que é a conversa mais o id do rascunho). O serviço reserva a chave antes de gravar e devolve a resposta original numa repetição. Assim, timeout, resposta perdida ou nova tentativa do funcionário nunca criam um segundo chamado. Sem chave, uma escrita só é repetida quando o serviço recusou com 503.
- **O agent não conhece banco nem HTTP.** Ele recebe um `AgentContext` com o usuário, o client de chamados e uma `ConversationPort` (salvar rascunho, pedir transferência), que o app web implementa. Por isso dá para testar as ferramentas com dublês e rodar os evals com o serviço em memória.
- **Persistência:** os dois bancos são SQLite via libsql. Conversas, mensagens (com cards e trace), rascunhos e o estado de cada conversa (`agent`, `waiting_analyst`, `with_analyst`, `closed`) sobrevivem a um reinício. Em produção, as mesmas URLs aceitam `libsql://` do Turso.
- **Tempo real:** a resposta do agent chega por SSE, com passos, texto e cards conforme acontecem. Quando a conversa está com um analista, o chat e o console fazem polling a cada 3 a 4 s. É simples, e para esse volume não justifica WebSocket.

## Como o agent decide

O modelo decide **o que fazer**. As regras do service desk ficam **no código**, onde dá para testar:

| Regra (Anexo A) | Onde é garantida |
| --- | --- |
| Confirmação antes de criar ou atualizar | O agent não tem ferramenta de escrita. `draftNewTicket` e `draftTicketUpdate` só salvam um rascunho. Quem cria o chamado é `POST /api/drafts/:id/confirm`, chamado pelo botão do funcionário. Um rascunho novo cancela os pendentes, e a confirmação é atômica, então um duplo clique não abre dois chamados. |
| Prioridade e prazo | `classifyPriority` e `dueDate` em `packages/shared/src/sla.ts`. O modelo informa os fatos (impacto, se impede o trabalho, se há compromisso hoje) e o código aplica a tabela e calcula o prazo em horas úteis (8h às 18h, seg a sex; crítico corre 24h). |
| Sem duplicidade | `draftNewTicket` consulta `/tickets/similar` antes de salvar. Se existe chamado aberto da mesma categoria sobre o mesmo assunto, devolve `duplicate: true` e orienta a atualizar. Se o chamado foi resolvido há até 7 dias, orienta a reabrir. A similaridade considera tanto a cobertura da consulta quanto a do título do chamado existente, para que descrições longas não diluam a semelhança. Se o funcionário diz que é outro problema, o agent repete a chamada com `notSameAs`. |
| Agravamento | Em atualização ou reabertura, `raisePriority` reclassifica pela mesma tabela. A prioridade só sobe, nunca desce. Se vira crítico, a confirmação transfere a conversa para um analista. |
| Privacidade | O `userId` vem da sessão e é fechado no contexto das ferramentas, nunca é parâmetro do modelo. O serviço filtra tudo por `x-requester-id` e responde 404 tanto para "não existe" quanto para "é de outra pessoa". |
| Transferência | Ferramenta `transferToAnalyst` (pedido, vencido, baixa confiança) com resumo e nível de confiança. Chamado crítico confirmado é transferido pelo código, sem depender do modelo. Com a conversa fora do estado `agent`, a rota de chat grava a mensagem e não chama o LLM. |
| Escopo de TI | Instrução do sistema. É a única regra que depende só do prompt, e há eval para ela. |

Ferramentas: `registerDecision` (intenção, confiança e motivo, em toda resposta), `searchHelpCenter`, `listMyTickets` (com seletor), `getTicket`, `draftNewTicket`, `draftTicketUpdate`, `offerOptions` (respostas rápidas) e `transferToAnalyst`.

### Transparência

Cada ferramenta registra passos legíveis num `TurnRecorder` ("consultou seus chamados", "classificou a prioridade: Alta, há um compromisso em risco hoje"). Os passos vão ao vivo para a tela e ficam salvos com a mensagem. Acima de cada resposta aparecem os passos. Cada resposta também traz a decisão registrada pelo agent: o que ele entendeu, a confiança (o selo fica amarelo abaixo de 60%) e o motivo. O link **por quê?** abre o trace completo: decisão, detalhes de cada passo, duração, modelo e tokens. No console, o analista vê o mesmo trace expansível em cada mensagem do agent, além do resumo da transferência.

O histórico enviado ao modelo inclui o que os cards mostraram (rascunho com prioridade e prazo, chamado com status e prazo). Assim o agent repete as datas que o funcionário viu em vez de calculá-las.

## Como garanti a qualidade das decisões

- **Testes (`pnpm test`, 42 casos):**
  - cálculo de SLA com virada de dia, fim de semana e plantão, e a matriz de prioridade;
  - serviço de chamados: privacidade, deduplicação inclusive com descrição longa, janela de reabertura, IDs e replay idempotente;
  - retry do client: repete leituras, repete escrita só com chave de idempotência;
  - histórico do modelo com dados dos cards;
  - ferramentas do agent com dublês: prioridade calculada no código, recusa de duplicata e `notSameAs`, prioridade que só sobe, reabertura que vira crítica, queda do serviço vira mensagem explicável.
- **Regras do console e da confirmação:** só quem assumiu a conversa pode devolver ou encerrar. Rascunho de conversa encerrada não pode ser confirmado, e encerrar cancela os pendentes.
- **Evals (`pnpm eval`):** 13 cenários rodam o agent real contra o serviço de chamados em memória e verificam o comportamento, não o texto exato: busca o artigo e respeita a condição do Windows 10, não vaza chamado de outra pessoa (inclusive com prompt injection), redireciona assunto de RH, não duplica, oferece reabrir, pergunta antes de montar rascunho, prioridade alta com reunião hoje, crítico vai para analista. O relatório mostra as ferramentas usadas e o custo estimado por turno. Para rodar um cenário só: `pnpm eval "vencido"`.

## Modelo e custo

**Gemini 3.5 Flash-Lite** (`GEMINI_MODEL` permite trocar). Medi os limites do tier gratuito com a mesma chave (outubro/2026):

| Modelo | RPM no tier gratuito | Observação |
| --- | --- | --- |
| `gemini-3.5-flash-lite` | 15 | Estável, ~1 s até a primeira resposta, 13/13 no eval |
| `gemini-2.5-flash` | 5 | Acesso restrito a projetos antigos; 429 frequente no eval |
| `gemini-3.6-flash` | 5 | |
| `gemini-3.8-flash` | n/d | Respondeu "high demand" no tier gratuito durante o teste |

Os motivos da escolha:

- tem o maior RPM gratuito, então quem avaliar consegue testar sem esbarrar no limite;
- é o modelo que o Google recomenda para projetos novos;
- passou todos os cenários do eval.

Como as regras ficam no código, o agent não precisa de um modelo maior. Com uma chave paga, `GEMINI_MODEL=gemini-3.8-flash` é a troca natural.

Para controlar o custo de cada conversa:

- o histórico enviado ao modelo é limitado às últimas 20 mensagens;
- cada turno tem no máximo 6 passos de ferramenta;
- as ferramentas devolvem resumos, não objetos completos;
- os cards mostram os detalhes na tela, então o modelo não precisa repetir campos;
- cada conversa tem limite de 30 mensagens;
- há rate limit de 12 mensagens por minuto por usuário.

No último eval, o custo medido foi de ~US$ 0,0005 por turno no preço pago, já que a maior parte são tokens de entrada (instruções e resultados das ferramentas). Os tokens e o custo aparecem no relatório do `pnpm eval`. Por causa do limite gratuito, o eval espera 8 s entre cenários (`EVAL_PAUSE_MS`) e repete uma vez se receber 429.

## Trade-offs

- **Login de demonstração:** qualquer senha vale para os e-mails cadastrados. A sessão é um cookie HMAC assinado, httpOnly e com expiração. Num ambiente real, seria SSO corporativo (Entra ID).
- **Similaridade por palavras-chave**, não embeddings. Com 8 artigos e poucos chamados por pessoa, isso resolve, é determinístico e testável. A troca está isolada em `services/tickets/src/text.ts`.
- **Polling no console** em vez de WebSocket ou pub/sub. É mais simples, e o custo cresce linearmente com o número de analistas, o que é aceitável aqui.
- **Rate limit em memória:** funciona numa instância só. Com várias réplicas, iria para Redis.
- **Migrações com `CREATE TABLE IF NOT EXISTS`** em vez de drizzle-kit, para rodar com zero passos. Com o esquema evoluindo, usaria migrações versionadas.
- **SLA:** uso o prazo da prioridade a partir da última atualização como "próxima resposta". O sistema real teria eventos de primeira resposta separados.

## O que faria com mais tempo

- Rodar os evals no CI com mais cenários de várias mensagens, guardar o histórico de resultados por versão de prompt e ligar o tracing do Mastra a um painel de observabilidade.
- Notificar o analista por push e mostrar ao funcionário a posição na fila.
- Fazer a busca da central com embeddings e reranking, e feedback 👍/👎 por resposta para alimentar os evals.
- Fazer a transferência por fila (N1/N2) e roteamento por categoria.
- Fazer testes end-to-end das telas com Playwright.

## Deploy na Vercel

O repositório sobe como **um projeto Vercel com dois [Services](https://vercel.com/docs/services)** (`vercel.json`):

| Service | Pasta | Acesso |
| --- | --- | --- |
| `web` | `apps/web` (Next.js) | Público: recebe todo o tráfego |
| `tickets` | `services/tickets` (Hono, entrada `src/index.ts`) | **Privado**: sem rota pública, só o `web` chama, via binding |

Por que Services e não dois projetos:

- frontend e serviço de chamados sobem juntos, com o mesmo preview e o mesmo rollback;
- o serviço de chamados não fica exposto na internet;
- o binding injeta `TICKETS_SERVICE_URL` no `web` sem URL fixa no código;
- o token de serviço continua sendo exigido como segunda camada.

**Banco:** os dois services usam o mesmo banco Turso (SQLite gerenciado), cada um com suas tabelas. O código lê `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`, que a integração do Marketplace injeta. As tabelas são criadas na primeira requisição. O serviço de chamados popula artigos e chamados de exemplo quando o banco está vazio.

### Passo a passo

```bash
npm i -g vercel
vercel login
vercel link                                  # cria/vincula o projeto
vercel integration add turso --yes           # provisiona o banco e injeta TURSO_*
vercel env add GOOGLE_GENERATIVE_AI_API_KEY  # chave do Gemini
vercel env add GEMINI_MODEL                  # gemini-3.5-flash-lite
vercel env add SESSION_SECRET                # openssl rand -hex 32
vercel env add TICKETS_SERVICE_TOKEN         # outro valor aleatório
vercel env add ENABLE_EXPERIMENTAL_COREPACK  # 1 (para a Vercel usar o pnpm do packageManager)
vercel deploy --prod
```

Para ter as conversas de exemplo no console, rode o seed do web uma vez contra o Turso:

```bash
vercel env pull .env.production.local
pnpm --filter @nexo/web exec tsx --env-file=../../.env.production.local src/server/db/seed.ts
```

### Proteção de chaves e custo

- **Chaves:** ficam só nas variáveis de ambiente da Vercel e são usadas no servidor. O navegador nunca vê a chave do Gemini, o token de serviço nem o segredo de sessão.
- **Falha cedo:** em produção, o app não sobe sem `SESSION_SECRET` e `TICKETS_SERVICE_TOKEN`. Não existe valor padrão inseguro.
- **Limites de uso:** 30 mensagens por conversa, 12 mensagens por minuto por usuário, no máximo 6 passos de ferramenta por turno e histórico limitado a 20 mensagens. Como o limitador é em memória, ele vale por instância. Para uma camada global, adicione uma regra de rate limit no Vercel Firewall para `/api/chat`.
- **Teto de gasto:** com a chave no tier gratuito do Gemini, o custo é zero e o próprio Google limita a 15 RPM. Com chave paga, configure um teto de gasto no Google AI Studio.
