import app from "./app";
import { logger } from "./lib/logger";
import { startPolling } from "./lib/bot-poller";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start Telegram long-poll loop in the background (non-blocking)
  startPolling().catch((err) => {
    logger.error({ err }, "Polling loop crashed unexpectedly");
  });
});
