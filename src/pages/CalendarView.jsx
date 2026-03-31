import { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import DayCell from '../components/DayCell'
import ActionSheet from '../components/ActionSheet'
import styles from './CalendarView.module.css'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function pad(n) { return String(n).padStart(2, '0') }

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1)
  // Monday-based: 0=Mon...6=Sun
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const days = []
  // Previous month fill
  for (let i = startDow - 1; i >= 0; i--) {
    days.push({ day: daysInPrev - i, isOtherMonth: true })
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, isOtherMonth: false })
  }
  // Next month fill
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ day: d, isOtherMonth: true })
  }
  return days
}

export default function CalendarView() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(null)

  const workoutLog = useStore(s => s.workoutLog)
  const yogaLog = useStore(s => s.yogaLog)
  const loading = useStore(s => s.loading)

  const days = useMemo(() => getCalendarDays(year, month), [year, month])

  // Build lookup maps: dateStr -> data (only completed entries shown on calendar)
  const workoutMap = useMemo(() => {
    const m = {}
    workoutLog
      .filter(e => e.completed === true || String(e.completed).toUpperCase() === 'TRUE')
      .forEach(e => {
        const d = typeof e.date === 'string' ? e.date : new Date(e.date).toISOString().slice(0, 10)
        m[d] = e
      })
    return m
  }, [workoutLog])

  const yogaMap = useMemo(() => {
    const m = {}
    yogaLog.forEach(e => {
      const d = typeof e.date === 'string' ? e.date : new Date(e.date).toISOString().slice(0, 10)
      m[d] = e
    })
    return m
  }, [yogaLog])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function handleDayClick(day, isOtherMonth) {
    if (isOtherMonth) return
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
    const clickedDate = new Date(year, month, day)
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const isPast = clickedDate < todayDate

    if (isPast) {
      const workout = workoutMap[dateStr] || null
      const yoga = yogaMap[dateStr] || null
      setSelected({ date: dateStr, dayDetail: { workout, yoga } })
    } else {
      setSelected({ date: dateStr, dayDetail: null })
    }
  }

  const monthLabel = new Date(year, month).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })

  return (
    <div className="page">
      <header className={styles.header}>
        <h1 className={styles.title}>TRAIN</h1>
        <p className={styles.subtitle}>Personal Fitness Tracker</p>
      </header>

      <div className={styles.nav}>
        <button className="btn btn-secondary" onClick={prevMonth}>&larr;</button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button className="btn btn-secondary" onClick={nextMonth}>&rarr;</button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map(d => <div key={d} className={styles.weekday}>{d}</div>)}
      </div>

      <div className={styles.grid}>
        {days.map((d, i) => {
          const dateStr = d.isOtherMonth ? null : `${year}-${pad(month + 1)}-${pad(d.day)}`
          const isToday = !d.isOtherMonth && d.day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          const w = dateStr ? workoutMap[dateStr] : null
          const y = dateStr ? yogaMap[dateStr] : null

          return (
            <DayCell
              key={i}
              day={d.day}
              isToday={isToday}
              isOtherMonth={d.isOtherMonth}
              workoutDay={w ? w.day_number : null}
              yogaPreset={y ? y.preset_name : null}
              onClick={() => handleDayClick(d.day, d.isOtherMonth)}
            />
          )
        })}
      </div>

      {loading && <div className={styles.loading}>Loading...</div>}

      {selected && (
        <ActionSheet
          date={selected.date}
          dayDetail={selected.dayDetail}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
