// Team profile pictures: an emoji object drawn on the team's colour. Each AI manager's object suits their team's
// name; your team gets a random one when the league is created.

/** the AI managers' pictures, by owner name */
export const BOT_AVATARS: Record<string, string> = {
  Ravi: '👑', Meera: '💎', Arjun: '🏴‍☠️', Kabir: '🎩', Zoya: '🧹', Dev: '🌪️', Sana: '🔥', Neel: '⚡️', Isha: '🌙',
}

/** pictures your team can get */
export const USER_AVATARS = ['🚀', '🏆', '🎸', '🍉', '🌶️', '🎯', '💣', '🎲', '🛸', '🍕', '⚓️', '🪁', '🔮', '🎈']

/** A stable pick from USER_AVATARS for a team saved before pictures existed. */
export function defaultUserAvatar(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return USER_AVATARS[h % USER_AVATARS.length]
}
