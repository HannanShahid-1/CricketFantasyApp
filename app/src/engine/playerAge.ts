// Date-only arithmetic avoids shifting birthdays across time zones.
export function playerAge(birthDate: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const [year, month, day] = birthDate.split('-').map(Number)
  const birthday = new Date(Date.UTC(year, month - 1, day))
  if (birthday.getUTCFullYear() !== year || birthday.getUTCMonth() !== month - 1 || birthday.getUTCDate() !== day) return null
  const age = today.getFullYear() - year - Number(today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day))
  return age >= 0 && age <= 100 ? age : null
}
