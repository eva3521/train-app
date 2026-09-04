import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import useTimer from '../hooks/useTimer'
import useVoice from '../hooks/useVoice'
import useBeep from '../hooks/useBeep'
import { sections } from '../data/yogaPresets'
import styles from './YogaPlayer.module.css'

function formatTime(seconds) {
  const m = Math.floor(Math.abs(seconds) / 60)
  const s = Math.abs(seconds) % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(seconds) {
  if (seconds >= 120 && seconds % 60 === 0) return `${seconds / 60} 分`
  return `${seconds} 秒`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const CIRCUMFERENCE = 2 * Math.PI * 72 // ~452.4
const EXTEND_SECONDS = 30
const SECTION_ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

export default function YogaPlayer() {
  const navigate = useNavigate()
  const addYogaLog = useStore(s => s.addYogaLog)
  const yogaPresets = useStore(s => s.yogaPresets)
  const { remaining, done, startDown, stop } = useTimer()
  const voice = useVoice()
  const { beep, unlock } = useBeep()

  const [phase, setPhase] = useState('select') // select | playing | done
  const [preset, setPreset] = useState(null)
  const [poseIndex, setPoseIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  // Seconds added to the current pose by the +30 button; reset on every move.
  const [extraSecs, setExtraSecs] = useState(0)

  const sessionStartRef = useRef(null)
  const halfwaySpokenRef = useRef(false)

  const poses = useMemo(() => (preset ? preset.poses : []), [preset])
  const currentPose = preset ? poses[poseIndex] : null
  const poseDuration = currentPose ? currentPose.duration + extraSecs : 0

  const totalDuration = useMemo(() => poses.reduce((s, p) => s + p.duration, 0), [poses])

  const elapsedPoses = useMemo(
    () => poses.slice(0, poseIndex).reduce((s, p) => s + p.duration, 0),
    [poses, poseIndex],
  )

  const overallProgress = useMemo(() => {
    if (!currentPose || totalDuration === 0) return 0
    // Extended seconds don't stretch the bar — the routine is still the same
    // length on paper, this pose just gets held longer.
    const poseElapsed = Math.min(currentPose.duration, Math.max(0, poseDuration - remaining))
    return ((elapsedPoses + poseElapsed) / totalDuration) * 100
  }, [currentPose, totalDuration, elapsedPoses, poseDuration, remaining])

  const overallRemaining = useMemo(() => {
    if (!preset) return 0
    return remaining + poses.slice(poseIndex + 1).reduce((s, p) => s + p.duration, 0)
  }, [preset, poses, poseIndex, remaining])

  // ─── Section progress ───────────────────────────────────────────
  // Sections are numbered by their position in this preset, not by their index
  // in the master list, so the shortened routine still reads 1..5.
  const sectionIds = useMemo(() => [...new Set(poses.map(p => p.section))], [poses])
  const sectionOf = currentPose ? currentPose.section : null
  const sectionPos = sectionIds.indexOf(sectionOf)
  const sectionPoses = useMemo(
    () => poses.filter(p => p.section === sectionOf),
    [poses, sectionOf],
  )
  const sectionDoneCount = useMemo(
    () => poses.slice(0, poseIndex).filter(p => p.section === sectionOf).length,
    [poses, poseIndex, sectionOf],
  )

  const ringOffset = poseDuration ? CIRCUMFERENCE * (1 - remaining / poseDuration) : 0

  // The gap between poses is derived rather than a phase of its own: the timer
  // stays `done` from the moment a pose ends until the next one starts it again.
  const inTransition = phase === 'playing' && done && poseIndex < poses.length - 1

  // What to say when a pose starts — the section is announced only on entry.
  const announcementFor = useCallback((index) => {
    const pose = poses[index]
    if (!pose) return ''
    const prev = index > 0 ? poses[index - 1] : null
    if (prev && prev.section === pose.section) return pose.voiceText
    const ordinal = SECTION_ORDINALS[sectionIds.indexOf(pose.section)] || ''
    return `第${ordinal}段，${sections[pose.section]}。${pose.voiceText}`
  }, [poses, sectionIds])

  const startPose = useCallback((index) => {
    setPoseIndex(index)
    setExtraSecs(0)
    halfwaySpokenRef.current = false
    startDown(poses[index].duration)
    setPaused(false)
    setTimeout(() => voice.speak(announcementFor(index)), 600)
  }, [poses, startDown, voice, announcementFor])

  const selectPreset = useCallback((p) => {
    voice.initOnGesture()
    unlock()
    setPreset(p)
    setPoseIndex(0)
    setExtraSecs(0)
    setPhase('playing')
    sessionStartRef.current = Date.now()
    halfwaySpokenRef.current = false
    startDown(p.poses[0].duration)
    const first = p.poses[0]
    const ordinal = SECTION_ORDINALS[0]
    setTimeout(
      () => voice.speak(`第${ordinal}段，${sections[first.section]}。${first.voiceText}`),
      600,
    )
  }, [startDown, voice, unlock])

  // ─── Countdown beeps over the last 5 seconds ────────────────────
  useEffect(() => {
    if (phase !== 'playing' || paused || poseDuration < 15) return
    if (remaining >= 1 && remaining <= 5) beep(880, 0.12)
  }, [remaining, phase, paused, poseDuration, beep])

  // Halfway cue, long holds only.
  useEffect(() => {
    if (phase !== 'playing' || !currentPose) return
    if (poseDuration < 120 || halfwaySpokenRef.current) return
    if (remaining === Math.floor(poseDuration / 2)) {
      halfwaySpokenRef.current = true
      voice.speak('一半時間到，繼續保持，讓呼吸帶你更深入。')
    }
  }, [remaining, phase, currentPose, poseDuration, voice])

  const finishSession = useCallback(() => {
    const totalMins = Math.round((Date.now() - sessionStartRef.current) / 60000 * 10) / 10
    addYogaLog({
      date: todayStr(),
      preset_name: preset.name,
      completed: true,
      duration_minutes: totalMins,
    })
    stop()
    voice.cancel()
    setPhase('done')
    voice.speak('練習結束了，做得很好。讓身體靜靜整合。')
  }, [preset, addYogaLog, stop, voice])

  // Pose finished — chime, then hand over to the next one.
  useEffect(() => {
    if (!done || phase !== 'playing') return
    beep(1200, 0.3)

    if (poseIndex >= poses.length - 1) {
      finishSession()
      return
    }
    const nextPose = poses[poseIndex + 1]
    voice.speak(`準備，接下來${nextPose.name}${nextPose.side ? `，${nextPose.side}邊` : ''}。`)
    const t = setTimeout(() => startPose(poseIndex + 1), 3000)
    return () => clearTimeout(t)
  }, [done, phase, poseIndex, poses, startPose, voice, beep, finishSession])

  const togglePause = useCallback(() => {
    if (paused) {
      startDown(remaining)
      setPaused(false)
    } else {
      stop()
      voice.cancel()
      setPaused(true)
    }
  }, [paused, remaining, startDown, stop, voice])

  // Hold this pose 30 seconds longer without disturbing the rest of the queue.
  const extendPose = useCallback(() => {
    unlock()
    setExtraSecs(e => e + EXTEND_SECONDS)
    if (!paused) startDown(remaining + EXTEND_SECONDS)
  }, [paused, remaining, startDown, unlock])

  const goPrev = useCallback(() => {
    if (poseIndex > 0) {
      stop()
      voice.cancel()
      startPose(poseIndex - 1)
    }
  }, [poseIndex, stop, voice, startPose])

  const goNext = useCallback(() => {
    if (poseIndex < poses.length - 1) {
      stop()
      voice.cancel()
      startPose(poseIndex + 1)
    }
  }, [poses, poseIndex, stop, voice, startPose])

  const jumpToPose = useCallback((index) => {
    stop()
    voice.cancel()
    startPose(index)
    setShowSidebar(false)
  }, [stop, voice, startPose])

  // === RENDER ===

  if (phase === 'select') {
    return (
      <div className="page">
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ alignSelf: 'flex-start' }}>
          &larr; Back
        </button>
        <div className={styles.selectHeader}>
          <h2>Select Stretch Routine</h2>
          <p className={styles.selectSub}>五段式全身伸展</p>
        </div>
        <div className={styles.presetList}>
          {yogaPresets.map(p => (
            <button key={p.id} className={`card ${styles.presetCard}`} onClick={() => selectPreset(p)}>
              <div className={styles.presetName}>{p.name}</div>
              <div className={styles.presetDesc}>{p.description}</div>
              <div className={styles.presetMeta}>{p.poses.length} poses · {p.duration} min</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (inTransition) {
    const nextPose = poses[poseIndex + 1]
    return (
      <div className={styles.transitionOverlay}>
        <div className={styles.transitionContent}>
          <div className={styles.transitionEmoji}>{nextPose.emoji}</div>
          <div className={styles.transitionName}>
            {nextPose.name}
            {nextPose.side && <em className={styles.transitionSide}>{nextPose.side}</em>}
          </div>
          <div className={styles.transitionMeta}>{formatDuration(nextPose.duration)}</div>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="page">
        <div className={`card ${styles.doneCard}`}>
          <div className={styles.doneEmoji}>&#x1F64F;</div>
          <h2 className={styles.doneTitle}>練習圓滿完成</h2>
          <p className={styles.doneText}>
            {preset.name}<br />
            {poses.length} poses completed
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ width: '100%', marginTop: 16 }}>
            Back to Calendar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Overall progress */}
      <div className={styles.progressWrap}>
        <div className={styles.progressFill} style={{ width: `${overallProgress}%` }} />
      </div>
      <div className={styles.progressLabels}>
        <span>{poseIndex + 1} / {poses.length}</span>
        <span>{formatTime(overallRemaining)}</span>
      </div>

      {/* Section progress */}
      <div className={styles.sectionBar}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIndex}>{sectionPos + 1} / {sectionIds.length}</span>
          <span className={styles.sectionTitle}>{sections[sectionOf]}</span>
          <span className={styles.sectionCount}>{sectionDoneCount + 1} / {sectionPoses.length}</span>
        </div>
        <div className={styles.sectionDots}>
          {sectionIds.map((sid, i) => (
            <span
              key={sid}
              className={`${styles.sectionDot} ${i < sectionPos ? styles.sectionDotDone : ''} ${i === sectionPos ? styles.sectionDotNow : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Main card */}
      <div className={`card ${styles.mainCard}`}>
        <span className={styles.poseEmoji}>{currentPose.emoji}</span>
        <div className={styles.poseName}>
          {currentPose.name}
          {currentPose.side && <em className={styles.poseSide}>{currentPose.side}</em>}
        </div>
        <div className={styles.poseNameEn}>{currentPose.nameEn}</div>

        {/* Timer ring */}
        <div className={styles.timerRingWrap}>
          <svg viewBox="0 0 160 160" className={styles.timerSvg}>
            <circle className={styles.ringBg} cx="80" cy="80" r="72" />
            <circle
              className={`${styles.ringProgress} ${remaining <= 5 ? styles.ringWarn : ''}`}
              cx="80" cy="80" r="72"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <div className={styles.timerCenter}>
            <div className={`${styles.timerDigits} ${remaining <= 5 ? styles.timerWarn : ''}`}>
              {formatTime(remaining)}
            </div>
            <div className={styles.timerLabel}>
              {paused ? '暫停中' : extraSecs > 0 ? `已加 ${extraSecs} 秒` : '進行中'}
            </div>
          </div>
        </div>

        <button className={styles.extendBtn} onClick={extendPose}>+30 秒</button>

        {/* Guidance */}
        <div className={styles.guidanceBox}>
          <p className={styles.guidanceText}>{currentPose.guidance}</p>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button className="btn btn-secondary" onClick={goPrev} disabled={poseIndex === 0}>
          &larr;
        </button>
        <button
          className={`btn ${paused ? 'btn-primary' : 'btn-secondary'} ${styles.playBtn}`}
          onClick={togglePause}
        >
          {paused ? '繼續' : '暫停'}
        </button>
        {poseIndex < poses.length - 1 ? (
          <button className="btn btn-secondary" onClick={goNext}>&rarr;</button>
        ) : (
          <button className={`btn btn-gold ${styles.finishBtn}`} onClick={finishSession}>完成</button>
        )}
      </div>

      {/* Voice toggle */}
      <div className={styles.voiceToggle}>
        <span className={styles.voiceDot} />
        <span className={styles.voiceLabel}>語音引導</span>
        <label className={styles.toggleSwitch}>
          <input type="checkbox" checked={voice.enabled} onChange={voice.toggle} />
          <span className={styles.toggleSlider} />
        </label>
      </div>

      {/* Pose list toggle */}
      <button
        className={`btn btn-secondary ${styles.listToggle}`}
        onClick={() => setShowSidebar(!showSidebar)}
      >
        {showSidebar ? '隱藏課表' : '課表總覽'}
      </button>

      {/* Pose list */}
      {showSidebar && (
        <div className={`card ${styles.poseList}`}>
          <div className={styles.poseListHeader}>課表總覽</div>
          {poses.map((p, i) => (
            <div key={p.id}>
              {(i === 0 || poses[i - 1].section !== p.section) && (
                <div className={styles.poseListSection}>{sections[p.section]}</div>
              )}
              <div
                className={`${styles.poseItem} ${i === poseIndex ? styles.poseItemActive : ''} ${i < poseIndex ? styles.poseItemDone : ''}`}
                onClick={() => jumpToPose(i)}
              >
                <span className={styles.poseItemEmoji}>{p.emoji}</span>
                <div className={styles.poseItemInfo}>
                  <div className={styles.poseItemName}>
                    {p.name}
                    {p.side && <em className={styles.poseItemSide}>{p.side}</em>}
                  </div>
                  <div className={styles.poseItemDur}>{formatDuration(p.duration)}</div>
                </div>
                {i === poseIndex && <span className={styles.activeDot} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quit button */}
      <button className="btn btn-secondary" onClick={() => { stop(); voice.cancel(); navigate('/') }} style={{ width: '100%' }}>
        Quit Session
      </button>
    </div>
  )
}
