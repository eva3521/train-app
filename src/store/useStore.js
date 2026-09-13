import { create } from 'zustand';
import { yogaPresets as hardcodedPresets } from '../data/yogaPresets';
import { workoutProgram as hardcodedProgram } from '../data/workoutProgram';

const QUEUE_KEY = 'train_offline_queue';
const WORKOUT_LOG_KEY = 'train_workout_log';
const YOGA_LOG_KEY = 'train_yoga_log';
const EXERCISE_LOG_KEY = 'train_exercise_log';
const ACTIVITY_LOG_KEY = 'train_activity_log';
const EXERCISE_NOTES_KEY = 'train_exercise_notes';

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { return []; }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function loadLocal(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function saveLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* storage full — ok */ }
}

// Notes are a map, not a list: { [exerciseName]: { note, updated_at } }.
function loadLocalMap(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}

// Sheet rows → map. Rows with an empty note are dropped so a cleared note
// really disappears from the UI.
function notesFromRows(rows) {
  const map = {};
  for (const r of rows) {
    const name = String(r.exercise ?? '').trim();
    if (!name) continue;
    map[name] = { note: String(r.note ?? ''), updated_at: String(r.updated_at ?? '') };
  }
  return map;
}

// Newest edit wins per exercise, so a note written offline isn't clobbered
// by the stale copy in Sheets on the next load.
function mergeNotes(remote, local) {
  const merged = { ...remote };
  for (const [name, entry] of Object.entries(local)) {
    const cur = merged[name];
    if (!cur || String(entry.updated_at) > String(cur.updated_at)) merged[name] = entry;
  }
  return merged;
}

const useStore = create((set, get) => ({
  workoutLog: loadLocal(WORKOUT_LOG_KEY),
  yogaLog: loadLocal(YOGA_LOG_KEY),
  exerciseLog: loadLocal(EXERCISE_LOG_KEY),
  activityLog: loadLocal(ACTIVITY_LOG_KEY),
  exerciseNotes: loadLocalMap(EXERCISE_NOTES_KEY),
  // Menus live in the source code now, not in Sheets.
  workoutProgram: hardcodedProgram,
  yogaPresets: hardcodedPresets,
  loading: true,
  error: null,
  gasUrl: import.meta.env.VITE_GAS_URL || '',

  fetchAll: async () => {
    const url = get().gasUrl;
    if (!url) {
      set({ loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const [wLog, yLog, eLog, aLog, notesRows] = await Promise.all([
        fetch(`${url}?action=getWorkoutLog`).then(r => r.json()),
        fetch(`${url}?action=getYogaLog`).then(r => r.json()),
        fetch(`${url}?action=getExerciseLog`).then(r => r.json()),
        fetch(`${url}?action=getActivityLog`).then(r => r.json()),
        fetch(`${url}?action=getExerciseNotes`).then(r => r.json()),
      ]);

      const newWorkoutLog = Array.isArray(wLog) ? wLog : [];
      const newYogaLog = Array.isArray(yLog) ? yLog : [];
      const newExerciseLog = Array.isArray(eLog) ? eLog : [];
      const newActivityLog = Array.isArray(aLog) ? aLog : [];

      // Sheets is source of truth when it has data; otherwise keep what's local
      // (entries added offline that haven't synced yet).
      const mergedWorkout = newWorkoutLog.length > 0 ? newWorkoutLog : loadLocal(WORKOUT_LOG_KEY);
      const mergedYoga = newYogaLog.length > 0 ? newYogaLog : loadLocal(YOGA_LOG_KEY);
      const mergedExercise = newExerciseLog.length > 0 ? newExerciseLog : loadLocal(EXERCISE_LOG_KEY);
      const mergedActivity = newActivityLog.length > 0 ? newActivityLog : loadLocal(ACTIVITY_LOG_KEY);

      saveLocal(WORKOUT_LOG_KEY, mergedWorkout);
      saveLocal(YOGA_LOG_KEY, mergedYoga);
      saveLocal(EXERCISE_LOG_KEY, mergedExercise);
      saveLocal(ACTIVITY_LOG_KEY, mergedActivity);

      // An old backend that doesn't know this action answers with an error
      // object, which simply means "no remote notes yet".
      const remoteNotes = notesFromRows(Array.isArray(notesRows) ? notesRows : []);
      const mergedNotes = mergeNotes(remoteNotes, loadLocalMap(EXERCISE_NOTES_KEY));
      saveLocal(EXERCISE_NOTES_KEY, mergedNotes);

      set({
        workoutLog: mergedWorkout,
        yogaLog: mergedYoga,
        exerciseLog: mergedExercise,
        activityLog: mergedActivity,
        exerciseNotes: mergedNotes,
        loading: false,
      });
      get().flushQueue();
    } catch (err) {
      set({ loading: false, error: err.message });
    }
  },

  addWorkoutLog: async (entry) => {
    set(s => {
      const updated = [...s.workoutLog, entry];
      saveLocal(WORKOUT_LOG_KEY, updated);
      return { workoutLog: updated };
    });
    const url = get().gasUrl;
    if (!url) return;
    const params = new URLSearchParams({
      action: 'logWorkout',
      date: entry.date,
      day_number: String(entry.day_number),
      completed: String(entry.completed),
      duration_minutes: String(entry.duration_minutes),
      notes: entry.notes || '',
    });
    try {
      await fetch(`${url}?${params}`);
    } catch {
      const queue = getQueue();
      queue.push({ type: 'logWorkout', data: entry });
      saveQueue(queue);
    }
  },

  addYogaLog: async (entry) => {
    set(s => {
      const updated = [...s.yogaLog, entry];
      saveLocal(YOGA_LOG_KEY, updated);
      return { yogaLog: updated };
    });
    const url = get().gasUrl;
    if (!url) return;
    const params = new URLSearchParams({
      action: 'logYoga',
      date: entry.date,
      preset_name: entry.preset_name,
      completed: String(entry.completed),
      duration_minutes: String(entry.duration_minutes),
    });
    try {
      await fetch(`${url}?${params}`);
    } catch {
      const queue = getQueue();
      queue.push({ type: 'logYoga', data: entry });
      saveQueue(queue);
    }
  },

  // Written as a whole session at once, so one network round trip per workout.
  // rows: [{ date, day_number, exercise, set_number, side, weight, reps }]
  addExerciseLogs: async (rows) => {
    if (!rows || rows.length === 0) return;
    set(s => {
      const updated = [...s.exerciseLog, ...rows];
      saveLocal(EXERCISE_LOG_KEY, updated);
      return { exerciseLog: updated };
    });
    const url = get().gasUrl;
    if (!url) return;
    const params = new URLSearchParams({
      action: 'logExercises',
      rows: JSON.stringify(rows),
    });
    try {
      await fetch(`${url}?${params}`);
    } catch {
      const queue = getQueue();
      queue.push({ type: 'logExercises', data: { rows: JSON.stringify(rows) } });
      saveQueue(queue);
    }
  },

  // Training outside the program — logged in hours, for a chosen date, so
  // an evening on the slopes can be entered the next morning.
  addActivityLog: async (entry) => {
    set(s => {
      const updated = [...s.activityLog, entry];
      saveLocal(ACTIVITY_LOG_KEY, updated);
      return { activityLog: updated };
    });
    const url = get().gasUrl;
    if (!url) return;
    const params = new URLSearchParams({
      action: 'logActivity',
      date: entry.date,
      activity: entry.activity,
      duration_hours: String(entry.duration_hours),
      emoji: entry.emoji || '',
    });
    try {
      await fetch(`${url}?${params}`);
    } catch {
      const queue = getQueue();
      queue.push({ type: 'logActivity', data: entry });
      saveQueue(queue);
    }
  },

  // Form cues for one exercise, shared across every day it appears on.
  // Saving an empty string clears the note.
  saveExerciseNote: async (exercise, note) => {
    const name = String(exercise ?? '').trim();
    if (!name) return;
    const entry = { note: String(note ?? '').trim(), updated_at: new Date().toISOString() };
    set(s => {
      const updated = { ...s.exerciseNotes, [name]: entry };
      saveLocal(EXERCISE_NOTES_KEY, updated);
      return { exerciseNotes: updated };
    });
    const url = get().gasUrl;
    if (!url) return;
    const data = { exercise: name, note: entry.note, updated_at: entry.updated_at };
    const params = new URLSearchParams({ action: 'saveExerciseNote', ...data });
    try {
      await fetch(`${url}?${params}`);
    } catch {
      const queue = getQueue();
      queue.push({ type: 'saveExerciseNote', data });
      saveQueue(queue);
    }
  },

  // Remove the last skipped entry (undo skip)
  removeLastSkip: () => {
    set(s => {
      const log = [...s.workoutLog];
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].notes === 'skipped') {
          log.splice(i, 1);
          saveLocal(WORKOUT_LOG_KEY, log);
          return { workoutLog: log };
        }
      }
      return {};
    });
  },

  flushQueue: async () => {
    const queue = getQueue();
    if (queue.length === 0) return;
    const url = get().gasUrl;
    if (!url) return;
    const remaining = [];
    for (const item of queue) {
      try {
        const params = new URLSearchParams({ action: item.type });
        Object.keys(item.data).forEach(k => params.set(k, String(item.data[k])));
        await fetch(`${url}?${params}`);
      } catch {
        remaining.push(item);
      }
    }
    saveQueue(remaining);
  },
}));

export default useStore;
