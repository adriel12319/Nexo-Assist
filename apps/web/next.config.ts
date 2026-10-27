import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// O .env fica na raiz do monorepo, compartilhado com o serviço de chamados.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

const config: NextConfig = {
  transpilePackages: ["@nexo/agent", "@nexo/shared", "@nexo/tickets"],
  serverExternalPackages: ["@mastra/core", "@libsql/client"],
};

export default config;
