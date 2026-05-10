// ============================================================
// app.js — Bootstrap: wires API + State + UI together
// ============================================================
import * as API   from './api.js';
import * as State from './state.js';
import * as UI    from './ui.js';

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('current-date').innerText =
    new Date().toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  _wireEvents();
  UI.switchTab('dashboard');

  // 1. Show cached data instantly
  if (State.loadCache()) {
    _refreshAllViews();
    UI.showToast('تم تحميل البيانات المحفوظة مؤقتاً', 'info', 2500);
  }

  // 2. Sync from Google Sheets in background
  await _syncFromSheets();

  // 3. Auto-sync when coming back online
  window.addEventListener('online',  () => { UI.showOfflineBanner(false); _syncFromSheets(); });
  window.addEventListener('offline', () => { UI.showOfflineBanner(true);  UI.setSyncStatus('offline'); });
  if (!State.isOnline()) { UI.showOfflineBanner(true); UI.setSyncStatus('offline'); }
});

// ── Sync from Google Sheets ───────────────────────────────────
async function _syncFromSheets() {
  if (!API.isConfigured()) {
    UI.setSyncStatus('error');
    UI.showToast('⚠ رابط Google Apps Script غير مُعدّ. افتح js/api.js وأدخل رابط النشر.', 'warning', 8000);
    // Do NOT load defaults — show empty state
    _refreshAllViews();
    return;
  }
  if (!State.isOnline()) return;

  UI.setSyncStatus('syncing');
  try {
    const tasks = await API.fetchAllTasks();
    // Always replace state with exactly what the sheet has (empty = empty)
    State.setTasks(tasks);
    _refreshAllViews();
    UI.setSyncStatus('synced');
    const msg = tasks.length === 0
      ? 'الجدول فارغ — أضف مهمتك الأولى!'
      : `تمت المزامنة (${tasks.length} مهمة)`;
    UI.showToast(msg, 'success', 3000);
  } catch (err) {
    UI.setSyncStatus('error');
    UI.showToast('خطأ في الاتصال: ' + err.message, 'error', 6000);
  }
}

// ── Refresh all active views ──────────────────────────────────
function _refreshAllViews() {
  const tasks    = State.getTasks();
  const filtered = _getFiltered();
  UI.updateDashboard();
  UI.renderTable(filtered);
  UI.renderKanban();
}

function _getFiltered() {
  return UI.filterTasks(
    State.getTasks(),
    document.getElementById('filter-search')?.value || '',
    document.getElementById('filter-dept')?.value   || 'all',
    document.getElementById('filter-status')?.value || 'all'
  );
}

// ── Wire all DOM events once ──────────────────────────────────
function _wireEvents() {
  // Sidebar navigation
  document.getElementById('btn-dashboard').addEventListener('click', () => { UI.switchTab('dashboard'); UI.updateDashboard(); });
  document.getElementById('btn-tasks').addEventListener('click',     () => { UI.switchTab('tasks');     UI.renderTable(_getFiltered()); UI.renderPagination(_getFiltered().length); });
  document.getElementById('btn-kanban').addEventListener('click',    () => { UI.switchTab('kanban');    UI.renderKanban(); });

  // Mobile hamburger menu
  document.getElementById('btn-hamburger')?.addEventListener('click', UI.openSidebar);
  document.getElementById('btn-close-sidebar')?.addEventListener('click', UI.closeSidebar);

  // Header "Add Task"
  document.getElementById('btn-add-task').addEventListener('click', () => UI.openModal());

  // Export CSV
  document.getElementById('btn-export').addEventListener('click', () => UI.exportToCSV(State.getTasks()));

  // Reset all data
  document.getElementById('btn-reset').addEventListener('click', _handleReset);

  // Modal form submit
  document.getElementById('task-form').addEventListener('submit', _handleSaveTask);

  // Modal close button
  document.getElementById('btn-close-modal').addEventListener('click', UI.closeModal);
  document.getElementById('task-modal').addEventListener('click', e => { if (e.target===e.currentTarget) UI.closeModal(); });

  // Progress / Status sync in form
  document.getElementById('task-status').addEventListener('change', UI.autoUpdateProgress);
  document.getElementById('task-progress').addEventListener('input', UI.updateProgressLabel);

  // Debounced search
  let _debounce;
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => { State.setPage(1); UI.renderTable(_getFiltered()); }, 350);
  });
  document.getElementById('filter-dept').addEventListener('change',   () => { State.setPage(1); UI.renderTable(_getFiltered()); });
  document.getElementById('filter-status').addEventListener('change', () => { State.setPage(1); UI.renderTable(_getFiltered()); });

  // Delegated: table / kanban edit+delete buttons
  document.getElementById('tasks-tbody').addEventListener('click', _handleTableAction);
  document.getElementById('kanban-notstarted').addEventListener('click', _handleTableAction);
  document.getElementById('kanban-inprogress').addEventListener('click', _handleTableAction);
  document.getElementById('kanban-done').addEventListener('click',       _handleTableAction);

  // Pagination (delegated)
  document.getElementById('pagination-controls').addEventListener('click', e => {
    const btn = e.target.closest('[data-page]');
    const prev = e.target.closest('#btn-prev');
    const next = e.target.closest('#btn-next');
    const page = State.getPage(), pages = State.getTotalPages(_getFiltered());
    if (btn)  { State.setPage(parseInt(btn.dataset.page)); UI.renderTable(_getFiltered()); }
    if (prev && page>1)   { State.setPage(page-1); UI.renderTable(_getFiltered()); }
    if (next && page<pages){ State.setPage(page+1); UI.renderTable(_getFiltered()); }
  });

  // Kanban drag-and-drop
  ['kanban-notstarted','kanban-inprogress','kanban-done'].forEach(colId => {
    const col = document.getElementById(colId);
    const status = colId==='kanban-notstarted' ? 'Not Started' : colId==='kanban-inprogress' ? 'In Progress' : 'Done';
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('drag-over'); _handleDrop(e, status); });
  });
}

// ── Event Handlers ────────────────────────────────────────────
function _handleTableAction(e) {
  const editBtn   = e.target.closest('[data-action="edit"]');
  const deleteBtn = e.target.closest('[data-action="delete"]');
  if (editBtn)   UI.openModal(editBtn.dataset.id);
  if (deleteBtn) UI.confirmDelete(() => _handleDelete(deleteBtn.dataset.id));
}

async function _handleSaveTask(e) {
  e.preventDefault();
  const data = UI.getFormData();
  const isEdit = data._isEdit;
  delete data._isEdit;

  // Optimistic update
  if (isEdit) State.updateTask(data);
  else        State.addTask(data);
  _refreshAllViews();
  UI.closeModal();
  UI.showToast(isEdit ? 'تم تحديث المهمة بنجاح' : 'تمت إضافة المهمة بنجاح', 'success');

  // Persist to Sheets
  if (API.isConfigured() && State.isOnline()) {
    UI.setSyncStatus('syncing');
    try {
      if (isEdit) await API.updateTask(data);
      else        await API.createTask(data);
      UI.setSyncStatus('synced');
    } catch (err) {
      UI.setSyncStatus('error');
      UI.showToast('فشل الحفظ في Google Sheets: ' + err.message, 'error');
    }
  }
}

async function _handleDelete(id) {
  // Optimistic remove
  State.removeTask(id);
  _refreshAllViews();
  UI.showToast('تم حذف المهمة', 'success');

  if (API.isConfigured() && State.isOnline()) {
    UI.setSyncStatus('syncing');
    try {
      await API.deleteTask(id);
      UI.setSyncStatus('synced');
    } catch (err) {
      UI.setSyncStatus('error');
      UI.showToast('فشل الحذف في Google Sheets: ' + err.message, 'error');
    }
  }
}

async function _handleDrop(e, newStatus) {
  const id   = e.dataTransfer.getData('taskId');
  const task = State.getTaskById(id);
  if (!task || task.status===newStatus) return;

  const updated = { ...task, status: newStatus,
    progress: newStatus==='Done' ? 100 : newStatus==='Not Started' ? 0 : (task.progress===0||task.progress===100) ? 50 : task.progress };

  // Optimistic
  State.updateTask(updated);
  UI.renderKanban();
  UI.updateDashboard();
  UI.showToast('تم تحديث حالة المهمة', 'success', 2000);

  if (API.isConfigured() && State.isOnline()) {
    try { await API.updateTask(updated); UI.setSyncStatus('synced'); }
    catch (err) {
      // Revert
      State.updateTask(task);
      UI.renderKanban();
      UI.showToast('فشل التحديث: ' + err.message, 'error');
    }
  }
}

// ── Factory Reset ─────────────────────────────────────────────
async function _handleReset() {
  UI.confirmDelete(async () => {
    // Wipe ALL local storage — no cached tasks survive
    localStorage.clear();
    sessionStorage.clear();
    State.clearCache();          // also resets in-memory array
    _refreshAllViews();          // show empty UI immediately
    UI.showToast('تم مسح جميع البيانات المحلية. جارٍ جلب البيانات من Google Sheets...', 'info', 4000);
    // Re-fetch fresh from the sheet (source of truth)
    await _syncFromSheets();
  });
}

// (No hardcoded defaults — source of truth is Google Sheets only)
