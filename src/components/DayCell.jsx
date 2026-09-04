import { emojiFor } from '../data/activityTypes'
import styles from './DayCell.module.css'

export default function DayCell({ day, isToday, isOtherMonth, workoutDay, yogaPreset, activities, onClick }) {
  if (!day) return <div className={styles.empty} />

  const cls = [styles.cell]
  if (isToday) cls.push(styles.today)
  if (isOtherMonth) cls.push(styles.otherMonth)

  return (
    <div className={cls.join(' ')} onClick={onClick}>
      <span className={styles.num}>{day}</span>
      <div className={styles.icons}>
        {workoutDay && <span className={styles.tag} title={`Day ${workoutDay}`}>D{workoutDay}</span>}
        {yogaPreset && <span className={styles.tagYoga} title={yogaPreset}>Y</span>}
        {activities && activities.length > 0 && (
          <span className={styles.tagActivity} title={activities.map(a => a.activity).join(', ')}>
            {emojiFor(activities[0].activity)}
          </span>
        )}
      </div>
    </div>
  )
}
