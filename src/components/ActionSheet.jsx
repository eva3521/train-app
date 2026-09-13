import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { activityTypes, emojiFor, firstGrapheme, EMOJI_SUGGESTIONS, OTHER_EMOJI } from '../data/activityTypes'
import styles from './ActionSheet.module.css'

const HOUR_STEP = 0.5
const MAX_HOURS = 12

function hoursNum(h) {
  return Number.isInteger(h) ? String(h) : h.toFixed(1)
}

function formatHours(h) {
  return `${hoursNum(h)} 小時`
}

export default function ActionSheet({ date, isPast, dayDetail, onClose }) {
  const navigate = useNavigate()
  const addActivityLog = useStore(s => s.addActivityLog)

  const [logging, setLogging] = useState(false)
  const [picked, setPicked] = useState(activityTypes[0])
  const [customName, setCustomName] = useState('')
  const [customEmoji, setCustomEmoji] = useState('')
  const [hours, setHours] = useState(activityTypes[0].defaultHours)

  const { workout, yoga, activities } = dayDetail
  const hasAnything = workout || yoga || activities.length > 0

  // `picked` is null while 其他 is selected, and the typed name takes over.
  const activityName = picked ? picked.name : customName.trim()
  // What the 其他 tile shows: the chosen emoji once there is one, else the bolt.
  const otherEmoji = customEmoji || OTHER_EMOJI

  function choose(type) {
    setPicked(type)
    if (type) setHours(type.defaultHours)
  }

  function setEmojiText(text) {
    setCustomEmoji(firstGrapheme(text))
  }

  function save() {
    if (!activityName) return
    const entry = { date, activity: activityName, duration_hours: hours }
    // Only 其他 entries carry an emoji of their own; the quick-pick types
    // resolve theirs by name so a later tweak in activityTypes applies to
    // old rows too.
    if (!picked && customEmoji) entry.emoji = customEmoji
    addActivityLog(entry)
    onClose()
  }

  if (logging) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className={styles.sheet} onClick={e => e.stopPropagation()}>
          <h3 className={styles.title}>記錄其他運動</h3>
          <div className={styles.sub} style={{ textAlign: 'center', marginTop: -4 }}>{date}</div>

          <div className={styles.typeRow}>
            {activityTypes.map(t => (
              <button
                key={t.id}
                className={`${styles.typeBtn} ${picked?.id === t.id ? styles.typeBtnOn : ''}`}
                onClick={() => choose(t)}
              >
                <span className={styles.typeEmoji}>{t.emoji}</span>
                {t.name}
              </button>
            ))}
            <button
              className={`${styles.typeBtn} ${picked === null ? styles.typeBtnOn : ''}`}
              onClick={() => choose(null)}
            >
              <span className={styles.typeEmoji}>{otherEmoji}</span>
              其他
            </button>
          </div>

          {picked === null && (
            <>
              <div className={styles.customRow}>
                <input
                  className={styles.emojiInput}
                  type="text"
                  inputMode="text"
                  value={customEmoji}
                  onChange={e => setEmojiText(e.target.value)}
                  placeholder={OTHER_EMOJI}
                  aria-label="活動 emoji"
                />
                <input
                  className={styles.textInput}
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="活動名稱"
                  autoFocus
                />
              </div>
              <div className={styles.emojiRow}>
                {EMOJI_SUGGESTIONS.map(em => (
                  <button
                    key={em}
                    type="button"
                    className={`${styles.emojiBtn} ${customEmoji === em ? styles.emojiBtnOn : ''}`}
                    onClick={() => setCustomEmoji(em)}
                    aria-label={`選擇 ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className={styles.hoursRow}>
            <button
              className={styles.stepBtn}
              onClick={() => setHours(h => Math.max(HOUR_STEP, h - HOUR_STEP))}
              disabled={hours <= HOUR_STEP}
            >
              &minus;
            </button>
            <div className={styles.hoursValue}>
              <span className={styles.hoursNum}>{hoursNum(hours)}</span>
              <span className={styles.hoursUnit}>小時</span>
            </div>
            <button
              className={styles.stepBtn}
              onClick={() => setHours(h => Math.min(MAX_HOURS, h + HOUR_STEP))}
              disabled={hours >= MAX_HOURS}
            >
              +
            </button>
          </div>

          <button
            className={`btn btn-primary ${styles.actionBtn}`}
            onClick={save}
            disabled={!activityName}
          >
            記錄
          </button>
          <button className={`btn btn-secondary ${styles.closeBtn}`} onClick={() => setLogging(false)}>
            返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{date}</h3>

        {workout && (
          <div className={styles.detail}>
            <span className={styles.icon}>D{workout.day_number}</span>
            <div>
              <div className={styles.label}>{workout.title || `Day ${workout.day_number}`}</div>
              <div className={styles.sub}>{workout.duration_minutes} min</div>
            </div>
          </div>
        )}

        {yoga && (
          <div className={styles.detail}>
            <span className={styles.iconYoga}>Y</span>
            <div>
              <div className={styles.label}>{yoga.preset_name}</div>
              <div className={styles.sub}>{yoga.duration_minutes} min</div>
            </div>
          </div>
        )}

        {activities.map((a, i) => (
          <div key={i} className={styles.detail}>
            <span className={styles.iconActivity}>{emojiFor(a)}</span>
            <div>
              <div className={styles.label}>{a.activity}</div>
              <div className={styles.sub}>{formatHours(Number(a.duration_hours))}</div>
            </div>
          </div>
        ))}

        {!hasAnything && isPast && (
          <div className={styles.sub} style={{ textAlign: 'center', padding: 16 }}>No activity logged</div>
        )}

        {!isPast && (
          <>
            <button className={`btn btn-primary ${styles.actionBtn}`} onClick={() => navigate('/workout')}>
              Start Workout
            </button>
            <button className={`btn btn-gold ${styles.actionBtn}`} onClick={() => navigate('/yoga')}>
              Start Yoga
            </button>
          </>
        )}

        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={() => setLogging(true)}>
          記錄其他運動
        </button>
        <button className={`btn btn-secondary ${styles.closeBtn}`} onClick={onClose}>
          {isPast ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
