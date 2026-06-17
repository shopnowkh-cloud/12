export function getRandomPositiveReaction(reactions: string[]): string {
  const randomIndex = Math.floor(Math.random() * reactions.length);
  return reactions[randomIndex];
}

export function splitEmojis(emojiString: string | undefined): string[] {
  if (!emojiString) return [];
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji_Modifier_Base})/gu;
  return emojiString.match(emojiRegex) || [];
}

export function getChatIds(chats: string | undefined): number[] {
  return chats ? chats.split(",").map(Number).filter(Boolean) : [];
}
