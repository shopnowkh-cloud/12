import { createServer } from "http";
import pino from "pino";

// ─── Logger ──────────────────────────────────────────────────────────────────

const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

// ─── Reactions list ───────────────────────────────────────────────────────────

const ALL_REACTIONS = [
  "👍","👎","❤️","🔥","🥰","👏","😁","🤔","🤯","😱",
  "🤬","😢","🎉","🤩","🤮","💩","🙏","👌","🕊","🤡",
  "🥱","🥴","😍","🐳","❤️‍🔥","🌚","🌭","💯","🤣","⚡",
  "🍌","🏆","💔","🤨","😐","🍓","🍾","💋","🖕","😈",
  "😴","😭","🤓","👻","👨‍💻","👀","🎃","🙈","😇","😨",
  "🤝","✍️","🤗","🫡","🎅","🎄","☃️","💅","🤪","🗿",
  "🆒","💘","🙉","🦄","😘","💊","🙊","😎","👾","🤷","😡",
];

// ─── Bot messages ─────────────────────────────────────────────────────────────

const START_MSG = `👋 Hello there, UserName !

Welcome to the *Auto Emoji Reaction Bot 🎉*, ready to sprinkle your conversations with a little extra happiness!

💁‍♂️ Here's how I spice up your chats:

*✨ DM Magic*: Message me and receive a surprise emoji in return. Expect the unexpected and enjoy the fun!
*🏖 Group & Channel*: Add me to your groups or channels, and I'll keep the vibe positive by reacting to messages with engaging emojis.

✍️ To view the emojis I can use, simply type /reactions.

Let's elevate our conversations with more energy and color! 🚀`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomReaction(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

function parseEmojis(str?: string): string[] {
  if (!str) return [];
  return str.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji_Modifier_Base})/gu) ?? [];
}

function parseChatIds(str?: string): number[] {
  return str ? str.split(",").map(Number).filter(Boolean) : [];
}

// ─── Telegram API ─────────────────────────────────────────────────────────────

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
}
interface TgMessage {
  chat: { id: number; type: string; title?: string };
  from?: { id: number; first_name: string };
  message_id: number;
  text?: string;
}
interface TgResult<T> { ok: boolean; result: T; description?: string }

async function tg(token: string, action: string, body: Record<string, unknown>): Promise<unknown> {
  const isLongPoll = action === "getUpdates";
  const pollSec = (body["timeout"] as number ?? 30);
  const signal = AbortSignal.timeout(isLongPoll ? (pollSec + 5) * 1000 : 10_000);
  const res = await fetch(`https://api.telegram.org/bot${token}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json() as TgResult<unknown>;
  if (!data.ok) throw new Error(`Telegram ${action}: ${data.description ?? "unknown"}`);
  return data.result;
}

async function getUpdates(token: string, offset: number, timeout: number): Promise<TgUpdate[]> {
  return tg(token, "getUpdates", {
    offset, timeout,
    allowed_updates: ["message", "channel_post"],
  }) as Promise<TgUpdate[]>;
}

async function sendMessage(token: string, chatId: number, text: string, keyboard?: unknown[][]): Promise<void> {
  await tg(token, "sendMessage", {
    chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true,
    ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }),
  });
}

async function setReaction(token: string, chatId: number, messageId: number, emoji: string): Promise<void> {
  await tg(token, "setMessageReaction", {
    chat_id: chatId, message_id: messageId,
    reaction: [{ type: "emoji", emoji }], is_big: true,
  });
}


// ─── Update handler ───────────────────────────────────────────────────────────

async function handleUpdate(
  update: TgUpdate, token: string, reactions: string[],
  restrictedChats: number[], botUsername: string, randomLevel: number,
): Promise<void> {
  const content = update.message ?? update.channel_post;

  if (content) {
    const { chat, message_id, text, from } = content;

    if (update.message && (text === "/start" || text === `/start@${botUsername}`)) {
      const name = chat.type === "private" ? (from?.first_name ?? "User") : (chat.title ?? "Group");
      await sendMessage(token, chat.id, START_MSG.replace("UserName", name), [
        [
          { text: "➕ Add to Channel ➕", url: `https://t.me/${botUsername}?startchannel=botstart` },
          { text: "➕ Add to Group ➕", url: `https://t.me/${botUsername}?startgroup=botstart` },
        ],
      ]);
    } else if (update.message && text === "/reactions") {
      await sendMessage(token, chat.id, "✅ Enabled Reactions:\n\n" + reactions.join(" "));
    } else if (!restrictedChats.includes(chat.id)) {
      const isGroup = ["group", "supergroup"].includes(chat.type);
      const threshold = 1 - randomLevel / 10;
      if (!isGroup || Math.random() <= threshold) {
        await setReaction(token, chat.id, message_id, randomReaction(reactions));
      }
    }
  }
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

async function startPolling(): Promise<void> {
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

// ─── Minimal HTTP server (keeps Replit port alive) ────────────────────────────

const port = Number(process.env["PORT"]);
if (!port) throw new Error("PORT env var is required");

createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
}).listen(port, () => {
  logger.info({ port }, "Bot running");
  startPolling().catch((err) => logger.error({ err }, "Polling loop crashed"));
});
