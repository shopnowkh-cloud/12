import { START_MSG } from "./constants";
import { randomReaction } from "./helpers";
import { TgUpdate, sendMessage, setReaction, sendInvoice, answerCheckout } from "./telegram";

export async function handleUpdate(
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
          { text: "➕ Add to Channel", url: `https://t.me/${botUsername}?startchannel=botstart` },
          { text: "➕ Add to Group", url: `https://t.me/${botUsername}?startgroup=botstart` },
        ],
        [{ text: "💝 Support Us - Donate 🤝", url: `https://t.me/${botUsername}?start=donate` }],
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
