import { logger } from "./logger";
import TelegramBotAPI from "./telegram-bot-api";
import { onUpdate } from "./bot-handler";
import { splitEmojis, getChatIds } from "./bot-helper";

const POLL_TIMEOUT = 30; // seconds — Telegram long-poll window
const RETRY_DELAY = 5000; // ms to wait after an error before retrying

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startPolling(): Promise<void> {
  const botToken = process.env["BOT_TOKEN"];
  const botUsername = process.env["BOT_USERNAME"];

  if (!botToken || !botUsername) {
    logger.warn("BOT_TOKEN or BOT_USERNAME not set — polling disabled");
    return;
  }

  const reactions = splitEmojis(process.env["EMOJI_LIST"]);
  const restrictedChats = getChatIds(process.env["RESTRICTED_CHATS"]);
  const randomLevel = parseInt(process.env["RANDOM_LEVEL"] ?? "0", 10);

  const botApi = new TelegramBotAPI(botToken);

  // Delete any existing webhook so Telegram sends updates to getUpdates instead
  try {
    await botApi.deleteWebhook();
    logger.info("Webhook cleared — starting long-poll loop");
  } catch (err) {
    logger.warn({ err }, "Could not delete webhook — continuing anyway");
  }

  let offset = 0;

  // Run forever in the background
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = await botApi.getUpdates(offset, POLL_TIMEOUT);

      for (const update of updates) {
        // Advance offset past this update so we never re-process it
        offset = update.update_id + 1;

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await onUpdate(update as any, botApi, reactions, restrictedChats, botUsername, randomLevel);
        } catch (err) {
          logger.error({ err, update_id: update.update_id }, "Error processing update");
        }
      }
    } catch (err) {
      logger.warn({ err }, "getUpdates error — retrying in 5 s");
      await sleep(RETRY_DELAY);
    }
  }
}
