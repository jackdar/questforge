// The server clock sets the time of day, so every player sees the same time. A game day lasts 24 real minutes,
// so one game hour passes in one real minute.
export const DAY_LENGTH_MS = 24 * 60 * 1000;

// The time of day is a fraction of the day: 0 is midnight, 0.25 is 06:00, 0.5 is noon, and 0.75 is 18:00.
export function timeOfDay(serverTimeMs) {
  return (serverTimeMs % DAY_LENGTH_MS) / DAY_LENGTH_MS;
}

export function formatClock(dayFraction) {
  const totalMinutes = Math.floor(dayFraction * 24 * 60);
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}
