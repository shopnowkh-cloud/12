import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";

// ─── Logger ──────────────────────────────────────────────────────────────────

const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_REACTIONS = [
  "👍","👎","❤️","🔥","🥰","👏","😁","🤔","🤯","😱",
  "🤬","😢","🎉","🤩","🤮","💩","🙏","👌","🕊","🤡",
  "🥱","🥴","😍","🐳","❤️‍🔥","🌚","🌭","💯","🤣","⚡",
  "🍌","🏆","💔","🤨","😐","🍓","🍾","💋","🖕","😈",
  "😴","😭","🤓","👻","👨‍💻","👀","🎃","🙈","😇","😨",
  "🤝","✍️","🤗","🫡","🎅","🎄","☃️","💅","🤪","🗿",
  "🆒","💘","🙉","🦄","😘","💊","🙊","😎","👾","🤷","😡",
];

const START_MSG = `👋 Hello there, UserName !

Welcome to the *Auto Emoji Reaction Bot 🎉*, ready to sprinkle your conversations with a little extra happiness!

💁‍♂️ Here's how I spice up your chats:

*✨ DM Magic*: Message me and receive a surprise emoji in return. Expect the unexpected and enjoy the fun!
*🏖 Group & Channel*: Add me to your groups or channels, and I'll keep the vibe positive by reacting to messages with engaging emojis.

✍️ To view the emojis I can use, simply type /reactions.

Let's elevate our conversations with more energy and color! 🚀`;

const DONATE_MSG = `🙏 Support Auto Reaction Bot ✨ and help us stay online! Your donations keep our services live. Every star makes a difference! Thank you! 🌟🚀`;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Telegram Auto Reaction Bot</title>
<script async defer src="https://buttons.github.io/buttons.js"></script>
<style>
  body,html{height:100%;margin:0;display:flex;justify-content:center;align-items:center;flex-direction:column;font-family:Arial,sans-serif}
  .logo{width:60%;margin-bottom:20px}
  .title{margin-bottom:20px;font-size:34px;font-weight:bold;color:#333;text-align:center}
  .btn{padding:10px 20px;margin:10px;font-size:16px;cursor:pointer;color:#fff;border:none;border-radius:15px;background:#0881FD;display:inline-block}
  .btn:hover{background:#0672E0}
</style>
</head>
<body>
<div class="title">Telegram Auto Reaction Bot 🎉</div>
<img class="logo" src="https://telegra.ph/file/cb59967120c6bda64580b.jpg" alt="Logo">
<button class="btn" onclick="window.location='https://github.com/Malith-Rukshan/Auto-Reaction-Bot'">Open Source 🌱</button>
<div style="margin:5px">
  <a class="github-button" href="https://github.com/Malith-Rukshan/Auto-Reaction-Bot" data-size="large" data-show-count="true">Star</a>
  <a class="github-button" href="https://github.com/Malith-Rukshan/Auto-Reaction-Bot/fork" data-size="large" data-show-count="true">Fork</a>
</div>
</body>
</html>`;

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
  pre_checkout_query?: { id: string; from: { id: number } };
}
interface TgMessage {
  chat: { id: number; type: string; title?: string };
  from?: { id: number; first_name: string };
  message_id: number;
  text?: string;
}
interface TgApiResult<T> { ok: boolean; result: T; description?: string }

async function tgCall(token: string, action: string, body: Record<string, unknown>): Promise<unknown> {
  const url = `https://api.telegram.org/bot${token}/${action}`;
  const timeout = action === "getUpdates" ? (((body["timeout"] as number) ?? 30) + 5) * 1000 : 10_000;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await res.json() as TgApiResult<unknown>;
  if (!data.ok) throw new Error(`Telegram ${action} error: ${data.description ?? "unknown"}`);
  return data.result;
}

async function getUpdates(token: string, offset: number, pollTimeout: number): Promise<TgUpdate[]> {
  return tgCall(token, "getUpdates", {
    offset, timeout: pollTimeout,
    allowed_updates: ["message", "channel_post", "pre_checkout_query"],
  }) as Promise<TgUpdate[]>;
}

async function sendMessage(token: string, chatId: number, text: string, keyboard?: unknown[][]): Promise<void> {
  await tgCall(token, "sendMessage", {
    chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true,
    ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }),
  });
}

async function setReaction(token: string, chatId: number, messageId: number, emoji: string): Promise<void> {
  await tgCall(token, "setMessageReaction", {
    chat_id: chatId, message_id: messageId,
    reaction: [{ type: "emoji", emoji }], is_big: true,
  });
}

async function sendInvoice(token: string, chatId: number): Promise<void> {
  await tgCall(token, "sendInvoice", {
    chat_id: chatId, title: "Donate to Auto Reaction Bot ✨",
    description: DONATE_MSG, payload: "{}", provider_token: "",
    start_parameter: "donate", currency: "XTR",
    prices: [{ label: "Pay ⭐️5", amount: 5 }],
  });
}

async function answerCheckout(token: string, queryId: string): Promise<void> {
  await tgCall(token, "answerPreCheckoutQuery", { pre_checkout_query_id: queryId, ok: true });
}

async function deleteWebhook(token: string): Promise<void> {
  await tgCall(token, "deleteWebhook", { drop_pending_updates: false });
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
        [{ text: "Github Source 📥", url: "https://github.com/Malith-Rukshan/Auto-Reaction-Bot" }],
      ]);
    } else if (update.message && text === "/reactions") {
      await sendMessage(token, chat.id, "✅ Enabled Reactions:\n\n" + reactions.join(" "));
    } else if (update.message && (text === "/donate" || text === "/start donate")) {
      await sendInvoice(token, chat.id);
    } else if (!restrictedChats.includes(chat.id)) {
      const isGroup = ["group", "supergroup"].includes(chat.type);
      const threshold = 1 - randomLevel / 10;
      if (!isGroup || Math.random() <= threshold) {
        await setReaction(token, chat.id, message_id, randomReaction(reactions));
      }
    }
  } else if (update.pre_checkout_query) {
    await answerCheckout(token, update.pre_checkout_query.id);
    await sendMessage(token, update.pre_checkout_query.from.id, "Thank you for your donation! 💝");
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
    await deleteWebhook(token);
    logger.info("Webhook cleared — starting long-poll loop");
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

// ─── HTTP server ──────────────────────────────────────────────────────────────

const app = express();
app.use(pinoHttp({
  logger,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url?.split("?")[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));
app.use(express.json());

app.get("/", (_req, res) => res.redirect("/api/bot/"));
app.get("/api/bot/", (_req, res) => res.send(HTML));
app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

const port = Number(process.env["PORT"]);
if (!port) throw new Error("PORT environment variable is required");

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  startPolling().catch((err) => logger.error({ err }, "Polling loop crashed"));
});
