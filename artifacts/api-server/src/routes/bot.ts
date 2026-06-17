import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { onUpdate } from "../lib/bot-handler";
import TelegramBotAPI from "../lib/telegram-bot-api";
import { splitEmojis, getChatIds } from "../lib/bot-helper";
import { htmlContent } from "../lib/bot-constants";

const router: IRouter = Router();

const botToken = process.env["BOT_TOKEN"] ?? "";
const botUsername = process.env["BOT_USERNAME"] ?? "";
const reactions = splitEmojis(process.env["EMOJI_LIST"]);
const restrictedChats = getChatIds(process.env["RESTRICTED_CHATS"]);
const randomLevel = parseInt(process.env["RANDOM_LEVEL"] ?? "0", 10);

const botApi = new TelegramBotAPI(botToken);

router.post("/webhook", async (req, res) => {
  const data = req.body;
  try {
    await onUpdate(data, botApi, reactions, restrictedChats, botUsername, randomLevel);
    res.status(200).send("Ok");
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ err }, "Error in onUpdate");
    res.status(200).send("Ok");
  }
});

router.get("/", (_req, res) => {
  res.send(htmlContent);
});

export default router;
