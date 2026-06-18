import { createServer } from "http";
import { logger } from "./logger";
import { startPolling } from "./poller";

const port = Number(process.env["PORT"]);
if (!port) throw new Error("PORT env var is required");

createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
}).listen(port, () => {
  logger.info({ port }, "Bot running");
  startPolling().catch((err) => logger.error({ err }, "Polling loop crashed"));
});
