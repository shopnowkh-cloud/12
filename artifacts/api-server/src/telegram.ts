import { DONATE_MSG } from "./constants";

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
  pre_checkout_query?: { id: string; from: { id: number } };
}

export interface TgMessage {
  chat: { id: number; type: string; title?: string };
  from?: { id: number; first_name: string };
  message_id: number;
  text?: string;
}

interface TgResult<T> { ok: boolean; result: T; description?: string }

export async function tg(token: string, action: string, body: Record<string, unknown>): Promise<unknown> {
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

export async function getUpdates(token: string, offset: number, timeout: number): Promise<TgUpdate[]> {
  return tg(token, "getUpdates", {
    offset, timeout,
    allowed_updates: ["message", "channel_post", "pre_checkout_query"],
  }) as Promise<TgUpdate[]>;
}

export async function sendMessage(token: string, chatId: number, text: string, keyboard?: unknown[][]): Promise<void> {
  await tg(token, "sendMessage", {
    chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true,
    ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }),
  });
}

export async function setReaction(token: string, chatId: number, messageId: number, emoji: string): Promise<void> {
  await tg(token, "setMessageReaction", {
    chat_id: chatId, message_id: messageId,
    reaction: [{ type: "emoji", emoji }], is_big: true,
  });
}

export async function sendInvoice(token: string, chatId: number): Promise<void> {
  await tg(token, "sendInvoice", {
    chat_id: chatId, title: "Donate to Auto Reaction Bot ✨",
    description: DONATE_MSG, payload: "{}", provider_token: "",
    start_parameter: "donate", currency: "XTR",
    prices: [{ label: "Pay ⭐️5", amount: 5 }],
  });
}

export async function answerCheckout(token: string, queryId: string): Promise<void> {
  await tg(token, "answerPreCheckoutQuery", { pre_checkout_query_id: queryId, ok: true });
}
