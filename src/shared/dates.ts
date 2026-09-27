// Calendar-date arithmetic on 'YYYY-MM-DD' strings, done in UTC so a daylight-saving
// change can never shift a lesson to the wrong day.

export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The Monday of the week a date falls in. */
export function mondayOf(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  return addDays(dateIso, -((d.getUTCDay() + 6) % 7))
}
