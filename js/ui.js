// ============================================================
// ui.js — All rendering & DOM logic. No API calls here.
// ============================================================
import * as State from './state.js';

// Chart instances (kept alive — data updated, never destroyed)
let _deptChart   = null;
let _statusChart = null;
// Kanban card registry: taskId → card DOM element
const _cardMap   = new Map();

// ── Mobile Sidebar ────────────────────────────────────────────
export function openSidebar() {
  document.body.classList.add('sidebar-open');
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar, { once: true });
}

export function closeSidebar() {
  document.body.classList.remove('sidebar-open');
}

// ── Tab Switching ─────────────────────────────────────────────
export function switchTab(tab) {
  ['dashboard','tasks','kanban'].forEach(v => {
    document.getElementById('view-'+v).classList.add('hidden');
    document.getElementById('btn-'+v).className =
      'w-full flex items-center gap-4 px-4 py-3.5 text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl transition-all font-medium';
  });
  const activeClass = 'w-full flex items-center gap-4 px-4 py-3.5 bg-gradient-to-r from-brand-600 to-brand-800 text-white rounded-xl shadow-lg shadow-brand-900/50 transition-all font-medium';
  document.getElementById('view-'+tab).classList.remove('hidden');
  document.getElementById('btn-'+tab).className = activeClass;
  const titles = { dashboard:'لوحة القيادة والمؤشرات', tasks:'قائمة المهام التفصيلية', kanban:'لوحة الإنجاز (Kanban)' };
  document.getElementById('page-title').innerText = titles[tab];
  // Auto-close sidebar on mobile after navigation
  closeSidebar();
}

// ── Dashboard ─────────────────────────────────────────────────
export function updateDashboard() {
  const tasks   = State.getTasks();
  const total   = tasks.length;
  const done    = tasks.filter(t=>t.status==='Done').length;
  const inProg  = tasks.filter(t=>t.status==='In Progress').length;
  const overdue = tasks.filter(t=>isOverdue(t.deadline,t.status)).length;
  const overall = total===0 ? 0 : Math.round(tasks.reduce((s,t)=>s+t.progress,0)/total);

  animateValue('kpi-total',   0, total,   800);
  animateValue('kpi-done',    0, done,    800);
  animateValue('kpi-progress',0, inProg,  800);
  animateValue('kpi-overdue', 0, overdue, 800);
  document.getElementById('overall-progress-text').innerText = overall+'%';
  document.getElementById('overall-progress-bar').style.width = overall+'%';
  updateCharts(tasks);
}

function animateValue(id, start, end, dur) {
  const el = document.getElementById(id);
  if (!el || start===end) { if(el) el.innerText=end; return; }
  const range=end-start, step=Math.abs(Math.floor(dur/Math.max(range,1)));
  let cur=start;
  const t=setInterval(()=>{ cur+=end>start?1:-1; el.innerText=cur; if(cur===end)clearInterval(t); },step);
}

// ── Charts (update data only — never destroy/recreate) ────────
export function updateCharts(tasks) {
  Chart.defaults.font.family="'Tajawal',sans-serif";
  Chart.defaults.color='#64748b';

  const depts={}, statusCounts={'Done':0,'In Progress':0,'Not Started':0};
  tasks.forEach(t=>{ depts[t.dept]=(depts[t.dept]||0)+1; statusCounts[t.status]++; });

  const deptLabels=Object.keys(depts), deptData=Object.values(depts);
  const statusData=[statusCounts['Done'],statusCounts['In Progress'],statusCounts['Not Started']];

  if (_deptChart) {
    _deptChart.data.labels = deptLabels;
    _deptChart.data.datasets[0].data = deptData;
    _deptChart.update('active');
  } else {
    const ctx=document.getElementById('deptChart').getContext('2d');
    const grad=ctx.createLinearGradient(0,0,0,400);
    grad.addColorStop(0,'#0d9488'); grad.addColorStop(1,'#3b82f6');
    _deptChart=new Chart(ctx,{type:'bar',data:{labels:deptLabels,datasets:[{label:'عدد المهام',data:deptData,backgroundColor:grad,borderRadius:8,borderSkipped:false,barThickness:30}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f1f5f9',drawBorder:false}},x:{grid:{display:false,drawBorder:false}}}}});
  }

  if (_statusChart) {
    _statusChart.data.datasets[0].data = statusData;
    _statusChart.update('active');
  } else {
    const ctx2=document.getElementById('statusChart').getContext('2d');
    _statusChart=new Chart(ctx2,{type:'doughnut',data:{labels:['مكتملة','قيد التنفيذ','لم تبدأ بعد'],datasets:[{data:statusData,backgroundColor:['#10b981','#f59e0b','#64748b'],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'75%',plugins:{legend:{position:'bottom',labels:{padding:20,usePointStyle:true,pointStyle:'circle'}}}}});
  }
}

// ── Table ─────────────────────────────────────────────────────
export function renderTable(filtered) {
  const tbody   = document.getElementById('tasks-tbody');
  const empty   = document.getElementById('empty-state');
  const paged   = State.getPaged(filtered);

  hideSkeleton();

  if (filtered.length===0) { tbody.innerHTML=''; empty.classList.remove('hidden'); renderPagination(0); return; }
  empty.classList.add('hidden');

  // Build fragment — full replace for simplicity; partial update on large lists via keyed diff
  const frag = document.createDocumentFragment();
  paged.forEach(task => frag.appendChild(_buildRow(task)));
  tbody.innerHTML = '';
  tbody.appendChild(frag);
  renderPagination(filtered.length);
}

function _buildRow(task) {
  const overdue = isOverdue(task.deadline, task.status);
  const tr = document.createElement('tr');
  tr.className = overdue ? 'bg-red-50/50 hover:bg-red-50 transition-colors' : 'hover:bg-gray-50/80 transition-colors';
  tr.dataset.id = task.id;

  const statusHtml = task.status==='Done'
    ? `<span class="badge badge-done">مكتملة</span>`
    : task.status==='In Progress'
    ? `<span class="badge badge-progress">قيد التنفيذ</span>`
    : `<span class="badge badge-notstarted">لم تبدأ</span>`;

  const prioIcon = task.priority==='High'
    ? `<i class="fa-solid fa-arrow-up text-red-500 bg-red-100 p-1.5 rounded-md"></i>`
    : task.priority==='Medium'
    ? `<i class="fa-solid fa-minus text-amber-500 bg-amber-100 p-1.5 rounded-md"></i>`
    : `<i class="fa-solid fa-arrow-down text-emerald-500 bg-emerald-100 p-1.5 rounded-md"></i>`;

  const progressColor = task.progress===100 ? 'bg-emerald-500' : 'bg-brand-500';

  tr.innerHTML = `
    <td class="px-6 py-4">
      <div class="font-bold text-gray-800">${escHtml(task.name)}</div>
      ${overdue?`<span class="text-xs text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded mt-1 inline-block"><i class="fa-solid fa-triangle-exclamation"></i> متأخرة</span>`:''}
    </td>
    <td class="px-6 py-4 text-gray-600 font-medium">${escHtml(task.dept)}</td>
    <td class="px-6 py-4">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 flex items-center justify-center font-bold shadow-sm">${escHtml(task.assignee.charAt(0))}</div>
        <span class="font-bold text-gray-700">${escHtml(task.assignee)}</span>
      </div>
    </td>
    <td class="px-6 py-4 text-gray-600 font-medium" dir="ltr">${escHtml(task.deadline)}</td>
    <td class="px-6 py-4 text-center">${prioIcon}</td>
    <td class="px-6 py-4">${statusHtml}</td>
    <td class="px-6 py-4 w-40">
      <div class="flex items-center gap-3">
        <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div class="${progressColor} h-full rounded-full" style="width:${task.progress}%"></div>
        </div>
        <span class="text-xs font-extrabold text-gray-700 w-8">${task.progress}%</span>
      </div>
    </td>
    <td class="px-6 py-4 text-center">
      <div class="flex justify-center gap-2">
        <button data-action="edit" data-id="${task.id}" class="text-brand-600 hover:text-white bg-brand-50 hover:bg-brand-500 p-2.5 rounded-xl transition-all shadow-sm" title="تعديل"><i class="fa-solid fa-pen"></i></button>
        <button data-action="delete" data-id="${task.id}" class="text-red-500 hover:text-white bg-red-50 hover:bg-red-500 p-2.5 rounded-xl transition-all shadow-sm" title="حذف"><i class="fa-solid fa-trash"></i></button>
      </div>
    </td>`;
  return tr;
}

// ── Skeleton Loader ───────────────────────────────────────────
export function showSkeleton() {
  const tbody = document.getElementById('tasks-tbody');
  let html = '';
  for(let i=0;i<6;i++) html += `<tr class="border-b border-gray-100"><td class="px-6 py-4" colspan="8"><div class="skeleton h-8 w-full"></div></td></tr>`;
  tbody.innerHTML = html;
  document.getElementById('empty-state').classList.add('hidden');
}
function hideSkeleton() {
  // skeleton rows replaced when tbody is overwritten
}

// ── Kanban Board ──────────────────────────────────────────────
export function renderKanban() {
  const tasks = State.getTasks();
  const cols  = { 'Not Started': document.getElementById('kanban-notstarted'), 'In Progress': document.getElementById('kanban-inprogress'), 'Done': document.getElementById('kanban-done') };
  const counts= { 'Not Started':0, 'In Progress':0, 'Done':0 };

  // Move/create cards — avoid full rebuild
  const seen = new Set();
  tasks.forEach(task => {
    counts[task.status]++;
    seen.add(String(task.id));
    let card = _cardMap.get(String(task.id));
    if (!card) { card = _buildKanbanCard(task); _cardMap.set(String(task.id), card); }
    else _updateKanbanCard(card, task);
    cols[task.status].appendChild(card); // moves if already in DOM
  });

  // Remove stale cards
  _cardMap.forEach((card, id) => { if(!seen.has(id)) { card.remove(); _cardMap.delete(id); } });

  document.getElementById('count-notstarted').innerText = counts['Not Started'];
  document.getElementById('count-progress').innerText   = counts['In Progress'];
  document.getElementById('count-done').innerText       = counts['Done'];
}

function _buildKanbanCard(task) {
  const card = document.createElement('div');
  _updateKanbanCard(card, task);
  card.draggable = true;
  card.addEventListener('dragstart', e => e.dataTransfer.setData('taskId', task.id));
  return card;
}

function _updateKanbanCard(card, task) {
  const overdue = isOverdue(task.deadline, task.status);
  const borderColor = task.status==='Done' ? 'border-l-brand-500' : task.status==='In Progress' ? 'border-l-accent' : 'border-l-slate-400';
  const prioColor   = task.priority==='High' ? 'text-red-500' : task.priority==='Medium' ? 'text-amber-500' : 'text-emerald-500';
  card.className = `kanban-card bg-white p-4 rounded-xl border border-gray-100 border-l-4 ${borderColor} shadow-sm hover:shadow-md`;
  card.dataset.id = task.id;
  card.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <span class="text-[11px] font-bold text-gray-500 bg-gray-100/80 px-2 py-1 rounded-md">${escHtml(task.dept)}</span>
      <i class="fa-solid fa-flag ${prioColor} text-[10px]"></i>
    </div>
    <h4 class="font-bold text-gray-800 text-sm mb-2 leading-snug">${escHtml(task.name)}</h4>
    <p class="text-[11px] ${overdue?'text-red-600 font-bold':'text-gray-500'} mb-4">${overdue?'⚠ متأخرة — ':''}<span dir="ltr">${escHtml(task.deadline)}</span></p>
    <div class="flex justify-between items-center mt-auto pt-4 border-t border-gray-100 -mx-4 px-4">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-700">${escHtml(task.assignee.charAt(0))}</div>
        <span class="text-[11px] font-bold text-gray-600">${escHtml(task.assignee.split(' ')[0])}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button data-action="edit" data-id="${task.id}" class="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white transition-all" title="تعديل"><i class="fa-solid fa-pen text-[10px]"></i></button>
        <button data-action="delete" data-id="${task.id}" class="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all" title="حذف"><i class="fa-solid fa-trash text-[10px]"></i></button>
      </div>
    </div>`;
}

// ── Pagination ────────────────────────────────────────────────
export function renderPagination(total) {
  const ctrl = document.getElementById('pagination-controls');
  if (!ctrl) return;
  const page  = State.getPage();
  const pages = State.getTotalPages(Array(total));

  if (pages <= 1) { ctrl.innerHTML=''; return; }

  let html = `<button class="page-btn" id="btn-prev" ${page===1?'disabled':''}>&#8592;</button>`;
  for (let i=1;i<=pages;i++) html += `<button class="page-btn ${i===page?'active':''}" data-page="${i}">${i}</button>`;
  html += `<button class="page-btn" id="btn-next" ${page===pages?'disabled':''}>&#8594;</button>`;
  html += `<span class="text-sm text-gray-500 font-medium mr-2">صفحة ${page} من ${pages}</span>`;
  ctrl.innerHTML = html;
}

// ── Modal ─────────────────────────────────────────────────────
export function openModal(taskId=null) {
  const modal   = document.getElementById('task-modal');
  const content = document.getElementById('task-modal-content');
  modal.classList.remove('hidden');
  setTimeout(()=>{ modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); },10);
  if (taskId) {
    document.getElementById('modal-title').innerText = 'تعديل بيانات المهمة';
    _fillForm(taskId);
  } else {
    document.getElementById('modal-title').innerText = 'إضافة مهمة جديدة';
    document.getElementById('task-form').reset();
    document.getElementById('task-id').value='';
    document.getElementById('progress-val').innerText='0%';
    document.getElementById('task-start').value=new Date().toISOString().split('T')[0];
  }
}

export function closeModal() {
  const modal   = document.getElementById('task-modal');
  const content = document.getElementById('task-modal-content');
  modal.classList.add('opacity-0');
  content.classList.add('scale-95');
  setTimeout(()=>modal.classList.add('hidden'),300);
}

function _fillForm(id) {
  const task = State.getTaskById(id);
  if (!task) return;
  document.getElementById('task-id').value        = task.id;
  document.getElementById('task-name').value       = task.name;
  document.getElementById('task-dept').value       = task.dept;
  document.getElementById('task-assignee').value   = task.assignee;
  document.getElementById('task-start').value      = task.startDate;
  document.getElementById('task-deadline').value   = task.deadline;
  document.getElementById('task-priority').value   = task.priority;
  document.getElementById('task-status').value     = task.status;
  document.getElementById('task-progress').value   = task.progress;
  document.getElementById('task-notes').value      = task.notes || '';
  updateProgressLabel();
}

export function autoUpdateProgress() {
  const s = document.getElementById('task-status').value;
  const p = document.getElementById('task-progress');
  if (s==='Done') p.value=100;
  else if (s==='Not Started') p.value=0;
  else if ((p.value==0||p.value==100)) p.value=50;
  updateProgressLabel();
}

export function updateProgressLabel() {
  const val=document.getElementById('task-progress').value;
  document.getElementById('progress-val').innerText=val+'%';
  const sel=document.getElementById('task-status');
  if(val==100) sel.value='Done';
  else if(val==0) sel.value='Not Started';
  else sel.value='In Progress';
}

export function getFormData() {
  const id=document.getElementById('task-id').value;
  return {
    id:       id ? String(id) : String(Date.now()),
    name:     document.getElementById('task-name').value,
    dept:     document.getElementById('task-dept').value,
    assignee: document.getElementById('task-assignee').value,
    startDate:document.getElementById('task-start').value,
    deadline: document.getElementById('task-deadline').value,
    priority: document.getElementById('task-priority').value,
    status:   document.getElementById('task-status').value,
    progress: parseInt(document.getElementById('task-progress').value),
    notes:    document.getElementById('task-notes').value,
    _isEdit:  !!id
  };
}

// ── Sync / Offline Indicators ─────────────────────────────────
export function setSyncStatus(status) {
  // status: 'syncing' | 'synced' | 'error' | 'offline'
  const dot  = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  if (!dot) return;
  dot.className = status;
  const labels = { syncing:'جاري التزامن...', synced:'تمت المزامنة', error:'خطأ في المزامنة', offline:'غير متصل' };
  if (text) text.innerText = labels[status] || '';
}

export function showOfflineBanner(show) {
  document.getElementById('offline-banner')?.classList.toggle('show', show);
}

// ── Toast Notifications ───────────────────────────────────────
const ICONS = { success:'fa-circle-check', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
const TITLES= { success:'نجاح', error:'خطأ', warning:'تحذير', info:'معلومة' };

export function showToast(message, type='info', duration=4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${ICONS[type]} toast-icon"></i>
    <div class="toast-body">
      <div class="toast-title">${TITLES[type]}</div>
      <div class="toast-msg">${escHtml(message)}</div>
    </div>
    <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>`;
  container.appendChild(toast);
  toast.querySelector('.toast-close').onclick = () => _dismissToast(toast);
  setTimeout(() => _dismissToast(toast), duration);
}

function _dismissToast(toast) {
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 350);
}

// ── Delete Confirm Modal ──────────────────────────────────────
export function confirmDelete(onConfirm) {
  const box = document.createElement('div');
  box.className='fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center backdrop-blur-sm opacity-0 transition-opacity duration-300';
  box.innerHTML=`<div class="bg-white p-8 rounded-3xl shadow-2xl max-w-sm text-center transform scale-95 transition-transform duration-300">
    <div class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5"><i class="fa-solid fa-trash-can text-4xl text-red-500"></i></div>
    <h3 class="text-xl font-bold mb-2 text-gray-800">تأكيد الحذف</h3>
    <p class="text-gray-500 mb-6 font-medium">هل أنت متأكد من حذف هذه المهمة نهائياً؟</p>
    <div class="flex gap-4 justify-center">
      <button id="_del-cancel" class="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">إلغاء</button>
      <button id="_del-confirm" class="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg transition-colors">نعم، احذف</button>
    </div></div>`;
  document.body.appendChild(box);
  setTimeout(()=>{ box.classList.remove('opacity-0'); box.children[0].classList.remove('scale-95'); },10);
  const close=()=>{ box.classList.add('opacity-0'); box.children[0].classList.add('scale-95'); setTimeout(()=>box.remove(),300); };
  box.querySelector('#_del-cancel').onclick  = close;
  box.querySelector('#_del-confirm').onclick = ()=>{ close(); onConfirm(); };
}

// ── Export CSV ────────────────────────────────────────────────
export function exportToCSV(tasks) {
  if(!tasks.length){ showToast('لا توجد بيانات للتصدير','warning'); return; }
  const esc=s=>`"${String(s).replace(/"/g,'""')}"`;
  let csv='\uFEFF' + ['الرقم','عنوان المهمة','القسم','المسؤول','تاريخ البدء','الموعد النهائي','الأولوية','الحالة','نسبة الإنجاز','ملاحظات'].join(',')+'\r\n';
  tasks.forEach(t=>{ csv+=[t.id,esc(t.name),esc(t.dept),esc(t.assignee),t.startDate,t.deadline,t.priority,t.status,t.progress+'%',esc(t.notes||'')].join(',')+'\r\n'; });
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`تقرير_المهام_${new Date().toISOString().split('T')[0]}.csv`; a.style.display='none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── Filter Helper (exported for app.js) ──────────────────────
export function filterTasks(tasks, search, dept, status) {
  const q=search.toLowerCase();
  return tasks.filter(t=>{
    const matchSearch=!q||(t.name.toLowerCase().includes(q)||t.assignee.toLowerCase().includes(q));
    const matchDept  = dept==='all'   || t.dept===dept;
    const matchStatus= status==='all' || t.status===status;
    return matchSearch&&matchDept&&matchStatus;
  }).sort((a,b)=>{
    const ao=isOverdue(a.deadline,a.status), bo=isOverdue(b.deadline,b.status);
    if(ao&&!bo)return -1; if(!ao&&bo)return 1;
    return new Date(a.deadline)-new Date(b.deadline);
  });
}

// ── Utilities ─────────────────────────────────────────────────
export function isOverdue(deadline, status) {
  if(status==='Done'||!deadline)return false;
  const today=new Date(); today.setHours(0,0,0,0);
  return new Date(deadline)<today;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
