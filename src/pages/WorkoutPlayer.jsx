import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import useTimer from '../hooks/useTimer'
import useBeep from '../hooks/useBeep'
import Confetti from '../components/Confetti'
import styles from './WorkoutPlayer.module.css'

function formatTime(seconds) {
  const m = Math.floor(Math.abs(seconds) / 60)
  const s = Math.abs(seconds) % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isTruthy(v) {
  return v === true || String(v).toUpperCase() === 'TRUE'
}

// Bodyweight moves don't ask for a weight. Anything using a bar, bell, cable,
// machine or band does. Keyword match beats maintaining a second list by hand.
const LOADED_RE = /啞鈴|槓鈴|滑輪|Cable|史密斯|高腳杯|壺鈴|器械|負重|彈力帶|翹臀圈|重量|硬舉|臀推|划船|彎舉|下壓|飛鳥|肩推|下拉|深蹲|窄蹲|弓箭步|分腿蹲|前平舉|三頭|RM/i
const UNLOADED_RE = /徒手|自體重|靠牆|呼吸|走路|步態|足弓|舌頂|下顎|扶槓|伏地挺身|抬臀|超人|手抱頭|核心穩定|踩階梯|髖外展|髖屈|下腹|胸椎|單腿轉體/

function usesWeight(ex) {
  if (UNLOADED_RE.test(ex.name)) return false
  return LOADED_RE.test(ex.name) || LOADED_RE.test(String(ex.reps))
}

export default function WorkoutPlayer() {
  const navigate    = useNavigate()
  const workoutLog     = useStore(s => s.workoutLog)
  const workoutProgram = useStore(s => s.workoutProgram)
  const addWorkoutLog  = useStore(s => s.addWorkoutLog)
  const removeLastSkip = useStore(s => s.removeLastSkip)
  const exerciseLog    = useStore(s => s.exerciseLog)
  const addExerciseLogs = useStore(s => s.addExerciseLogs)

  // Single timer for session elapsed (Web Worker, iOS safe)
  const { elapsed, startUp, stop: stopElapsed, reset: resetElapsed } = useTimer()
  const { beep, unlock } = useBeep()

  // Rest countdown via setInterval ref (simpler, no second Worker needed)
  const restIntervalRef = useRef(null)
  const [restSecs, setRestSecs]       = useState(0)
  const [restFinished, setRestFinished] = useState(false)

  const [phase, setPhase]               = useState('ready')
  const [showConfetti, setShowConfetti] = useState(false)
  const [completedDay, setCompletedDay] = useState(null)

  // Active-phase tracking
  const [exIdx, setExIdx]         = useState(0)
  const [setNum, setSetNum]       = useState(1)
  const [side, setSide]           = useState('left')
  const [resting, setResting]     = useState(false)
  const [allExDone, setAllExDone] = useState(false)
  const [prevStep, setPrevStep]   = useState(null)

  const pendingRef = useRef(null)

  // Weight logging
  const [askWeight, setAskWeight]   = useState(false)   // showing the input?
  const [weightVal, setWeightVal]   = useState('')
  const [repsVal, setRepsVal]       = useState('')
  const [sessionSets, setSessionSets] = useState([])    // collected, written at the end
  const [sessionWeights, setSessionWeights] = useState({}) // exercise name -> weight used this session

  // ─── Derived ───────────────────────────────────────────────────
  // Next suggested day = last logged day + 1 (all log entries, completed + skipped)
  const nextDay = useMemo(() => {
    if (workoutLog.length === 0) return 1
    return Math.max(...workoutLog.map(e => Number(e.day_number))) + 1
  }, [workoutLog])

  const maxDay = useMemo(() => {
    if (workoutProgram.length === 0) return 64
    return Math.max(...workoutProgram.map(r => Number(r.Day ?? r.day)))
  }, [workoutProgram])

  // Selected day — free to choose; defaults to nextDay and resyncs when nextDay changes
  const [selectedDay, setSelectedDay] = useState(nextDay)
  useEffect(() => { setSelectedDay(nextDay) }, [nextDay])

  const canUndoSkip = useMemo(() => {
    if (workoutLog.length === 0) return false
    return workoutLog[workoutLog.length - 1].notes === 'skipped'
  }, [workoutLog])

  const exercises = useMemo(() => {
    return workoutProgram
      .filter(r => Number(r.Day ?? r.day) === selectedDay)
      .map((row, i) => ({
        id: String(i),
        name:      row.Exercise ?? row.exercise ?? '',
        sets:      Math.max(1, parseInt(row.Sets ?? row.sets) || 1),
        reps:      String(row.Reps ?? row.reps ?? ''),
        rest:      Number(row['Rest(s)'] ?? row['rest(s)'] ?? row.rest ?? 0),
        symmetric: isTruthy(row.Symmetric ?? row.symmetric),
        notes:     row.Notes ?? row.notes ?? '',
      }))
  }, [workoutProgram, selectedDay])

  // Most recent previously-logged set for each exercise name
  const lastByExercise = useMemo(() => {
    const map = {}
    for (const r of exerciseLog) {
      const name = r.exercise ?? r.Exercise
      if (!name) continue
      const prev = map[name]
      const d = String(r.date ?? r.Date ?? '')
      if (!prev || d >= prev.date) {
        map[name] = { date: d, weight: Number(r.weight ?? r.Weight) || 0, reps: String(r.reps ?? r.Reps ?? '') }
      }
    }
    return map
  }, [exerciseLog])

  const currentEx = allExDone ? null : exercises[exIdx]
  const totalSets = currentEx?.sets ?? 1
  const sideLabel = currentEx?.symmetric ? (side === 'left' ? '左邊' : '右邊') : null

  // ─── Rest timer (setInterval, no Worker) ───────────────────────
  const beginRest = useCallback((duration) => {
    clearInterval(restIntervalRef.current)
    setRestFinished(false)
    setRestSecs(duration)
    let s = duration
    restIntervalRef.current = setInterval(() => {
      s -= 1
      if (s <= 0) {
        clearInterval(restIntervalRef.current)
        restIntervalRef.current = null
        setRestSecs(0)
        setRestFinished(true)
        beep(1200, 0.3) // Final beep — higher pitch, longer
      } else {
        setRestSecs(s)
        if (s <= 5 && s >= 1) beep(880, 0.15) // Last 5 seconds — short beeps
      }
    }, 1000)
  }, [beep])

  const cancelRest = useCallback(() => {
    clearInterval(restIntervalRef.current)
    restIntervalRef.current = null
    setRestSecs(0)
    setRestFinished(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => () => clearInterval(restIntervalRef.current), [])

  // ─── Apply pending step after rest ends ────────────────────────
  const applyPending = useCallback(() => {
    const next = pendingRef.current
    pendingRef.current = null
    if (!next) return
    if (next.done) {
      setAllExDone(true)
    } else {
      setExIdx(next.exIdx)
      setSetNum(next.setNum)
      setSide(next.side)
    }
  }, [])

  useEffect(() => {
    if (restFinished && resting) {
      setResting(false)
      setRestFinished(false)
      applyPending()
    }
  }, [restFinished]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Done set ──────────────────────────────────────────────────
  // Advance to the next set/exercise. Called directly for bodyweight moves,
  // or after the weight has been entered for loaded ones.
  const advanceSet = useCallback(() => {
    if (!currentEx) return
    setPrevStep({ exIdx, setNum, side })

    const isSym = currentEx.symmetric
    let nExIdx = exIdx, nSet = setNum, nSide = 'left'
    let done = false, shouldRest = false

    if (isSym) {
      if (side === 'left') {
        // L → R, no rest mid-set
        nSide = 'right'
      } else {
        // R done = one full set (L+R) complete → rest after every set
        shouldRest = currentEx.rest > 0
        if (setNum < totalSets) {
          nSet = setNum + 1; nSide = 'left'
        } else if (exIdx < exercises.length - 1) {
          nExIdx = exIdx + 1; nSet = 1; nSide = 'left'
        } else {
          done = true
        }
      }
    } else {
      // Rest after every set
      shouldRest = currentEx.rest > 0
      if (setNum < totalSets) {
        nSet = setNum + 1
      } else if (exIdx < exercises.length - 1) {
        nExIdx = exIdx + 1; nSet = 1
      } else {
        done = true
      }
    }

    if (done) { setAllExDone(true); return }

    const next = { exIdx: nExIdx, setNum: nSet, side: nSide, done: false }

    if (shouldRest) {
      pendingRef.current = next
      setResting(true)
      beginRest(currentEx.rest)
    } else {
      setExIdx(next.exIdx)
      setSetNum(next.setNum)
      setSide(next.side)
    }
  }, [currentEx, exIdx, setNum, side, totalSets, exercises.length, beginRest])

  // Pressing "done" either opens the weight input or just advances.
  const handleDoneSet = useCallback(() => {
    if (resting || !currentEx) return
    if (usesWeight(currentEx)) {
      const seeded = sessionWeights[currentEx.name]
        ?? lastByExercise[currentEx.name]?.weight
        ?? ''
      setWeightVal(seeded === '' ? '' : String(seeded))
      setRepsVal(String(currentEx.reps ?? ''))
      setAskWeight(true)
      return
    }
    advanceSet()
  }, [resting, currentEx, lastByExercise, sessionWeights, advanceSet])

  // Record the set, then advance.
  const confirmWeight = useCallback(() => {
    if (!currentEx) return
    const w = parseFloat(weightVal)
    setSessionSets(prev => [...prev, {
      date: todayStr(),
      day_number: selectedDay,
      exercise: currentEx.name,
      set_number: setNum,
      side: currentEx.symmetric ? (side === 'left' ? 'L' : 'R') : '',
      weight: Number.isFinite(w) ? w : 0,
      reps: repsVal,
    }])
    if (Number.isFinite(w)) setSessionWeights(prev => ({ ...prev, [currentEx.name]: w }))
    setAskWeight(false)
    advanceSet()
  }, [currentEx, weightVal, repsVal, setNum, side, selectedDay, advanceSet])

  const skipWeight = useCallback(() => {
    setAskWeight(false)
    advanceSet()
  }, [advanceSet])

  // ─── Skip rest ─────────────────────────────────────────────────
  const handleSkipRest = useCallback(() => {
    cancelRest()
    setResting(false)
    applyPending()
  }, [cancelRest, applyPending])

  // ─── Undo last step ────────────────────────────────────────────
  const handleGoBack = useCallback(() => {
    if (!prevStep) return
    cancelRest()
    setResting(false)
    pendingRef.current = null
    setExIdx(prevStep.exIdx)
    setSetNum(prevStep.setNum)
    setSide(prevStep.side)
    setAllExDone(false)
    setPrevStep(null)
  }, [prevStep, cancelRest])

  // ─── Jump to exercise via dot ──────────────────────────────────
  const handleJumpToEx = useCallback((i) => {
    cancelRest()
    setResting(false)
    pendingRef.current = null
    setExIdx(i); setSetNum(1); setSide('left')
    setAllExDone(false); setPrevStep(null)
  }, [cancelRest])

  // ─── Phase transitions ─────────────────────────────────────────
  const handleStart = useCallback(() => {
    unlock() // Init AudioContext on user gesture (iOS)
    setExIdx(0); setSetNum(1); setSide('left')
    setResting(false); setAllExDone(false); setPrevStep(null)
    pendingRef.current = null
    setSessionSets([])
    setSessionWeights({})
    setAskWeight(false)
    setPhase('active')
    startUp()
  }, [startUp, unlock])

  const handleComplete = useCallback(() => {
    stopElapsed(); cancelRest()
    setCompletedDay(selectedDay)
    addWorkoutLog({
      date: todayStr(), day_number: selectedDay, completed: true,
      duration_minutes: Math.round(elapsed / 60 * 10) / 10, notes: '',
    })
    addExerciseLogs(sessionSets)
    setSessionSets([])
    setPhase('done')
    setShowConfetti(true)
  }, [stopElapsed, cancelRest, elapsed, addWorkoutLog, selectedDay, addExerciseLogs, sessionSets])

  const handleSkipDay = useCallback(() => {
    addWorkoutLog({
      date: todayStr(), day_number: selectedDay, completed: false, duration_minutes: 0, notes: 'skipped',
    })
  }, [addWorkoutLog, selectedDay])

  const handleQuit = useCallback(() => {
    stopElapsed(); cancelRest(); resetElapsed()
    navigate('/')
  }, [stopElapsed, cancelRest, resetElapsed, navigate])

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="page">
      <Confetti active={showConfetti} />

      {/* ══════════ READY ══════════ */}
      {phase === 'ready' && (
        <>
          <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ alignSelf: 'flex-start' }}>
            ← Back
          </button>

          {/* Day selector */}
          <div className={`card ${styles.infoCard}`}>
            <div className={styles.daySelector}>
              <button
                className={styles.daySelectorBtn}
                onClick={() => setSelectedDay(d => Math.max(1, d - 1))}
                disabled={selectedDay <= 1}
              >‹</button>
              <div className={styles.daySelectorCenter}>
                <div className={styles.dayBadge}>DAY {selectedDay}</div>
                {selectedDay === nextDay && (
                  <div className={styles.nextDayHint}>建議下一天</div>
                )}
              </div>
              <button
                className={styles.daySelectorBtn}
                onClick={() => setSelectedDay(d => Math.min(maxDay, d + 1))}
                disabled={selectedDay >= maxDay}
              >›</button>
            </div>
            <p className={styles.desc}>
              {exercises.length > 0 ? `${exercises.length} 個動作` : '此天無課表資料'}
            </p>
          </div>

          {exercises.length > 0 && (
            <div className={`card ${styles.previewCard}`}>
              <div className={styles.previewHeader}>今日課表</div>
              {exercises.map((ex, i) => (
                <div key={i} className={styles.previewItem}>
                  <span className={styles.previewName}>
                    {ex.name}
                    {ex.symmetric && <span className={styles.symBadge}>左右輪流</span>}
                  </span>
                  <span className={styles.previewMeta}>
                    {ex.sets} × {ex.reps}{ex.rest > 0 ? ` · 組後休息 ${ex.rest}s` : ''}
                  </span>
                  {ex.notes && <div className={styles.previewNotes}>{ex.notes}</div>}
                </div>
              ))}
            </div>
          )}

          <button className={`btn btn-primary ${styles.startBtn}`} onClick={handleStart}>
            START
          </button>

          <div className={styles.skipRow}>
            {canUndoSkip && (
              <button className={styles.undoBtn} onClick={removeLastSkip}>
                ← 回 Day {nextDay - 1}
              </button>
            )}
            <button className={styles.skipBtn} onClick={handleSkipDay}>
              跳過 Day {selectedDay}
            </button>
          </div>
        </>
      )}

      {/* ══════════ ACTIVE ══════════ */}
      {phase === 'active' && (
        <>
          <div className={styles.elapsedBar}>
            <span className={styles.dayBadgeSmall}>Day {selectedDay}</span>
            <span className={styles.elapsedTime}>{formatTime(elapsed)}</span>
          </div>

          {/* Progress dots */}
          <div className={styles.dotRow}>
            {exercises.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot}
                  ${i === exIdx && !allExDone ? styles.dotActive : ''}
                  ${(i < exIdx || allExDone) ? styles.dotDone : ''}`}
                onClick={() => handleJumpToEx(i)}
                aria-label={`第 ${i + 1} 個動作`}
              />
            ))}
          </div>

          {/* All done */}
          {allExDone && (
            <div className={`card ${styles.allDoneCard}`}>
              <div className={styles.allDoneEmoji}>💪</div>
              <div className={styles.allDoneText}>全部動作完成！</div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={handleComplete}>
                ✓ 記錄完成
              </button>
            </div>
          )}

          {/* Rest countdown */}
          {!allExDone && resting && (() => {
            const pending = pendingRef.current
            const nextEx = pending && !pending.done ? exercises[pending.exIdx] : null
            const isNewEx = pending && pending.exIdx !== exIdx
            return (
              <div className={`card ${styles.restCard}`}>
                <div className={styles.restLabel}>R E S T</div>
                <div className={styles.restDigits}>{formatTime(restSecs)}</div>

                {nextEx && (
                  <div className={styles.restNextPreview}>
                    <div className={styles.restNextLabel}>
                      {isNewEx ? '下一個動作' : '下一組'}
                    </div>
                    <div className={styles.restNextName}>
                      {isNewEx ? nextEx.name : `${currentEx.name} — 第 ${pending.setNum} 組`}
                    </div>
                    {isNewEx && nextEx.symmetric && (
                      <span className={styles.symBadge}>左右輪流</span>
                    )}
                    {isNewEx && (
                      <div className={styles.restNextMeta}>
                        {nextEx.sets} × {nextEx.reps}
                      </div>
                    )}
                  </div>
                )}

                <button className={styles.skipRestBtn} onClick={handleSkipRest}>
                  略過休息 →
                </button>
              </div>
            )
          })()}

          {/* Exercise card */}
          {!allExDone && !resting && currentEx && (
            <div className={`card ${styles.activeCard}`}>
              <div className={styles.exPosition}>{exIdx + 1} / {exercises.length}</div>

              <div className={styles.activeExName}>
                {currentEx.name}
                {currentEx.symmetric && <span className={styles.sideTag}>左右輪流</span>}
              </div>

              {currentEx.symmetric && (
                <div className={`${styles.sideIndicator} ${side === 'left' ? styles.sideLeft : styles.sideRight}`}>
                  ● {sideLabel}
                </div>
              )}

              <div className={styles.setInfo}>
                第 <span className={styles.setNumBig}>{setNum}</span>
                <span className={styles.setTotal}> 組 / {totalSets} 組</span>
              </div>

              <div className={styles.repsDisplay}>{currentEx.reps}</div>

              {usesWeight(currentEx) && (() => {
                const prev = lastByExercise[currentEx.name]
                const thisSession = sessionWeights[currentEx.name]
                if (thisSession !== undefined) {
                  return <div className={styles.lastWeight}>本次上一組 {thisSession} kg</div>
                }
                if (prev && prev.weight > 0) {
                  return (
                    <div className={styles.lastWeight}>
                      上次 {prev.weight} kg × {prev.reps}
                      <span className={styles.lastWeightDate}>{prev.date}</span>
                    </div>
                  )
                }
                return <div className={styles.lastWeightEmpty}>還沒有紀錄</div>
              })()}

              {currentEx.notes && <div className={styles.activeNotes}>{currentEx.notes}</div>}
            </div>
          )}

          {/* Weight input */}
          {askWeight && currentEx && (
            <div className={styles.weightBackdrop} onClick={skipWeight}>
              <div className={`card ${styles.weightSheet}`} onClick={e => e.stopPropagation()}>
                <div className={styles.weightTitle}>
                  {currentEx.name}
                  <span className={styles.weightSub}>
                    第 {setNum} 組{currentEx.symmetric ? ` · ${sideLabel}` : ''}
                  </span>
                </div>

                <div className={styles.weightFields}>
                  <label className={styles.weightField}>
                    <span className={styles.weightLabel}>重量 (kg)</span>
                    <input
                      className={styles.weightInput}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      autoFocus
                      value={weightVal}
                      onChange={e => setWeightVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmWeight() }}
                    />
                  </label>
                  <label className={styles.weightField}>
                    <span className={styles.weightLabel}>次數</span>
                    <input
                      className={styles.weightInput}
                      type="text"
                      inputMode="numeric"
                      value={repsVal}
                      onChange={e => setRepsVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmWeight() }}
                    />
                  </label>
                </div>

                <div className={styles.weightQuick}>
                  {[-2.5, -1, +1, +2.5].map(d => (
                    <button
                      key={d}
                      className={styles.weightQuickBtn}
                      onClick={() => {
                        const base = parseFloat(weightVal) || 0
                        setWeightVal(String(Math.max(0, Math.round((base + d) * 10) / 10)))
                      }}
                    >{d > 0 ? `+${d}` : d}</button>
                  ))}
                </div>

                <button className={`btn btn-primary ${styles.weightConfirm}`} onClick={confirmWeight}>
                  記錄並繼續
                </button>
                <button className={styles.weightSkip} onClick={skipWeight}>
                  這組不記錄
                </button>
              </div>
            </div>
          )}

          {/* Done-set button */}
          {!allExDone && !resting && currentEx && (
            <button className={`btn btn-primary ${styles.doneSetBtn}`} onClick={handleDoneSet}>
              {currentEx.symmetric ? `完成${sideLabel}` : '完成這組'}
            </button>
          )}

          {/* Undo step */}
          {prevStep && !resting && (
            <button className={styles.goBackBtn} onClick={handleGoBack}>← 上一步</button>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            <button className="btn btn-secondary" onClick={handleQuit}>Quit</button>
            <button className={`btn btn-primary ${styles.completeBtn}`} onClick={handleComplete}>
              Mark Complete
            </button>
          </div>
        </>
      )}

      {/* ══════════ DONE ══════════ */}
      {phase === 'done' && (
        <div className={`card ${styles.doneCard}`}>
          <div className={styles.doneEmoji}>🎉</div>
          <h2 className={styles.doneTitle}>Day {completedDay} Complete!</h2>
          <p className={styles.doneDuration}>{formatTime(elapsed)}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ width: '100%', marginTop: 16 }}>
            Back to Calendar
          </button>
        </div>
      )}
    </div>
  )
}
