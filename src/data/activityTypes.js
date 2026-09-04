// Quick-pick activities for the "other training" log — anything outside the
// Day 1-71 program and the stretch routine. Add a row here to turn a new
// activity into a one-tap button; anything not listed is still loggable by
// typing a name under 其他.
export const activityTypes = [
  { id: 'ski', name: '滑雪', emoji: '🎿', defaultHours: 4 },
  { id: 'pole', name: '鋼管課', emoji: '💃', defaultHours: 1 },
]

export const OTHER_EMOJI = '⚡'

export function emojiFor(activityName) {
  const known = activityTypes.find(a => a.name === activityName)
  return known ? known.emoji : OTHER_EMOJI
}
