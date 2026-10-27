import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { databaseConfig } from "./config";
import { migrate } from "./migrate";
import { conversations, drafts, messages } from "./schema";

const client = createClient(databaseConfig());
const db = drizzle(client);
await migrate(client);

await db.delete(messages);
await db.delete(drafts);
await db.delete(conversations);

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

type SeedMessage = [role: "user" | "agent" | "system", content: string, minutesAgo: number];

async function seedConversation(
  id: string,
  conversation: Omit<typeof conversations.$inferInsert, "id" | "createdAt" | "updatedAt" | "userMessageCount">,
  lines: SeedMessage[],
) {
  const first = lines[0]?.[2] ?? 0;
  const last = lines.at(-1)?.[2] ?? 0;
  await db.insert(conversations).values({
    id,
    ...conversation,
    userMessageCount: lines.filter(([role]) => role === "user").length,
    createdAt: minutesAgo(first),
    updatedAt: minutesAgo(last),
  });
  await db.insert(messages).values(
    lines.map(([role, content, ago], index) => ({
      id: `${id}-m${index}`,
      conversationId: id,
      role,
      authorName: role === "agent" ? "Nexo Assist" : null,
      content,
      cards: [],
      createdAt: minutesAgo(ago),
    })),
  );
}

await seedConversation(
  "c-carla",
  {
    userId: "u-carla",
    status: "waiting_analyst",
    transfer: {
      reason: "critico",
      summary:
        "Carla precisa de acesso de consulta ao SAP FI hoje para conferir pagamentos que vencem amanhã. A requisição REQ-10460 está aberta há 6 horas, ainda sem analista. Ela pediu prioridade.",
      confidence: 0.7,
      ticketId: "REQ-10460",
      at: minutesAgo(8),
    },
  },
  [
    ["user", "Preciso de acesso ao SAP ainda hoje, tenho pagamentos para conferir.", 12],
    ["agent", "Sua requisição REQ-10460 está aberta há 6 horas e ainda não tem analista. Quer que eu chame alguém agora?", 11],
    ["user", "Sim, por favor.", 9],
    ["agent", "Encaminhei para o Suporte N1. Um analista vai falar com você em instantes.", 8],
    ["system", "Transferida para o service desk", 8],
  ],
);

await seedConversation(
  "c-bruno",
  {
    userId: "u-bruno",
    status: "waiting_analyst",
    transfer: {
      reason: "baixa_confianca",
      summary:
        "Bruno relata que a VPN cai a cada 10 minutos (INC-20402, em andamento) e agora o Teams também desconecta no escritório. Não está claro se é o mesmo problema ou um problema de rede local.",
      confidence: 0.41,
      ticketId: "INC-20402",
      at: minutesAgo(20),
    },
  },
  [
    ["user", "Além da VPN, agora o Teams cai até aqui no escritório.", 23],
    ["agent", "Não tenho certeza se é o mesmo problema do INC-20402. Vou chamar um analista para isso.", 20],
    ["system", "Transferida para o service desk", 20],
  ],
);

await seedConversation("c-diego", { userId: "u-diego", status: "closed" }, [
  ["user", "Qual a senha do Wi-Fi para visitante?", 70],
  ["agent", "A senha da rede Nexo-Visitantes muda toda segunda e fica na recepção de cada andar e na intranet, em Facilities > Wi-Fi.", 69],
  ["user", "Isso resolveu, obrigado!", 65],
]);

console.log("Seeded demo conversations.");
client.close();
