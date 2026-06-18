import { createServer } from "http";
import pino from "pino";

// ── Logger ────────────────────────────────────────────────────────────────────

const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

// ── Config ────────────────────────────────────────────────────────────────────

const ALL_REACTIONS = [
  "👍","👎","❤️","🔥","🥰","👏","😁","🤔","🤯","😱","🤬","😢","🎉","🤩","🤮",
  "💩","🙏","👌","🕊","🤡","🥱","🥴","😍","🐳","❤️‍🔥","🌚","🌭","💯","🤣","⚡",
  "🍌","🏆","💔","🤨","😐","🍓","🍾","💋","🖕","😈","😴","😭","🤓","👻","👨‍💻",
  "👀","🎃","🙈","😇","😨","🤝","✍️","🤗","🫡","🎅","🎄","☃️","💅","🤪","🗿",
  "🆒","💘","🙉","🦄","😘","💊","🙊","😎","👾","🤷","😡",
];

const START_MSG = `👋 Hello there, UserName !

Welcome to the *Auto Emoji Reaction Bot 🎉*, ready to sprinkle your conversations with a little extra happiness!

💁‍♂️ Here's how I spice up your chats:

*✨ DM Magic*: Message me and receive a surprise emoji in return!
*🏖 Group & Channel*: Add me to your groups or channels, and I'll keep the vibe positive by reacting to messages with engaging emojis.

✍️ To view the emojis I can use, simply type /reactions.

Let's elevate our conversations with more energy and color! 🚀`;

const DONATE_MSG = `🙏 Support Auto Reaction Bot ✨ and help us stay online! Your donations keep our services live. Every star makes a difference! Thank you! 🌟🚀`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
  pre_checkout_query?: { id: string; from: { id: number } };
}

interface TgMessage {
  chat: { id: number; type: string; title?: string };
  from?: { id: number; first_name: string };
  message_id: number;
  text?: string;
}

interface TgResult<T> { ok: boolean; result: T; description?: string }

// ── Telegram API ──────────────────────────────────────────────────────────────

async function tg(token: string, action: string, body: Record<string, unknown>): Promise<unknown> {
  const pollTimeout = ((body["timeout"] as number) ?? 30) + 5;
  const signal = AbortSignal.timeout(action === "getUpdates" ? pollTimeout * 1000 : 10_000);
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

const getUpdates = (token: string, offset: number, timeout: number) =>
  tg(token, "getUpdates", {
    offset, timeout,
    allowed_updates: ["message", "channel_post", "pre_checkout_query"],
  }) as Promise<TgUpdate[]>;

const sendMessage = (token: string, chatId: number, text: string, keyboard?: unknown[][]) =>
  tg(token, "sendMessage", {
    chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true,
    ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }),
  });

const setReaction = (token: string, chatId: number, messageId: number, emoji: string) =>
  tg(token, "setMessageReaction", {
    chat_id: chatId, message_id: messageId,
    reaction: [{ type: "emoji", emoji }], is_big: true,
  });

const sendInvoice = (token: string, chatId: number) =>
  tg(token, "sendInvoice", {
    chat_id: chatId, title: "Donate to Auto Reaction Bot ✨",
    description: DONATE_MSG, payload: "{}", provider_token: "",
    start_parameter: "donate", currency: "XTR",
    prices: [{ label: "Pay ⭐️5", amount: 5 }],
  });

const answerCheckout = (token: string, queryId: string) =>
  tg(token, "answerPreCheckoutQuery", { pre_checkout_query_id: queryId, ok: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

const randomItem = (list: string[]) => list[Math.floor(Math.random() * list.length)];

const parseEmojis = (str?: string) =>
  str?.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji_Modifier_Base})/gu) ?? [];

const parseChatIds = (str?: string): number[] =>
  str ? str.split(",").map(Number).filter(Boolean) : [];

// ── Update handler ────────────────────────────────────────────────────────────

async function handleUpdate(
  update: TgUpdate, token: string, reactions: string[],
  restricted: number[], botUsername: string, randomLevel: number,
): Promise<void> {
  const content = update.message ?? update.channel_post;

  if (content) {
    const { chat, message_id, text, from } = content;

    if (update.message && (text === "/start" || text === `/start@${botUsername}`)) {
      const name = chat.type === "private" ? (from?.first_name ?? "User") : (chat.title ?? "Group");
      await sendMessage(token, chat.id, START_MSG.replace("UserName", name), [
        [
          { text: "➕ Add to Channel", url: `https://t.me/${botUsername}?startchannel=botstart` },
          { text: "➕ Add to Group",   url: `https://t.me/${botUsername}?startgroup=botstart`  },
        ],
        [{ text: "💝 Support Us - Donate 🤝", url: `https://t.me/${botUsername}?start=donate` }],
      ]);
    } else if (update.message && text === "/reactions") {
      await sendMessage(token, chat.id, "✅ Enabled Reactions:\n\n" + reactions.join(" "));
    } else if (update.message && (text === "/donate" || text === "/start donate")) {
      await sendInvoice(token, chat.id);
    } else if (!restricted.includes(chat.id)) {
      const isGroup = ["group", "supergroup"].includes(chat.type);
      if (!isGroup || Math.random() <= 1 - randomLevel / 10) {
        await setReaction(token, chat.id, message_id, randomItem(reactions));
      }
    }
  } else if (update.pre_checkout_query) {
    await answerCheckout(token, update.pre_checkout_query.id);
    await sendMessage(token, update.pre_checkout_query.from.id, "Thank you for your donation! 💝");
  }
}

// ── Polling loop ──────────────────────────────────────────────────────────────

async function startPolling(): Promise<void> {
  const token    = process.env["BOT_TOKEN"];
  const username = process.env["BOT_USERNAME"];
  if (!token || !username) {
    logger.warn("BOT_TOKEN or BOT_USERNAME not set — polling disabled");
    return;
  }

  const configured  = parseEmojis(process.env["EMOJI_LIST"]);
  const reactions   = configured.length > 0 ? configured : ALL_REACTIONS;
  const restricted  = parseChatIds(process.env["RESTRICTED_CHATS"]);
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
        handleUpdate(update, token, reactions, restricted, username, randomLevel)
          .catch((err) => logger.error({ err, update_id: update.update_id }, "Error processing update"));
      }
    } catch (err) {
      logger.warn({ err }, "getUpdates error — retrying in 5 s");
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

const port = Number(process.env["PORT"]);
if (!port) throw new Error("PORT env var is required");

createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end('{"status":"ok"}');
}).listen(port, () => {
  logger.info({ port }, "Bot running");
  startPolling().catch((err) => logger.error({ err }, "Polling loop crashed"));
});
