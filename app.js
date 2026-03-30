
const APP_VERSION = 'V0.1';
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const RESUMABLE_CHUNK_SIZE = 8 * 1024 * 1024;
const SETTINGS_KEY = 'drive-share-hub-settings';
const THEME_KEY = 'drive-share-hub-theme';
const GOOGLE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive';

const state = {
  settings: { clientId: '', apiKey: '', folderId: '', appTitle: '', supportsAllDrives: true },
  theme: 'light',
  gapiReady: false, gisReady: false, initialized: false,
  tokenClient: null, accessToken: null, selectedFile: null,
  files: [], user: null, deferredPrompt: null,
};

const el = {
  noticeBar: document.getElementById('noticeBar'),
  authStateBadge: document.getElementById('authStateBadge'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  installBtn: document.getElementById('installBtn'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  fileInput: document.getElementById('fileInput'),
  selectedFileLabel: document.getElementById('selectedFileLabel'),
  metaName: document.getElementById('metaName'),
  metaSize: document.getElementById('metaSize'),
  metaFolder: document.getElementById('metaFolder'),
  uploadBtn: document.getElementById('uploadBtn'),
  clearFileBtn: document.getElementById('clearFileBtn'),
  uploadProgress: document.getElementById('uploadProgress'),
  uploadProgressText: document.getElementById('uploadProgressText'),
  uploadStatusText: document.getElementById('uploadStatusText'),
  filesTbody: document.getElementById('filesTbody'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  fileRowTemplate: document.getElementById('fileRowTemplate'),
  clientIdInput: document.getElementById('clientIdInput'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  folderIdInput: document.getElementById('folderIdInput'),
  appTitleInput: document.getElementById('appTitleInput'),
  allDrivesInput: document.getElementById('allDrivesInput'),
  settingsForm: document.getElementById('settingsForm'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  clearSettingsBtn: document.getElementById('clearSettingsBtn'),
  accountState: document.getElementById('accountState'),
  accountEmail: document.getElementById('accountEmail'),
  accountName: document.getElementById('accountName'),
  accountFolder: document.getElementById('accountFolder'),
  folderWritable: document.getElementById('folderWritable'),
  folderDeletable: document.getElementById('folderDeletable'),
  permissionSummary: document.getElementById('permissionSummary'),
};
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const views = Array.from(document.querySelectorAll('.view'));

function loadSettings(){ const raw = localStorage.getItem(SETTINGS_KEY); if(!raw) return; try{ state.settings = { ...state.settings, ...JSON.parse(raw) }; }catch(e){ console.warn(e); } }
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); }
function loadTheme(){ state.theme = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; applyTheme(); }
function applyTheme(){ document.documentElement.dataset.theme = state.theme; el.themeToggleBtn.textContent = state.theme === 'dark' ? '☀️ 淺色' : '🌙 深色'; }
function toggleTheme(){ state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(THEME_KEY, state.theme); applyTheme(); }
function showNotice(message, type='info'){ el.noticeBar.textContent = message; el.noticeBar.classList.remove('hidden'); el.noticeBar.style.borderColor = type === 'error' ? 'var(--danger)' : 'var(--border)'; }
function clearNotice(){ el.noticeBar.textContent = ''; el.noticeBar.classList.add('hidden'); }
function switchView(viewId){ tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId)); views.forEach(v => v.classList.toggle('active', v.id === viewId)); }
function syncSettingsForm(){
  el.clientIdInput.value = state.settings.clientId || '';
  el.apiKeyInput.value = state.settings.apiKey || '';
  el.folderIdInput.value = state.settings.folderId || '';
  el.appTitleInput.value = state.settings.appTitle || '';
  el.allDrivesInput.checked = state.settings.supportsAllDrives !== false;
  el.metaFolder.textContent = state.settings.folderId || '未設定';
  el.accountFolder.textContent = state.settings.folderId || '—';
  document.title = `${state.settings.appTitle || 'Drive Share Hub'} ${APP_VERSION}`;
}
function getSettingsFromForm(){ return { clientId: el.clientIdInput.value.trim(), apiKey: el.apiKeyInput.value.trim(), folderId: el.folderIdInput.value.trim(), appTitle: el.appTitleInput.value.trim(), supportsAllDrives: !!el.allDrivesInput.checked }; }
function formatBytesToMB(bytes){ if(bytes === undefined || bytes === null || bytes === '') return '—'; return (Number(bytes)/(1024*1024)).toFixed(2); }
function getFileExtension(fileName, explicitExt){ if(explicitExt) return explicitExt; const parts = String(fileName||'').split('.'); return parts.length > 1 ? parts.pop().toLowerCase() : '—'; }
function formatDateTime(iso){ if(!iso) return {date:'—', time:'—'}; const d = new Date(iso); return { date: d.toLocaleDateString('zh-TW'), time: d.toLocaleTimeString('zh-TW', {hour12:false}) }; }
function updateSelectedFile(file){ state.selectedFile = file || null; if(!file){ el.selectedFileLabel.textContent='拖曳檔案到此，或點擊選取檔案'; el.metaName.textContent='—'; el.metaSize.textContent='—'; el.fileInput.value=''; return; } el.selectedFileLabel.textContent=`已選取：${file.name}`; el.metaName.textContent=file.name; el.metaSize.textContent=`${formatBytesToMB(file.size)} MB`; }
function updateUploadProgress(percent, statusText){ const value = Math.max(0, Math.min(100, Math.round(percent))); el.uploadProgress.value = value; el.uploadProgressText.textContent = `${value}%`; if(statusText) el.uploadStatusText.textContent = statusText; }
function resetUploadProgress(){ updateUploadProgress(0, '等待上傳'); }
function validateSettings(settings = state.settings){ if(!settings.clientId) return '請先在設定頁填入 Google OAuth Client ID。'; if(!settings.apiKey) return '請先在設定頁填入 Google API Key。'; if(!settings.folderId) return '請先在設定頁填入 Google Drive Folder ID。'; return ''; }
function updateAuthUi(){ const loggedIn = !!state.accessToken; el.authStateBadge.textContent = loggedIn ? '已登入 Google' : '尚未登入'; el.accountState.textContent = loggedIn ? '已登入' : '未登入'; el.accountEmail.textContent = state.user?.email || '—'; el.accountName.textContent = state.user?.name || '—'; }

async function initializeGoogleClients(force=false){
  const validation = validateSettings(); if(validation) throw new Error(validation);
  if(!state.gapiReady || !state.gisReady) throw new Error('Google SDK 尚未載入完成，請稍後再試。');
  if(state.initialized && !force) return;
  await gapi.client.init({ apiKey: state.settings.apiKey, discoveryDocs: [GOOGLE_DISCOVERY_DOC] });
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.settings.clientId,
    scope: GOOGLE_SCOPE,
    callback: async (response) => {
      if(response.error){ showNotice(`Google 登入失敗：${response.error}`, 'error'); return; }
      state.accessToken = response.access_token;
      gapi.client.setToken({ access_token: state.accessToken });
      await fetchCurrentUser(); updateAuthUi(); showNotice('Google Drive 授權成功。');
      try{ await Promise.all([loadFolderSummary(), refreshFiles()]); }catch(error){ showNotice(error.message, 'error'); }
    }
  });
  state.initialized = true;
}
function requestAccessToken(prompt='consent'){ if(!state.tokenClient) throw new Error('Google Token Client 尚未初始化。'); state.tokenClient.requestAccessToken({ prompt }); }
async function login(){ clearNotice(); await initializeGoogleClients(); requestAccessToken(state.accessToken ? '' : 'consent'); }
function logout(){
  if(state.accessToken && google?.accounts?.oauth2){
    google.accounts.oauth2.revoke(state.accessToken, () => {
      state.accessToken = null; state.user = null; if(window.gapi?.client?.setToken) gapi.client.setToken(null);
      updateAuthUi(); renderFiles([]); el.permissionSummary.textContent = '尚未讀取。'; el.folderWritable.textContent='—'; el.folderDeletable.textContent='—'; showNotice('已登出 Google 帳號。');
    });
  } else { state.accessToken = null; state.user = null; updateAuthUi(); }
}

async function googleApiFetch(url, options={}, allowStatuses=[]){
  if(!state.accessToken) throw new Error('請先登入 Google。');
  const headers = new Headers(options.headers || {}); headers.set('Authorization', `Bearer ${state.accessToken}`);
  const response = await fetch(url, { ...options, headers });
  if(response.ok || allowStatuses.includes(response.status)) return response;
  let message = `Google API 錯誤 (${response.status})`;
  try{ const err = await response.json(); message = err.error?.message || message; }catch(_e){}
  throw new Error(message);
}
async function fetchCurrentUser(){ if(!state.accessToken) return null; const res = await googleApiFetch('https://www.googleapis.com/oauth2/v2/userinfo'); state.user = await res.json(); updateAuthUi(); return state.user; }
function buildDriveQueryParams(extra={}){ const params = new URLSearchParams(extra); if(state.settings.supportsAllDrives){ params.set('supportsAllDrives','true'); params.set('includeItemsFromAllDrives','true'); } return params; }
async function loadFolderSummary(){
  const folderId = state.settings.folderId; if(!folderId) throw new Error('尚未設定目標資料夾 ID。');
  const params = buildDriveQueryParams({ fields: 'id,name,mimeType,capabilities(canAddChildren,canDelete,canShare,canListChildren),permissions(id,displayName,emailAddress,role,type)' });
  const res = await googleApiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?${params.toString()}`);
  const folder = await res.json();
  el.folderWritable.textContent = folder.capabilities?.canAddChildren ? '是' : '否';
  el.folderDeletable.textContent = folder.capabilities?.canDelete ? '是' : '否';
  const permissions = (folder.permissions || []).slice(0, 20).map(item => `${item.emailAddress || item.displayName || item.type || '未命名'}（${item.role}）`);
  el.permissionSummary.textContent = permissions.length ? permissions.join('、') : '查無權限資料（可能是欄位限制或權限不足）。';
  return folder;
}
function sortFiles(files){ const mode = el.sortSelect.value; const [field, direction] = mode.split('_'); const sign = direction === 'desc' ? -1 : 1; return [...files].sort((a,b)=>{ if(field==='createdTime') return (new Date(a.createdTime)-new Date(b.createdTime))*sign; if(field==='size') return ((Number(a.size)||0)-(Number(b.size)||0))*sign; return String(a.name||'').localeCompare(String(b.name||''), 'zh-Hant')*sign; }); }
function getFilteredFilesFrom(list){ const keyword = el.searchInput.value.trim().toLowerCase(); const filtered = list.filter(file => { if(!keyword) return true; const owner = file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || ''; const ext = getFileExtension(file.name, file.fileExtension); return [file.name, owner, ext].join(' ').toLowerCase().includes(keyword); }); return sortFiles(filtered); }
function renderFiles(files){
  const list = Array.isArray(files) ? files : []; const finalList = getFilteredFilesFrom(list); el.filesTbody.innerHTML='';
  if(!finalList.length){ el.filesTbody.innerHTML = '<tr><td colspan="8" class="empty">目前沒有可顯示的檔案。</td></tr>'; return; }
  const fragment = document.createDocumentFragment();
  for(const file of finalList){
    const row = el.fileRowTemplate.content.firstElementChild.cloneNode(true);
    const owner = file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || '—';
    const dt = formatDateTime(file.createdTime);
    row.querySelector('.filename-cell').textContent = file.name || '未命名檔案';
    row.querySelector('.date-cell').textContent = dt.date;
    row.querySelector('.time-cell').textContent = dt.time;
    row.querySelector('.owner-cell').textContent = owner;
    row.querySelector('.size-cell').textContent = formatBytesToMB(file.size);
    row.querySelector('.ext-cell').textContent = getFileExtension(file.name, file.fileExtension);
    row.querySelector('.download-action').addEventListener('click', ()=>downloadFile(file));
    const deleteBtn = row.querySelector('.delete-action');
    deleteBtn.disabled = !file.capabilities?.canDelete; deleteBtn.title = file.capabilities?.canDelete ? '' : '目前帳號沒有刪除此檔案的權限';
    deleteBtn.addEventListener('click', ()=>deleteFile(file));
    fragment.appendChild(row);
  }
  el.filesTbody.appendChild(fragment);
}
async function refreshFiles(){
  const validation = validateSettings(); if(validation) throw new Error(validation); if(!state.accessToken) throw new Error('請先登入 Google。');
  const query = `'${state.settings.folderId.replace(/'/g, "\'")}' in parents and trashed = false`;
  const params = buildDriveQueryParams({ q: query, pageSize: '200', orderBy: 'createdTime desc', fields: 'files(id,name,size,createdTime,fileExtension,owners(displayName,emailAddress),capabilities(canDelete))' });
  const res = await googleApiFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
  const data = await res.json(); state.files = data.files || []; renderFiles(state.files); return state.files;
}
async function uploadFile(){
  clearNotice(); const validation = validateSettings(); if(validation) throw new Error(validation); if(!state.accessToken) throw new Error('請先登入 Google。');
  const file = state.selectedFile; if(!file) throw new Error('請先選擇一個檔案。'); if(file.size > MAX_FILE_BYTES) throw new Error('單檔不可超過 100 MB。');
  updateUploadProgress(1, '建立上傳工作階段…');
  const metadata = { name: file.name, parents: [state.settings.folderId] };
  const sessionParams = buildDriveQueryParams({ uploadType: 'resumable' });
  const sessionRes = await googleApiFetch(`https://www.googleapis.com/upload/drive/v3/files?${sessionParams.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': file.type || 'application/octet-stream', 'X-Upload-Content-Length': String(file.size) },
    body: JSON.stringify(metadata)
  });
  const sessionUrl = sessionRes.headers.get('Location'); if(!sessionUrl) throw new Error('無法取得 Google Drive 可續傳上傳網址。');
  let uploaded = 0;
  while(uploaded < file.size){
    const chunk = file.slice(uploaded, uploaded + RESUMABLE_CHUNK_SIZE); const end = uploaded + chunk.size - 1;
    updateUploadProgress(Math.round((uploaded / file.size) * 100), `上傳中：${formatBytesToMB(uploaded)} / ${formatBytesToMB(file.size)} MB`);
    const chunkRes = await googleApiFetch(sessionUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${uploaded}-${end}/${file.size}` }, body: chunk }, [308]);
    if(chunkRes.status === 308){ uploaded = end + 1; continue; }
    uploaded = file.size;
  }
  updateUploadProgress(100, '上傳完成，正在重新整理檔案清單…'); showNotice(`檔案「${file.name}」已上傳完成。`); updateSelectedFile(null); await refreshFiles();
}
async function downloadFile(file){ clearNotice(); const params = buildDriveQueryParams({ alt: 'media' }); const res = await googleApiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?${params.toString()}`); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name || 'download'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
async function deleteFile(file){ clearNotice(); if(!window.confirm(`確定要刪除「${file.name}」嗎？`)) return; const params = buildDriveQueryParams(); await googleApiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?${params.toString()}`, { method: 'DELETE' }); showNotice(`檔案「${file.name}」已刪除。`); await refreshFiles(); }
async function handleTestConnection(){ clearNotice(); await initializeGoogleClients(); if(!state.accessToken){ showNotice('請先點「登入 Google」，授權後再測試連線。'); return; } await fetchCurrentUser(); await loadFolderSummary(); showNotice('Google Drive 連線測試成功。'); }
function handleFileInput(event){ updateSelectedFile(event.target.files?.[0] || null); }
function wireDragAndDrop(){ const drop = document.querySelector('.file-drop'); ['dragenter','dragover'].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add('dragover'); })); ['dragleave','drop'].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove('dragover'); })); drop.addEventListener('drop', event => { const file = event.dataTransfer?.files?.[0] || null; if(file) updateSelectedFile(file); }); }
function registerServiceWorker(){ if(!('serviceWorker' in navigator)) return; window.addEventListener('load', async ()=>{ try{ await navigator.serviceWorker.register('sw.js'); }catch(error){ console.warn('Service Worker 註冊失敗', error); } }); }
function setupInstallPrompt(){ window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); state.deferredPrompt = event; el.installBtn.classList.remove('hidden'); }); el.installBtn.addEventListener('click', async ()=>{ if(!state.deferredPrompt) return; state.deferredPrompt.prompt(); await state.deferredPrompt.userChoice; state.deferredPrompt = null; el.installBtn.classList.add('hidden'); }); }
function setupGoogleLoaderWatchers(){ const waitForGapi = window.setInterval(()=>{ if(window.gapi?.load){ clearInterval(waitForGapi); gapi.load('client', ()=>{ state.gapiReady = true; }); } }, 200); const waitForGis = window.setInterval(()=>{ if(window.google?.accounts?.oauth2){ clearInterval(waitForGis); state.gisReady = true; } }, 200); }
function handleSettingsSubmit(event){ event.preventDefault(); clearNotice(); state.settings = getSettingsFromForm(); saveSettings(); syncSettingsForm(); state.initialized = false; showNotice('本機設定已儲存。若剛調整 Client ID / API Key，請重新登入 Google。'); }
function clearLocalSettings(){ localStorage.removeItem(SETTINGS_KEY); state.settings = { clientId:'', apiKey:'', folderId:'', appTitle:'', supportsAllDrives:true }; syncSettingsForm(); state.initialized = false; showNotice('本機設定已清除。'); }
function bindEvents(){ tabButtons.forEach(btn => btn.addEventListener('click', ()=>switchView(btn.dataset.view))); el.themeToggleBtn.addEventListener('click', toggleTheme); el.loginBtn.addEventListener('click', async ()=>{ try{ await login(); }catch(error){ showNotice(error.message, 'error'); } }); el.logoutBtn.addEventListener('click', logout); el.refreshBtn.addEventListener('click', async ()=>{ try{ await refreshFiles(); showNotice('檔案清單已重新整理。'); }catch(error){ showNotice(error.message, 'error'); } }); el.fileInput.addEventListener('change', handleFileInput); el.clearFileBtn.addEventListener('click', ()=>updateSelectedFile(null)); el.uploadBtn.addEventListener('click', async ()=>{ try{ await uploadFile(); }catch(error){ updateUploadProgress(0, '等待上傳'); showNotice(error.message, 'error'); } }); el.searchInput.addEventListener('input', ()=>renderFiles(state.files)); el.sortSelect.addEventListener('change', ()=>renderFiles(state.files)); el.settingsForm.addEventListener('submit', handleSettingsSubmit); el.testConnectionBtn.addEventListener('click', async ()=>{ try{ await handleTestConnection(); }catch(error){ showNotice(error.message, 'error'); } }); el.clearSettingsBtn.addEventListener('click', clearLocalSettings); }
function init(){ loadSettings(); loadTheme(); syncSettingsForm(); updateAuthUi(); resetUploadProgress(); bindEvents(); wireDragAndDrop(); registerServiceWorker(); setupInstallPrompt(); setupGoogleLoaderWatchers(); }
init();
