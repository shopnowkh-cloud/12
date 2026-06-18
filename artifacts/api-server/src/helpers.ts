export function randomReaction(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function parseEmojis(str?: string): string[] {
  if (!str) return [];
  return str.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji_Modifier_Base})/gu) ?? [];
}

export function parseChatIds(str?: string): number[] {
  return str ? str.split(",").map(Number).filter(Boolean) : [];
}
