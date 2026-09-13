import { useState } from 'react'
import useStore from '../store/useStore'
import styles from './ExerciseNoteSheet.module.css'

// Bottom sheet for writing the form cues of one exercise. Opened from the
// workout player; the note is shared by every day that exercise appears on.
export default function ExerciseNoteSheet({ exercise, onClose }) {
  const existing = useStore(s => s.exerciseNotes[exercise]?.note ?? '')
  const saveExerciseNote = useStore(s => s.saveExerciseNote)
  const [text, setText] = useState(existing)

  function save() {
    saveExerciseNote(exercise, text)
    onClose()
  }

  function clear() {
    saveExerciseNote(exercise, '')
    onClose()
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={`card ${styles.sheet}`} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>
          {exercise}
          <span className={styles.sub}>注意事項</span>
        </div>

        <textarea
          className={styles.textarea}
          rows={5}
          autoFocus
          // Caret at the end, so reopening an existing note appends to it.
          onFocus={e => { const n = e.target.value.length; e.target.setSelectionRange(n, n) }}
          placeholder="例如：膝蓋對腳尖、肩膀放鬆不聳肩、吐氣時出力…"
          value={text}
          onChange={e => setText(e.target.value)}
        />

        <button className={`btn btn-primary ${styles.confirm}`} onClick={save}>
          儲存
        </button>
        <div className={styles.secondaryRow}>
          <button className={styles.secondary} onClick={onClose}>取消</button>
          {existing && (
            <button className={`${styles.secondary} ${styles.danger}`} onClick={clear}>清除筆記</button>
          )}
        </div>
      </div>
    </div>
  )
}
