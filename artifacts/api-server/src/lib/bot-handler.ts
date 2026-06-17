import { startMessage, donateMessage } from "./bot-constants";
import { getRandomPositiveReaction } from "./bot-helper";
import TelegramBotAPI from "./telegram-bot-api";

interface TelegramUpdate {
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  pre_checkout_query?: {
    id: string;
    from: { id: number };
  };
}

interface TelegramMessage {
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  from?: {
    id: number;
    first_name: string;
  };
  message_id: number;
  text?: string;
}

export async function onUpdate(
  data: TelegramUpdate,
  botApi: TelegramBotAPI,
  reactions: string[],
  restrictedChats: number[],
  botUsername: string,
  randomLevel: number,
): Promise<void> {
  let chatId: number;
  let message_id: number;
  let text: string | undefined;

  if (data.message || data.channel_post) {
    const content = data.message || data.channel_post!;
    chatId = content.chat.id;
    message_id = content.message_id;
    text = content.text;

    if (data.message && (text === "/start" || text === "/start@" + botUsername)) {
      const name =
        content.chat.type === "private"
          ? content.from?.first_name ?? "User"
          : content.chat.title ?? "Group";
      await botApi.sendMessage(chatId, startMessage.replace("UserName", name), [
        [
          { text: "➕ Add to Channel ➕", url: `https://t.me/${botUsername}?startchannel=botstart` },
          { text: "➕ Add to Group ➕", url: `https://t.me/${botUsername}?startgroup=botstart` },
        ],
        [{ text: "Github Source 📥", url: "https://github.com/Malith-Rukshan/Auto-Reaction-Bot" }],
        [{ text: "💝 Support Us - Donate 🤝", url: `https://t.me/Auto_ReactionBOT?start=donate` }],
      ]);
    } else if (data.message && text === "/reactions") {
      const reactionsList = reactions.join(", ");
      await botApi.sendMessage(chatId, "✅ Enabled Reactions : \n\n" + reactionsList);
    } else if (data.message && (text === "/donate" || text === "/start donate")) {
      await botApi.sendInvoice(
        chatId,
        "Donate to Auto Reaction Bot ✨",
        donateMessage,
        "{}",
        "",
        "donate",
        "XTR",
        [{ label: "Pay ⭐️5", amount: 5 }],
      );
    } else {
      const threshold = 1 - randomLevel / 10;
      if (!restrictedChats.includes(chatId)) {
        if (["group", "supergroup"].includes(content.chat.type)) {
          if (Math.random() <= threshold) {
            await botApi.setMessageReaction(
              chatId,
              message_id,
              getRandomPositiveReaction(reactions),
            );
          }
        } else {
          await botApi.setMessageReaction(
            chatId,
            message_id,
            getRandomPositiveReaction(reactions),
          );
        }
      }
    }
  } else if (data.pre_checkout_query) {
    await botApi.answerPreCheckoutQuery(data.pre_checkout_query.id, true);
    await botApi.sendMessage(data.pre_checkout_query.from.id, "Thank you for your donation! 💝");
  }
}
