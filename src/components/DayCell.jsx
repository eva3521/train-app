import styles from './DayCell.module.css'

export default function DayCell({ day, isToday, isOtherMonth, workoutDay, yogaPreset, onClick }) {
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
      </div>
    </div>
  )
}
