import { useNavigate } from 'react-router-dom'
import styles from './ActionSheet.module.css'

export default function ActionSheet({ date, onClose, dayDetail }) {
  const navigate = useNavigate()
  const isPast = dayDetail !== null

  return (
    <div className="overlay" onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        {isPast ? (
          <>
            <h3 className={styles.title}>{date}</h3>
            {dayDetail.workout && (
              <div className={styles.detail}>
                <span className={styles.icon}>D{dayDetail.workout.day_number}</span>
                <div>
                  <div className={styles.label}>{dayDetail.workout.title || `Day ${dayDetail.workout.day_number}`}</div>
                  <div className={styles.sub}>{dayDetail.workout.duration_minutes} min</div>
                </div>
              </div>
            )}
            {dayDetail.yoga && (
              <div className={styles.detail}>
                <span className={styles.iconYoga}>Y</span>
                <div>
                  <div className={styles.label}>{dayDetail.yoga.preset_name}</div>
                  <div className={styles.sub}>{dayDetail.yoga.duration_minutes} min</div>
                </div>
              </div>
            )}
            {!dayDetail.workout && !dayDetail.yoga && (
              <div className={styles.sub} style={{ textAlign: 'center', padding: 16 }}>No activity logged</div>
            )}
            <button className={`btn btn-secondary ${styles.closeBtn}`} onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <h3 className={styles.title}>Start Activity</h3>
            <button className={`btn btn-primary ${styles.actionBtn}`} onClick={() => navigate('/workout')}>
              Start Workout
            </button>
            <button className={`btn btn-gold ${styles.actionBtn}`} onClick={() => navigate('/yoga')}>
              Start Yoga
            </button>
            <button className={`btn btn-secondary ${styles.closeBtn}`} onClick={onClose}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}
