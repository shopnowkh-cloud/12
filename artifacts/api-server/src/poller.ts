import { logger } from "./logger";
import { ALL_REACTIONS } from "./constants";
import { parseEmojis, parseChatIds } from "./helpers";
import { tg, getUpdates } from "./telegram";
import { handleUpdate } from "./handler";

export async function startPolling(): Promise<void> {
  const token = process.env["BOT_TOKEN"];
  const username = process.env["BOT_USERNAME"];
  if (!token || !username) {
    logger.warn("BOT_TOKEN or BOT_USERNAME not set — polling disabled");
    return;
  }

  const configured = parseEmojis(process.env["EMOJI_LIST"]);
  const reactions = configured.length > 0 ? configured : ALL_REACTIONS;
  const restrictedChats = parseChatIds(process.env["RESTRICTED_CHATS"]);
  const randomLevel = parseInt(process.env["RANDOM_LEVEL"] ?? "0", 10);

  try {
    await tg(token, "deleteWebhook", { drop_pending_updates: false });
    logger.info("Webhook cleared — bot polling started");
  } catch (err) {
    logger.warn({ err }, "Could not delete webhook — continuing anyway");
  }

  let offset = 0;
  while (true) {
    try {
      const updates = await getUpdates(token, offset, 30);
      for (const update of updates) {
        offset = update.update_id + 1;
        handleUpdate(update, token, reactions, restrictedChats, username, randomLevel).catch((err) =>
          logger.error({ err, update_id: update.update_id }, "Error processing update"),
        );
      }
    } catch (err) {
      logger.warn({ err }, "getUpdates error — retrying in 5 s");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
