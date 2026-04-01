import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import useTimer from '../hooks/useTimer'
import useVoice from '../hooks/useVoice'
import styles from './YogaPlayer.module.css'

function formatTime(seconds) {
  const m = Math.floor(Math.abs(seconds) / 60)
  const s = Math.abs(seconds) % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(seconds) {
  if (seconds >= 60) return `${Math.floor(seconds / 60)} min`
  return `${seconds} sec`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const CIRCUMFERENCE = 2 * Math.PI * 72 // ~452.4

export default function YogaPlayer() {
  const navigate = useNavigate()
  const addYogaLog = useStore(s => s.addYogaLog)
  const yogaPresets = useStore(s => s.yogaPresets)
  const { remaining, running, done, startDown, stop, reset } = useTimer()
  const voice = useVoice()

  const [phase, setPhase] = useState('select') // select | playing | transition | done
  const [preset, setPreset] = useState(null)
  const [poseIndex, setPoseIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)

  const sessionStartRef = useRef(null)
  const halfwaySpokenRef = useRef(false)
  const tenSecSpokenRef = useRef(false)

  const currentPose = preset ? preset.poses[poseIndex] : null
  const totalDuration = preset ? preset.poses.reduce((s, p) => s + p.duration, 0) : 0

  const elapsedPoses = useMemo(() => {
    if (!preset) return 0
    return preset.poses.slice(0, poseIndex).reduce((s, p) => s + p.duration, 0)
  }, [preset, poseIndex])

  const overallProgress = useMemo(() => {
    if (!preset || totalDuration === 0) return 0
    const poseElapsed = currentPose ? currentPose.duration - remaining : 0
    return ((elapsedPoses + poseElapsed) / totalDuration) * 100
  }, [preset, totalDuration, elapsedPoses, currentPose, remaining])

  const overallRemaining = useMemo(() => {
    if (!preset) return 0
    const futureTime = preset.poses.slice(poseIndex + 1).reduce((s, p) => s + p.duration, 0)
    return remaining + futureTime
  }, [preset, poseIndex, remaining])

  // Ring progress
  const ringOffset = currentPose ? CIRCUMFERENCE * (1 - remaining / currentPose.duration) : 0

  // Handle pose start
  const startPose = useCallback((index) => {
    const pose = preset.poses[index]
    setPoseIndex(index)
    halfwaySpokenRef.current = false
    tenSecSpokenRef.current = false
    startDown(pose.duration)
    setPaused(false)
    const poseNum = String(index + 1).padStart(2, '0')
    setTimeout(() => voice.speak(pose.voiceText, { audioId: `pose_${poseNum}` }), 600)
  }, [preset, startDown, voice])

  // Handle preset selection
  const selectPreset = useCallback((p) => {
    voice.initOnGesture()
    setPreset(p)
    setPoseIndex(0)
    setPhase('playing')
    sessionStartRef.current = Date.now()
    halfwaySpokenRef.current = false
    tenSecSpokenRef.current = false
    startDown(p.poses[0].duration)
    setTimeout(() => voice.speak(p.poses[0].voiceText, { audioId: 'pose_01' }), 600)
  }, [startDown, voice])

  // Voice warnings
  useEffect(() => {
    if (phase !== 'playing' || !currentPose) return

    // Halfway
    if (currentPose.duration >= 120 && !halfwaySpokenRef.current) {
      const halfway = Math.floor(currentPose.duration / 2)
      if (remaining === halfway) {
        halfwaySpokenRef.current = true
        voice.speak('一半時間到，繼續保持，讓呼吸帶你更深入。', { audioId: 'halfway' })
      }
    }

    // 10 seconds warning
    if (!tenSecSpokenRef.current && remaining === 10) {
      tenSecSpokenRef.current = true
      voice.speak('還有十秒，準備緩慢起身。', { audioId: 'ten_sec' })
    }
  }, [remaining, phase, currentPose, voice])

  // Handle timer done
  useEffect(() => {
    if (!done || phase !== 'playing') return

    if (poseIndex < preset.poses.length - 1) {
      // Transition
      setPhase('transition')
      const nextPose = preset.poses[poseIndex + 1]
      const nextNum = String(poseIndex + 2).padStart(2, '0')
      voice.speak(`接下來是${nextPose.name}。`, { audioId: `next_${nextNum}` })

      setTimeout(() => {
        setPhase('playing')
        startPose(poseIndex + 1)
      }, 3000)
    } else {
      finishSession()
    }
  }, [done, phase, poseIndex, preset, startPose, addYogaLog, voice])  // eslint-disable-line

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
    voice.speak('練習圓滿完成。讓身體靜靜整合。願你帶著這份寧靜進入今天的其餘時光。', { audioId: 'finish' })
  }, [preset, addYogaLog, stop, voice])

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

  const goPrev = useCallback(() => {
    if (poseIndex > 0) {
      stop()
      voice.cancel()
      startPose(poseIndex - 1)
    }
  }, [poseIndex, stop, voice, startPose])

  const goNext = useCallback(() => {
    if (preset && poseIndex < preset.poses.length - 1) {
      stop()
      voice.cancel()
      startPose(poseIndex + 1)
    }
  }, [preset, poseIndex, stop, voice, startPose])

  const jumpToPose = useCallback((index) => {
    stop()
    voice.cancel()
    startPose(index)
    setShowSidebar(false)
  }, [stop, voice, startPose])

  // === RENDER ===

  // Preset selection
  if (phase === 'select') {
    return (
      <div className="page">
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ alignSelf: 'flex-start' }}>
          &larr; Back
        </button>
        <div className={styles.selectHeader}>
          <h2>Select Yoga Routine</h2>
          <p className={styles.selectSub}>陰瑜伽引導計時器</p>
        </div>
        <div className={styles.presetList}>
          {yogaPresets.map(p => (
            <button key={p.id} className={`card ${styles.presetCard}`} onClick={() => selectPreset(p)}>
              <div className={styles.presetName}>{p.name}</div>
              <div className={styles.presetDesc}>{p.description}</div>
              <div className={styles.presetMeta}>{p.poses.length} poses</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Transition overlay
  if (phase === 'transition') {
    const nextPose = preset.poses[poseIndex + 1]
    return (
      <div className={styles.transitionOverlay}>
        <div className={styles.transitionContent}>
          <div className={styles.transitionEmoji}>{nextPose.emoji}</div>
          <div className={styles.transitionName}>{nextPose.name}</div>
          <div className={styles.transitionMeta}>{formatDuration(nextPose.duration)}</div>
        </div>
      </div>
    )
  }

  // Completion
  if (phase === 'done') {
    return (
      <div className="page">
        <div className={`card ${styles.doneCard}`}>
          <div className={styles.doneEmoji}>&#x1F64F;</div>
          <h2 className={styles.doneTitle}>練習圓滿完成</h2>
          <p className={styles.doneText}>
            {preset.name}<br />
            {preset.poses.length} poses completed
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ width: '100%', marginTop: 16 }}>
            Back to Calendar
          </button>
        </div>
      </div>
    )
  }

  // Active playing
  return (
    <div className="page">
      {/* Progress bar */}
      <div className={styles.progressWrap}>
        <div className={styles.progressFill} style={{ width: `${overallProgress}%` }} />
      </div>
      <div className={styles.progressLabels}>
        <span>{poseIndex + 1} / {preset.poses.length}</span>
        <span>{formatTime(overallRemaining)}</span>
      </div>

      {/* Main card */}
      <div className={`card ${styles.mainCard}`}>
        <span className={styles.poseEmoji}>{currentPose.emoji}</span>
        <div className={styles.poseName}>{currentPose.name}</div>
        <div className={styles.poseNameEn}>{currentPose.nameEn}</div>

        {/* Timer ring */}
        <div className={styles.timerRingWrap}>
          <svg viewBox="0 0 160 160" className={styles.timerSvg}>
            <circle className={styles.ringBg} cx="80" cy="80" r="72" />
            <circle
              className={styles.ringProgress}
              cx="80" cy="80" r="72"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <div className={styles.timerCenter}>
            <div className={styles.timerDigits}>{formatTime(remaining)}</div>
            <div className={styles.timerLabel}>{paused ? '\u66AB\u505C\u4E2D' : '\u9032\u884C\u4E2D'}</div>
          </div>
        </div>

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
          {paused ? '\u7E7C\u7E8C' : '\u66AB\u505C'}
        </button>
        {poseIndex < preset.poses.length - 1 ? (
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
          {preset.poses.map((p, i) => (
            <div
              key={i}
              className={`${styles.poseItem} ${i === poseIndex ? styles.poseItemActive : ''} ${i < poseIndex ? styles.poseItemDone : ''}`}
              onClick={() => jumpToPose(i)}
            >
              <span className={styles.poseItemEmoji}>{p.emoji}</span>
              <div className={styles.poseItemInfo}>
                <div className={styles.poseItemName}>{p.name}</div>
                <div className={styles.poseItemDur}>{formatDuration(p.duration)}</div>
              </div>
              {i === poseIndex && <span className={styles.activeDot} />}
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
