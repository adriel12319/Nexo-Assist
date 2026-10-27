import { serve } from "@hono/node-server";
import { createService } from "./bootstrap";

const port = Number(process.env.TICKETS_PORT ?? 4001);

serve({ fetch: createService().fetch, port }, () => console.log(`Tickets service listening on http://localhost:${port}`));
