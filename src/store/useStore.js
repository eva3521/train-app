import { create } from 'zustand';
import { yogaPresets as hardcodedPresets } from '../data/yogaPresets';
import { workoutProgram as hardcodedProgram } from '../data/workoutProgram';

const QUEUE_KEY = 'train_offline_queue';

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { return []; }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

const useStore = create((set, get) => ({
  workoutLog: [],
  yogaLog: [],
  workoutProgram: hardcodedProgram, // start with hardcoded; replaced by Sheets if available
  yogaPresets: hardcodedPresets, // start with hardcoded; replaced by Sheets if available
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
      set({
        workoutLog: Array.isArray(wLog) ? wLog : [],
        yogaLog: Array.isArray(yLog) ? yLog : [],
        workoutProgram: Array.isArray(wProg) && wProg.length > 0 ? wProg : hardcodedProgram,
        // Only replace hardcoded presets if Sheets returned valid data with poses
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
    // Optimistic update
    set(s => ({ workoutLog: [...s.workoutLog, entry] }));
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
    set(s => ({ yogaLog: [...s.yogaLog, entry] }));
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
