// ============================================================
// state.js — In-memory state management + localStorage cache
// ============================================================

const CACHE_KEY     = 'injazpro_cache_v2';
const LAST_SYNC_KEY = 'injazpro_last_sync';

let _tasks       = [];
let _currentPage = 1;
const PAGE_SIZE  = 20;

// ── Getters ───────────────────────────────────────────────────
export function getTasks()       { return _tasks; }
export function getPage()        { return _currentPage; }
export function getPageSize()    { return PAGE_SIZE; }
export function getLastSync()    { return localStorage.getItem(LAST_SYNC_KEY); }
export function isOnline()       { return navigator.onLine; }

export function getTaskById(id) {
  return _tasks.find(t => String(t.id) === String(id)) || null;
}

export function getPaged(filtered) {
  const start = (_currentPage - 1) * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}

export function getTotalPages(filtered) {
  return Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
}

// ── Setters ───────────────────────────────────────────────────
export function setPage(p) { _currentPage = p; }

export function setTasks(tasks) {
  _tasks = tasks.map(normalise);
  _saveCache();
}

export function addTask(task) {
  _tasks.push(normalise(task));
  _saveCache();
}

export function updateTask(task) {
  const idx = _tasks.findIndex(t => String(t.id) === String(task.id));
  if (idx > -1) { _tasks[idx] = normalise(task); _saveCache(); }
}

export function removeTask(id) {
  _tasks = _tasks.filter(t => String(t.id) !== String(id));
  _saveCache();
}

// ── Cache ─────────────────────────────────────────────────────
export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) { _tasks = JSON.parse(raw).map(normalise); return true; }
  } catch (_) {}
  return false;
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
  _tasks = [];
}

function _saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(_tasks));
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (_) {}
}

// ── Helpers ───────────────────────────────────────────────────
function normalise(t) {
  return { ...t, progress: parseInt(t.progress) || 0 };
}
