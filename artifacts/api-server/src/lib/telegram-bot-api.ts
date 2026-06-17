import { logger } from "./logger";

export default class TelegramBotAPI {
  private apiUrl: string;

  constructor(botToken: string) {
    this.apiUrl = `https://api.telegram.org/bot${botToken}/`;
  }

  async callApi(action: string, body: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await fetch(this.apiUrl + action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json() as { ok: boolean; description?: string; error_code?: number };

      if (!response.ok) {
        logger.warn(
          `Telegram API request failed: ${action} (Status: ${response.status})${data.description ? " - " + data.description : ""}`,
        );

        if (action === "setMessageReaction") {
          logger.debug(`Chat ID: ${(body as any).chat_id}, Message ID: ${(body as any).message_id}`);
        } else if (action === "sendMessage") {
          logger.debug(`Chat ID: ${(body as any).chat_id}`);
        }

        throw new Error(`Telegram API error: ${data.description || "Unknown error"}`);
      }

      return data;
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === "AbortError") {
        logger.warn(`Request timeout for action: ${action}`);
        throw new Error(`Telegram API timeout: ${action}`);
      } else if (!err.message.includes("Telegram API error")) {
        logger.warn(`Network error for action: ${action} - ${err.message}`);
        throw new Error(`Network error: ${action}`);
      }
      throw error;
    }
  }

  async setMessageReaction(chatId: number, messageId: number, emoji: string): Promise<void> {
    await this.callApi("setMessageReaction", {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: "emoji", emoji }],
      is_big: true,
    });
  }

  async sendMessage(
    chatId: number,
    text: string,
    inlineKeyboard: Array<Array<{ text: string; url?: string }>> | null = null,
  ): Promise<void> {
    await this.callApi("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      ...(inlineKeyboard && { reply_markup: { inline_keyboard: inlineKeyboard } }),
    });
  }

  async sendInvoice(
    chatId: number,
    title: string,
    description: string,
    payload: string,
    providerToken: string,
    startParameter: string,
    currency: string,
    prices: Array<{ label: string; amount: number }>,
  ): Promise<void> {
    await this.callApi("sendInvoice", {
      chat_id: chatId,
      title,
      description,
      payload,
      provider_token: providerToken,
      start_parameter: startParameter,
      currency,
      prices,
    });
  }

  async answerPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean): Promise<void> {
    await this.callApi("answerPreCheckoutQuery", {
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
    });
  }

  async getUpdates(offset: number, timeout: number): Promise<TelegramUpdate[]> {
    const response = await fetch(this.apiUrl + "getUpdates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset, timeout, allowed_updates: ["message", "channel_post", "pre_checkout_query"] }),
      // long-poll: wait slightly longer than the Telegram timeout
      signal: AbortSignal.timeout((timeout + 5) * 1000),
    });
    const data = await response.json() as { ok: boolean; result: TelegramUpdate[]; description?: string };
    if (!data.ok) {
      throw new Error(`getUpdates failed: ${data.description ?? "unknown"}`);
    }
    return data.result;
  }

  async deleteWebhook(): Promise<void> {
    await this.callApi("deleteWebhook", { drop_pending_updates: false });
  }
}

export interface TelegramUpdate {
  update_id: number;
  message?: unknown;
  channel_post?: unknown;
  pre_checkout_query?: unknown;
}
