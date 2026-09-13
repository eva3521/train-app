// Quick-pick activities for the "other training" log — anything outside the
// Day 1-71 program and the stretch routine. Add a row here to turn a new
// activity into a one-tap button; anything not listed is still loggable by
// typing a name under 其他 and picking (or typing) an emoji for it.
export const activityTypes = [
  { id: 'ski', name: '滑雪', emoji: '🎿', defaultHours: 4 },
  { id: 'pole', name: '鋼管課', emoji: '💃', defaultHours: 1 },
]

export const OTHER_EMOJI = '⚡'

// Suggestions shown under 其他 so the common cases are one tap; anything
// else can be typed from the phone's emoji keyboard.
export const EMOJI_SUGGESTIONS = [
  '🏃', '🚴', '🏊', '🧗', '🏋️', '🥊', '🧘', '🤸',
  '⚽', '🏀', '🏸', '🎾', '🏐', '⛳', '🏄', '🛹',
  '⛸️', '🏇', '🚣', '🥾', '💪', '🕺', '⚡',
]

// Keep only the first user-perceived character, so a pasted "🏋️‍♀️🏋️‍♀️"
// or a stray letter after the emoji doesn't leak into the calendar cell.
// Intl.Segmenter knows about ZWJ sequences and skin-tone modifiers, which
// a plain string index would split in half.
export function firstGrapheme(text) {
  const s = (text || '').trim()
  if (!s) return ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const first = seg.segment(s)[Symbol.iterator]().next().value
    return first ? first.segment : ''
  }
  return Array.from(s)[0] || ''
}

// Takes a log entry ({ activity, emoji? }). Entries logged under 其他 carry
// their own emoji; older rows and the quick-pick types fall back to the
// name lookup, and anything unknown gets the generic bolt.
export function emojiFor(entry) {
  if (!entry) return OTHER_EMOJI
  const own = typeof entry.emoji === 'string' ? entry.emoji.trim() : ''
  if (own) return own
  const known = activityTypes.find(a => a.name === entry.activity)
  return known ? known.emoji : OTHER_EMOJI
}
