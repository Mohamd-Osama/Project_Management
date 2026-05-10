# إنجاز برو — Injaz Pro Task Management System

> Production-ready Arabic Task Management with Google Sheets backend, deployed on GitHub Pages.

---

## 📁 Project Structure

```
Project Management/
├── index.html              ← Main app (HTML only)
├── css/
│   └── style.css           ← All custom styles
├── js/
│   ├── api.js              ← Google Sheets API calls
│   ├── state.js            ← In-memory state + localStorage cache
│   ├── ui.js               ← All DOM rendering
│   └── app.js              ← Bootstrap + event wiring
└── apps-script/
    └── Code.gs             ← Google Apps Script backend (copy-paste)
```

---

## 🚀 Step 1 — Deploy Google Apps Script

### 1.1 Open your Google Sheet
Go to: [Your Sheet](https://docs.google.com/spreadsheets/d/1Vupl63M1xAxzaI5bHAXzicO0En-3AiDB2l_zeeSLCw8)

### 1.2 Open Apps Script editor
**Extensions → Apps Script**

### 1.3 Paste the backend code
- Delete any existing code in `Code.gs`
- Copy the entire contents of `apps-script/Code.gs`
- Paste it into the editor
- Click **Save** (Ctrl+S)

### 1.4 Deploy as Web App
1. Click **Deploy → New deployment**
2. Click the ⚙️ gear → **Web app**
3. Set:
   - **Description**: `Injaz Pro API v1`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. **Copy the Web App URL** (looks like: `https://script.google.com/macros/s/AKfycb.../exec`)

### 1.5 Paste URL into api.js
Open `js/api.js` and replace line 6:
```js
export const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```
With your copied URL:
```js
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

---

## 🌐 Step 2 — Deploy to GitHub Pages

### 2.1 Create GitHub Repository
1. Go to [github.com](https://github.com) → **New repository**
2. Name it: `injaz-pro` (or anything you like)
3. Set to **Public**
4. Click **Create repository**

### 2.2 Upload your files
Option A — GitHub Web Interface (easiest):
1. Click **uploading an existing file**
2. Drag and drop your entire `Project Management` folder contents
3. Commit with message: `Initial deploy`

Option B — Git CLI:
```bash
cd "c:\Users\mo094\Downloads\Project Management"
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/injaz-pro.git
git push -u origin main
```

### 2.3 Enable GitHub Pages
1. Go to your repo → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` → folder: `/ (root)`
4. Click **Save**

### 2.4 Your live URL
After ~60 seconds, your app will be live at:
```
https://YOUR_USERNAME.github.io/injaz-pro/
```

---

## ✅ Step 3 — Verify Everything Works

| Test | Expected Result |
|------|----------------|
| Open live URL | App loads, shows demo tasks |
| Add a task | Toast "تمت الإضافة" + row appears in Google Sheet |
| Edit a task | Toast "تم التحديث" + sheet row updated |
| Delete a task | Toast "تم الحذف" + row removed from sheet |
| Drag Kanban card | Status updates + sheet updated |
| Turn off WiFi | Offline banner appears, cached data shown |
| Turn WiFi back on | Auto-sync fires, data refreshed |

---

## 🔧 Apps Script CORS Notes

The app uses two strategies to avoid CORS issues:
- **GET requests** → For `getAll` — browsers handle these natively
- **POST with `Content-Type: text/plain`** → For create/update/delete — avoids CORS preflight

If you see CORS errors in browser console:
1. Make sure Apps Script is deployed with **"Anyone"** access (not "Anyone with Google account")
2. Re-deploy: **Deploy → Manage deployments → Edit → Deploy** (create a new version)

---

## 📊 Google Sheet Column Structure

The `Tasks` sheet uses these exact headers (auto-created if missing):

| id | name | dept | assignee | startDate | deadline | priority | status | progress | notes |
|----|------|------|----------|-----------|----------|----------|--------|----------|-------|

---

## ⚡ Performance Features

| Feature | Implementation |
|---------|---------------|
| Chart updates | Data-only update (`chart.update('active')`) — no destroy/recreate |
| Search debounce | 350ms delay before filtering |
| Kanban drag | Moves DOM nodes, no column rebuild |
| Table render | `DocumentFragment` batch insert |
| Optimistic UI | State updated instantly, API called in background |
| Offline cache | `localStorage` as fallback, auto-sync on reconnect |
| Pagination | Max 20 rows per page |
