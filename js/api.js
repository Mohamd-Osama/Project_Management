// ============================================================
// api.js — Google Apps Script communication layer
// ⚠️  Replace APPS_SCRIPT_URL with your deployed Web App URL
// ============================================================

export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxb7bSRJoA1fzyLXaxV981ogI6ixIsVI2RZ4FhmJsRxeTHSnU38CBUH-p_5lgyvOcI/exec';

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;

// Returns true if the URL has been set to a real Apps Script deployment URL
export function isConfigured() {
  return !!APPS_SCRIPT_URL &&
    !APPS_SCRIPT_URL.includes('https://script.google.com/macros/s/AKfycbzxb7bSRJoA1fzyLXaxV981ogI6ixIsVI2RZ4FhmJsRxeTHSnU38CBUH-p_5lgyvOcI/exec') &&
    APPS_SCRIPT_URL.startsWith('https://script.google.com/macros/s/');
}

// Internal: fetch with exponential back-off retry
async function fetchWithRetry(url, options = {}, attempt = 1) {
  try {
    const res = await fetch(url, { redirect: 'follow', mode: 'cors', ...options });
    // Apps Script may return non-200 on redirect — still try to parse body
    const text = await res.text();
    if (!text) throw new Error('Empty response from server');
    let json;
    try { json = JSON.parse(text); }
    catch (_) { throw new Error('Invalid JSON from server: ' + text.slice(0, 120)); }
    if (!json.success) throw new Error(json.error || 'API returned failure');
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
