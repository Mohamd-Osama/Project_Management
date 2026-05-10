// ============================================================
// api.js — Google Apps Script communication layer
// ⚠️  Replace APPS_SCRIPT_URL with your deployed Web App URL
// ============================================================

export const APPS_SCRIPT_URL = 'https://script.google.com/macros/library/d/10xxPLy3Ua_fx9UBPDDGYr0JHcXl5OrCJvF6-AMqtwgpyrvF7QMvnq2mR/2';

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;

export function isConfigured() {
  return APPS_SCRIPT_URL && APPS_SCRIPT_URL !== 'https://script.google.com/macros/library/d/10xxPLy3Ua_fx9UBPDDGYr0JHcXl5OrCJvF6-AMqtwgpyrvF7QMvnq2mR/2';
}

// Internal: fetch with exponential back-off retry
async function fetchWithRetry(url, options = {}, attempt = 1) {
  try {
    const res = await fetch(url, { redirect: 'follow', ...options });
    const text = await res.text();
    const json = JSON.parse(text);
    if (!json.success) throw new Error(json.error || 'API Error');
    return json.data;
  } catch (err) {
    if (attempt >= RETRY_ATTEMPTS) throw err;
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    return fetchWithRetry(url, options, attempt + 1);
  }
}

// ── Public API ────────────────────────────────────────────────

// GET all tasks from Google Sheets
export async function fetchAllTasks() {
  return fetchWithRetry(`${APPS_SCRIPT_URL}?action=getAll`);
}

// POST create — uses text/plain to avoid CORS preflight
export async function createTask(task) {
  return fetchWithRetry(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'create', data: task }),
  });
}

// POST update
export async function updateTask(task) {
  return fetchWithRetry(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'update', data: task }),
  });
}

// POST delete
export async function deleteTask(id) {
  return fetchWithRetry(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'delete', id: String(id) }),
  });
}
