// ============================================================
// Injaz Pro — Google Apps Script Backend
// Copy this entire file into a new Apps Script project
// Linked to your Google Sheet, then deploy as Web App
// ============================================================

const SHEET_NAME = 'Tasks';
const HEADERS = ['id', 'name', 'dept', 'assignee', 'startDate', 'deadline', 'priority', 'status', 'progress', 'notes'];

// ── Entry Points ─────────────────────────────────────────────
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || 'getAll';
    let result;

    if (action === 'getAll') {
      result = getAllTasks();
    } else if (action === 'create') {
      const data = JSON.parse(decodeURIComponent(e.parameter.data || '{}'));
      result = createTask(data);
    } else if (action === 'update') {
      const data = JSON.parse(decodeURIComponent(e.parameter.data || '{}'));
      result = updateTask(data);
    } else if (action === 'delete') {
      result = deleteTask(e.parameter.id);
    } else {
      throw new Error('Unknown action: ' + action);
    }

    return buildResponse({ success: true, data: result });
  } catch (err) {
    return buildResponse({ success: false, error: err.message });
  }
}

// Also handle POST for flexibility (text/plain body avoids CORS preflight)
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let result;

    if (action === 'create')      result = createTask(payload.data);
    else if (action === 'update') result = updateTask(payload.data);
    else if (action === 'delete') result = deleteTask(payload.id);
    else throw new Error('Unknown action: ' + action);

    return buildResponse({ success: true, data: result });
  } catch (err) {
    return buildResponse({ success: false, error: err.message });
  }
}

function buildResponse(obj) {
  const output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Sheet Helper ─────────────────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // Auto-create headers if missing
  const firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell !== 'id') {
    sheet.clearContents();
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setValues([HEADERS]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0d9488');
    headerRange.setFontColor('#ffffff');
  }
  return sheet;
}

// ── CRUD Operations ──────────────────────────────────────────
function getAllTasks() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(1, 1, lastRow, HEADERS.length).getValues();
  const headers = data[0];

  return data.slice(1)
    .filter(row => row[0] !== '' && row[0] !== null)
    .map(row => {
      const task = {};
      headers.forEach((h, i) => { task[h] = row[i]; });
      task.progress = parseInt(task.progress) || 0;
      return task;
    });
}

function createTask(data) {
  const sheet = getSheet();
  const row = HEADERS.map(h => (data[h] !== undefined && data[h] !== null) ? data[h] : '');
  sheet.appendRow(row);
  // Auto-resize for readability
  sheet.autoResizeColumns(1, HEADERS.length);
  return data;
}

function updateTask(data) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('No tasks found');

  const allData = sheet.getRange(1, 1, lastRow, HEADERS.length).getValues();
  const headers = allData[0];
  const idColIdx = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idColIdx]) === String(data.id)) {
      const updatedRow = HEADERS.map((h, colIdx) => {
        return (data[h] !== undefined && data[h] !== null)
          ? data[h]
          : allData[i][headers.indexOf(h)];
      });
      sheet.getRange(i + 1, 1, 1, HEADERS.length).setValues([updatedRow]);
      return data;
    }
  }
  throw new Error('Task not found with id: ' + data.id);
}

function deleteTask(id) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('No tasks found');

  const allData = sheet.getRange(1, 1, lastRow, HEADERS.length).getValues();
  const idColIdx = allData[0].indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idColIdx]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { deleted: id };
    }
  }
  throw new Error('Task not found with id: ' + id);
}
