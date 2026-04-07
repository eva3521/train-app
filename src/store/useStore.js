import { create } from 'zustand';
import { yogaPresets as hardcodedPresets } from '../data/yogaPresets';
import { workoutProgram as hardcodedProgram } from '../data/workoutProgram';

const QUEUE_KEY = 'train_offline_queue';
const WORKOUT_LOG_KEY = 'train_workout_log';
const YOGA_LOG_KEY = 'train_yoga_log';

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

const useStore = create((set, get) => ({
  workoutLog: loadLocal(WORKOUT_LOG_KEY),
  yogaLog: loadLocal(YOGA_LOG_KEY),
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
      const [wLog, yLog, wProg, yPresets] = await Promise.all([
        fetch(`${url}?action=getWorkoutLog`).then(r => r.json()),
        fetch(`${url}?action=getYogaLog`).then(r => r.json()),
        fetch(`${url}?action=getWorkoutProgram`).then(r => r.json()),
        fetch(`${url}?action=getYogaPresets`).then(r => r.json()),
      ]);

      const newWorkoutLog = Array.isArray(wLog) ? wLog : [];
      const newYogaLog = Array.isArray(yLog) ? yLog : [];

      // Merge: Sheets is source of truth, but also include any local-only entries
      // (entries that were added offline and haven't synced yet)
      const localWorkout = loadLocal(WORKOUT_LOG_KEY);
      const localYoga = loadLocal(YOGA_LOG_KEY);

      // Use Sheets data as base; if Sheets has data, it's authoritative
      const mergedWorkout = newWorkoutLog.length > 0 ? newWorkoutLog : localWorkout;
      const mergedYoga = newYogaLog.length > 0 ? newYogaLog : localYoga;

      saveLocal(WORKOUT_LOG_KEY, mergedWorkout);
      saveLocal(YOGA_LOG_KEY, mergedYoga);

      set({
        workoutLog: mergedWorkout,
        yogaLog: mergedYoga,
        workoutProgram: Array.isArray(wProg) && wProg.length > 0 ? wProg : hardcodedProgram,
        yogaPresets: Array.isArray(yPresets) && yPresets.length > 0 && yPresets[0].poses?.length > 0
          ? yPresets
          : hardcodedPresets,
        loading: false,
      });
      // Flush offline queue
      get().flushQueue();
    } catch (err) {
      set({ loading: false, error: err.message });
    }
  },

  addWorkoutLog: async (entry) => {
    // Optimistic update + persist to localStorage
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
        const params = new URLSearchParams({ action: item.type, ...item.data });
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
