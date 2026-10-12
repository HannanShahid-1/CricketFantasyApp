/** One first-name initial; preserve surname particles such as "de Kock". */
export function playerDisplayName(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length < 2) return name.trim()
  let surname = words.length - 1
  while (surname > 1 && /^(de|du|van|von|der|den|da|del|al)$/i.test(words[surname - 1])) surname--
  return `${words[0][0]}. ${words.slice(surname).join(' ')}`
}
