
const APP_VERSION = 'V0.7';
const VERSION_ENDPOINT = 'version.json';
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const RESUMABLE_CHUNK_SIZE = 8 * 1024 * 1024;
const SETTINGS_KEY = 'drive-share-hub-settings';
const THEME_KEY = 'drive-share-hub-theme';
const AUTH_CACHE_KEY = 'drive-share-hub-auth-cache';
const GOOGLE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const GOOGLE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive';

const state = {
  settings: { clientId: '', apiKey: '', folderId: '', appTitle: '', supportsAllDrives: true },
  theme: 'light',
  gapiReady: false,
  gisReady: false,
  initialized: false,
  tokenClient: null,
  accessToken: null,
  selectedFiles: [],
  files: [],
  user: null,
  folderMeta: null,
  deferredPrompt: null,
  remoteVersion: null,
  swRegistration: null,
  authCache: { accessToken: '', expiresAt: 0, user: null },
};

const el = {
  noticeBar: document.getElementById('noticeBar'),
  updateBanner: document.getElementById('updateBanner'),
  authStateBadge: document.getElementById('authStateBadge'),
  authStateSubtext: document.getElementById('authStateSubtext'),
  settingsAuthBadge: document.getElementById('settingsAuthBadge'),
  settingsAuthSubtext: document.getElementById('settingsAuthSubtext'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  installBtn: document.getElementById('installBtn'),
  checkUpdateBtn: document.getElementById('checkUpdateBtn'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  pickFilesBtn: document.getElementById('pickFilesBtn'),
  fileInput: document.getElementById('fileInput'),
  selectedCount: document.getElementById('selectedCount'),
  selectedTotalSize: document.getElementById('selectedTotalSize'),
  selectedFilesPreview: document.getElementById('selectedFilesPreview'),
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
  currentVersionText: document.getElementById('currentVersionText'),
  remoteVersionText: document.getElementById('remoteVersionText'),
  appHeading: document.getElementById('appHeading'),
  versionLabel: document.getElementById('versionLabel'),
};

const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const views = Array.from(document.querySelectorAll('.view'));

function extractFolderId(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  const linkMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (linkMatch) return linkMatch[1];
  const idMatch = value.match(/^[a-zA-Z0-9_-]{10,}$/);
  return idMatch ? idMatch[0] : value;
}
function formatBytesToMB(bytes) {
  if (bytes === undefined || bytes === null || bytes === '') return '—';
  return (Number(bytes) / (1024 * 1024)).toFixed(2);
}
function getFileExtension(fileName, explicitExt) {
  if (explicitExt) return explicitExt;
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '—';
}
function formatDateTime(iso) {
  if (!iso) return { date: '—', time: '—' };
  const d = new Date(iso);
  return { date: d.toLocaleDateString('zh-TW'), time: d.toLocaleTimeString('zh-TW', { hour12: false }) };
}
function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    parsed.folderId = extractFolderId(parsed.folderId);
    state.settings = { ...state.settings, ...parsed };
  } catch (error) { console.warn('設定解析失敗', error); }
}
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); }
function loadTheme() { state.theme = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; applyTheme(); }
function applyTheme() { document.documentElement.dataset.theme = state.theme; el.themeToggleBtn.textContent = state.theme === 'dark' ? '☀️ 淺色' : '🌙 深色'; }
function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(THEME_KEY, state.theme); applyTheme(); }
function showNotice(message, type = 'info') { el.noticeBar.textContent = message; el.noticeBar.classList.remove('hidden'); el.noticeBar.style.borderColor = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--border)'; }
function clearNotice() { el.noticeBar.classList.add('hidden'); el.noticeBar.textContent = ''; }
function showUpdateBanner(message, canReload = false) {
  el.updateBanner.innerHTML = '';
  const text = document.createElement('div'); text.textContent = message; el.updateBanner.appendChild(text);
  if (canReload) {
    const actions = document.createElement('div'); actions.className = 'update-actions';
    const reloadBtn = document.createElement('button'); reloadBtn.type = 'button'; reloadBtn.className = 'primary-btn'; reloadBtn.textContent = '立即重整更新'; reloadBtn.addEventListener('click', forceReloadFromServer); actions.appendChild(reloadBtn); el.updateBanner.appendChild(actions);
  }
  el.updateBanner.classList.remove('hidden');
}
function hideUpdateBanner() { el.updateBanner.classList.add('hidden'); el.updateBanner.innerHTML = ''; }
function switchView(viewId) { tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId)); views.forEach((view) => view.classList.toggle('active', view.id === viewId)); }
function renderTableMessage(message, cssClass = '') { el.filesTbody.innerHTML = `<tr><td colspan="8" class="empty ${cssClass}">${message}</td></tr>`; }
function syncSettingsForm() {
  el.clientIdInput.value = state.settings.clientId || '';
  el.apiKeyInput.value = state.settings.apiKey || '';
  el.folderIdInput.value = state.settings.folderId || '';
  el.appTitleInput.value = state.settings.appTitle || '';
  el.allDrivesInput.checked = state.settings.supportsAllDrives !== false;
  el.metaFolder.textContent = state.folderMeta?.name || state.settings.folderId || '未設定';
  el.accountFolder.textContent = state.settings.folderId || '—';
  const title = state.settings.appTitle || 'Drive Share Hub';
  el.appHeading.textContent = title;
  document.title = `${title} ${APP_VERSION}`;
  el.versionLabel.textContent = APP_VERSION;
  el.currentVersionText.textContent = APP_VERSION;
}
function getSettingsFromForm() { return { clientId: el.clientIdInput.value.trim(), apiKey: el.apiKeyInput.value.trim(), folderId: extractFolderId(el.folderIdInput.value.trim()), appTitle: el.appTitleInput.value.trim(), supportsAllDrives: !!el.allDrivesInput.checked }; }
function validateSettings(settings = state.settings) { if (!settings.clientId) return '請先在設定頁填入 Google OAuth Client ID。'; if (!settings.apiKey) return '請先在設定頁填入 Google API Key。'; if (!settings.folderId) return '請先在設定頁填入 Google Drive Folder ID 或資料夾連結。'; return ''; }
function updateSelectedFilesUI() {
  const count = state.selectedFiles.length;
  const totalBytes = state.selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
  el.selectedCount.textContent = String(count);
  el.selectedTotalSize.textContent = `${formatBytesToMB(totalBytes)} MB`;
  el.selectedFilesPreview.innerHTML = '';
  if (!count) {
    const li = document.createElement('li'); li.className = 'muted'; li.textContent = '尚未選取檔案'; el.selectedFilesPreview.appendChild(li); return;
  }
  state.selectedFiles.forEach((file) => { const li = document.createElement('li'); li.textContent = `${file.name}（${formatBytesToMB(file.size)} MB）`; el.selectedFilesPreview.appendChild(li); });
}
function clearSelectedFiles() { state.selectedFiles = []; el.fileInput.value = ''; updateSelectedFilesUI(); }
function updateUploadProgress(percent, statusText) { const value = Math.max(0, Math.min(100, Math.round(percent))); el.uploadProgress.value = value; el.uploadProgressText.textContent = `${value}%`; if (statusText) el.uploadStatusText.textContent = statusText; }
function resetUploadProgress() { updateUploadProgress(0, '等待上傳'); }
function loadAuthCache() {
  const raw = sessionStorage.getItem(AUTH_CACHE_KEY) || localStorage.getItem(AUTH_CACHE_KEY); if (!raw) return;
  try { const parsed = JSON.parse(raw); state.authCache = { accessToken: parsed.accessToken || '', expiresAt: Number(parsed.expiresAt || 0), user: parsed.user || null }; } catch (error) { console.warn('登入快取解析失敗', error); }
}
function saveAuthCache() { const payload = JSON.stringify(state.authCache); sessionStorage.setItem(AUTH_CACHE_KEY, payload); localStorage.setItem(AUTH_CACHE_KEY, payload); }
function clearAuthCache() { state.authCache = { accessToken: '', expiresAt: 0, user: null }; sessionStorage.removeItem(AUTH_CACHE_KEY); localStorage.removeItem(AUTH_CACHE_KEY); }
function cacheTokenResponse(response) {
  if (!state.accessToken) return; const now = Date.now(); const expiresInSec = Number(response.expires_in || 3600);
  state.authCache = { accessToken: state.accessToken, expiresAt: now + Math.max(60, expiresInSec - 60) * 1000, user: state.user || state.authCache.user || null }; saveAuthCache();
}
function isCachedTokenValid() { return !!state.authCache.accessToken && !!state.authCache.expiresAt && state.authCache.expiresAt > Date.now(); }
function restoreCachedAuthIfPossible() {
  if (!isCachedTokenValid()) return false; state.accessToken = state.authCache.accessToken; state.user = state.authCache.user || null;
  try { if (window.gapi?.client?.setToken) gapi.client.setToken({ access_token: state.accessToken }); } catch (error) { console.warn('恢復 token 到 gapi 失敗', error); }
  updateAuthUi(); return true;
}
function updateAuthUi() {
  const loggedIn = !!state.accessToken;
  el.loginBtn.classList.toggle('hidden', loggedIn);
  el.logoutBtn.classList.toggle('hidden', !loggedIn);
  el.refreshBtn.classList.toggle('hidden', !loggedIn);
  [el.authStateBadge, el.settingsAuthBadge].forEach((badge) => { badge.textContent = loggedIn ? '已登入 Google' : '尚未登入'; badge.classList.toggle('logged-in', loggedIn); });
  const subtext = loggedIn ? (state.user?.email || '已取得 Google Drive 授權') : '尚未取得 Google 授權';
  el.authStateSubtext.textContent = loggedIn ? subtext : '請到帳戶 / API 設定頁登入 Google';
  el.settingsAuthSubtext.textContent = subtext;
  el.accountState.textContent = loggedIn ? '已登入' : '未登入';
  el.accountEmail.textContent = state.user?.email || (loggedIn ? '已授權但尚未讀到 Email' : '—');
  el.accountName.textContent = state.user?.name || (loggedIn ? 'Google 帳戶' : '—');
}
async function initializeGoogleClients(force = false) {
  const validation = validateSettings(); if (validation) throw new Error(validation); if (!state.gapiReady || !state.gisReady) throw new Error('Google SDK 尚未載入完成，請稍後再試。'); if (state.initialized && !force) return;
  await gapi.client.init({ apiKey: state.settings.apiKey, discoveryDocs: [GOOGLE_DISCOVERY_DOC] });
  if (state.accessToken) { try { gapi.client.setToken({ access_token: state.accessToken }); } catch (error) { console.warn('gapi 套用既有 token 失敗', error); } }
  state.tokenClient = google.accounts.oauth2.initTokenClient({ client_id: state.settings.clientId, scope: GOOGLE_SCOPE, callback: handleTokenResponse });
  state.initialized = true;
}
function requestAccessToken(prompt = 'consent') { if (!state.tokenClient) throw new Error('Google Token Client 尚未初始化。'); state.tokenClient.requestAccessToken({ prompt }); }
async function fetchCurrentUser() {
  if (!state.accessToken) return null;
  const candidates = ['https://www.googleapis.com/oauth2/v2/userinfo', 'https://openidconnect.googleapis.com/v1/userinfo']; let lastError = null;
  for (const url of candidates) {
    try { const res = await googleApiFetch(url); state.user = await res.json(); updateAuthUi(); state.authCache.user = state.user; saveAuthCache(); return state.user; }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error('無法取得使用者資訊');
}
function buildDriveQueryParams(extra = {}) {
  const params = new URLSearchParams(extra);
  if (state.settings.supportsAllDrives) { params.set('supportsAllDrives', 'true'); params.set('includeItemsFromAllDrives', 'true'); }
  if (state.folderMeta?.driveId) { params.set('driveId', state.folderMeta.driveId); params.set('corpora', 'drive'); }
  return params;
}
function driveErrorToMessage(error, context = '資料夾') {
  const raw = String(error?.message || '').trim(); const normalized = raw.toLowerCase();
  if (!raw) return `無法存取${context}，請確認資料夾 ID 與權限設定。`;
  if (normalized.includes('file not found') || normalized.includes('404')) return `找不到${context}或目前帳號沒有權限。請確認資料夾 ID 正確，並且登入帳號已被加入該資料夾且至少具有「編輯者」權限。`;
  if (normalized.includes('insufficient') || normalized.includes('permission') || normalized.includes('forbidden') || normalized.includes('403')) return `目前登入帳號沒有足夠權限存取${context}。請確認該帳號已加入資料夾，且至少具有「編輯者」權限。`;
  if (normalized.includes('invalid credentials') || normalized.includes('401')) return 'Google 登入權杖已失效，請重新登入 Google 後再試。';
  return raw;
}
async function googleApiFetch(url, options = {}, allowStatuses = [], retry = true) {
  if (!state.accessToken) throw new Error('請先登入 Google。');
  const headers = new Headers(options.headers || {}); headers.set('Authorization', `Bearer ${state.accessToken}`);
  const response = await fetch(url, { ...options, headers });
  if (response.ok || allowStatuses.includes(response.status)) return response;
  if (retry && (response.status === 401 || response.status === 403)) { const refreshed = await trySilentTokenRefresh(); if (refreshed) return googleApiFetch(url, options, allowStatuses, false); }
  let message = `Google API 錯誤 (${response.status})`;
  try { const err = await response.json(); message = err.error?.message || message; } catch (_error) {}
  throw new Error(message);
}
async function validateAndLoadFolderMeta() {
  const folderId = extractFolderId(state.settings.folderId); if (!folderId) throw new Error('尚未設定目標資料夾 ID。');
  state.settings.folderId = folderId; syncSettingsForm();
  const params = buildDriveQueryParams({ fields: 'id,name,mimeType,driveId,capabilities(canAddChildren,canDelete,canShare,canListChildren),permissions(id,displayName,emailAddress,role,type)' });
  try {
    const res = await googleApiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?${params.toString()}`);
    const folder = await res.json();
    if (folder.mimeType !== 'application/vnd.google-apps.folder') throw new Error('設定的 ID 不是資料夾。');
    state.folderMeta = folder;
    el.metaFolder.textContent = folder.name || folderId;
    el.accountFolder.textContent = `${folder.name || '未命名資料夾'} (${folderId})`;
    el.folderWritable.textContent = folder.capabilities?.canAddChildren ? '是' : '否';
    el.folderDeletable.textContent = folder.capabilities?.canDelete ? '是' : '否';
    const permissions = (folder.permissions || []).slice(0, 20).map((item) => `${item.emailAddress || item.displayName || item.type || '未命名'}（${item.role}）`);
    el.permissionSummary.textContent = permissions.length ? permissions.join('、') : '查無權限資料（可能是欄位限制或權限不足）。';
    if (!folder.capabilities?.canAddChildren) throw new Error('目前登入帳號對此資料夾沒有上傳權限，請確認該帳號已加入此資料夾且具備「編輯者」權限。');
    return folder;
  } catch (error) {
    state.folderMeta = null; el.metaFolder.textContent = folderId; el.accountFolder.textContent = folderId; el.folderWritable.textContent = '否'; el.folderDeletable.textContent = '否'; el.permissionSummary.textContent = '尚未讀取。';
    throw new Error(driveErrorToMessage(error));
  }
}
function sortFiles(files) {
  const mode = el.sortSelect.value; const [field, direction] = mode.split('_'); const sign = direction === 'desc' ? -1 : 1;
  return [...files].sort((a, b) => { if (field === 'createdTime') return (new Date(a.createdTime) - new Date(b.createdTime)) * sign; if (field === 'size') return ((Number(a.size) || 0) - (Number(b.size) || 0)) * sign; return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant') * sign; });
}
function getFilteredFilesFrom(list) {
  const keyword = el.searchInput.value.trim().toLowerCase();
  const filtered = list.filter((file) => { if (!keyword) return true; const owner = file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || ''; const ext = getFileExtension(file.name, file.fileExtension); return [file.name, owner, ext].join(' ').toLowerCase().includes(keyword); });
  return sortFiles(filtered);
}
function renderFiles(files) {
  const list = Array.isArray(files) ? files : []; const finalList = getFilteredFilesFrom(list); el.filesTbody.innerHTML = '';
  if (!state.accessToken) return renderTableMessage('請先完成設定並登入。');
  if (!state.folderMeta) return renderTableMessage('請先測試資料夾權限或重新整理。', 'error');
  if (!finalList.length) return renderTableMessage('目前沒有可顯示的檔案。');
  const fragment = document.createDocumentFragment();
  for (const file of finalList) {
    const row = el.fileRowTemplate.content.firstElementChild.cloneNode(true);
    const owner = file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || '—';
    const dt = formatDateTime(file.createdTime);
    row.querySelector('.filename-cell').textContent = file.name || '未命名檔案';
    row.querySelector('.date-cell').textContent = dt.date;
    row.querySelector('.time-cell').textContent = dt.time;
    row.querySelector('.owner-cell').textContent = owner;
    row.querySelector('.size-cell').textContent = formatBytesToMB(file.size);
    row.querySelector('.ext-cell').textContent = getFileExtension(file.name, file.fileExtension);
    row.querySelector('.download-action').addEventListener('click', () => downloadFile(file));
    const deleteBtn = row.querySelector('.delete-action');
    deleteBtn.disabled = !file.capabilities?.canDelete; deleteBtn.title = file.capabilities?.canDelete ? '' : '目前帳號沒有刪除此檔案的權限'; deleteBtn.addEventListener('click', () => deleteFile(file));
    fragment.appendChild(row);
  }
  el.filesTbody.appendChild(fragment);
}
async function refreshFiles() {
  const validation = validateSettings(); if (validation) throw new Error(validation); if (!state.accessToken) throw new Error('請先登入 Google。'); if (!state.folderMeta) await validateAndLoadFolderMeta();
  renderTableMessage('正在載入檔案清單…', 'loading');
  const query = `'${state.settings.folderId.replace(/'/g, "\'")}' in parents and trashed = false`;
  const params = buildDriveQueryParams({ q: query, pageSize: '200', orderBy: 'createdTime desc', fields: 'files(id,name,size,createdTime,fileExtension,owners(displayName,emailAddress),capabilities(canDelete))' });
  try {
    const res = await googleApiFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
    const data = await res.json(); state.files = data.files || []; renderFiles(state.files); return state.files;
  } catch (error) {
    state.files = []; const message = driveErrorToMessage(error, '檔案清單'); renderTableMessage(`檔案清單讀取失敗：${message}`, 'error'); throw new Error(message);
  }
}
async function handleTokenResponse(response) {
  if (response.error) { showNotice(`Google 登入失敗：${response.error}`, 'error'); return; }
  state.accessToken = response.access_token;
  try { gapi.client.setToken({ access_token: state.accessToken }); } catch (error) { console.warn('設定 gapi token 失敗', error); }
  updateAuthUi(); cacheTokenResponse(response); showNotice('Google 授權成功，正在同步帳戶資訊與檔案清單…', 'success'); renderTableMessage('正在載入檔案清單…', 'loading');
  try { await fetchCurrentUser(); } catch (error) { console.warn('讀取 Google 使用者資訊失敗', error); updateAuthUi(); saveAuthCache(); }
  try { await Promise.all([validateAndLoadFolderMeta(), refreshFiles()]); showNotice('Google Drive 授權成功，檔案清單已同步。', 'success'); }
  catch (error) { renderTableMessage(`檔案清單讀取失敗：${error.message}`, 'error'); showNotice(error.message, 'error'); }
}
async function login() { clearNotice(); await initializeGoogleClients(); renderTableMessage('正在進行 Google 授權…', 'loading'); requestAccessToken(state.accessToken ? '' : 'consent'); }
function logout() {
  if (state.accessToken && google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(state.accessToken, () => {
      state.accessToken = null; state.user = null; state.folderMeta = null; state.files = []; clearAuthCache();
      try { if (window.gapi?.client?.setToken) gapi.client.setToken(null); } catch (error) { console.warn('清空 gapi token 失敗', error); }
      updateAuthUi(); renderTableMessage('請先完成設定並登入。'); el.permissionSummary.textContent = '尚未讀取。'; el.folderWritable.textContent = '—'; el.folderDeletable.textContent = '—'; showNotice('已登出 Google 帳號。');
    });
  } else { state.accessToken = null; state.user = null; state.folderMeta = null; state.files = []; clearAuthCache(); updateAuthUi(); renderTableMessage('請先完成設定並登入。'); }
}
async function trySilentTokenRefresh() {
  if (!state.gapiReady || !state.gisReady) return false; await initializeGoogleClients();
  return new Promise((resolve) => {
    const original = state.tokenClient.callback;
    state.tokenClient.callback = async (response) => { state.tokenClient.callback = original; if (response.error) return resolve(false); await handleTokenResponse(response); resolve(true); };
    try { state.tokenClient.requestAccessToken({ prompt: '' }); } catch (error) { state.tokenClient.callback = original; console.warn('靜默更新 token 失敗', error); resolve(false); }
  });
}
async function bootstrapAfterAuthenticated({ silentNotice = true } = {}) {
  await initializeGoogleClients(); if (!state.accessToken) return renderTableMessage('請先完成設定並登入。'); updateAuthUi(); renderTableMessage('正在載入檔案清單…', 'loading');
  try { await fetchCurrentUser(); } catch (error) { console.warn('自動恢復登入時讀取使用者資訊失敗', error); }
  try { await validateAndLoadFolderMeta(); await refreshFiles(); if (!silentNotice) showNotice('已完成自動登入與檔案同步。', 'success'); }
  catch (error) { renderTableMessage(`檔案清單讀取失敗：${error.message}`, 'error'); throw error; }
}
async function maybeBootstrapAuth() {
  const validation = validateSettings(); if (validation) { updateAuthUi(); renderTableMessage('請先完成設定並登入。'); return; }
  if (!state.gapiReady || !state.gisReady) return; loadAuthCache();
  const restored = restoreCachedAuthIfPossible();
  if (restored) { try { await bootstrapAfterAuthenticated({ silentNotice: true }); return; } catch (error) { console.warn('使用快取 token 同步資料失敗，改嘗試靜默更新', error); } }
  if (state.authCache.user) { state.user = state.authCache.user; updateAuthUi(); }
  const refreshed = await trySilentTokenRefresh(); if (!refreshed) { state.accessToken = null; state.folderMeta = null; state.files = []; updateAuthUi(); renderTableMessage('請先完成設定並登入。'); }
}
async function uploadSingleFile(file, uploadedBytesBefore, totalBytes, index, totalFiles) {
  const metadata = { name: file.name, parents: [state.settings.folderId] };
  const sessionParams = buildDriveQueryParams({ uploadType: 'resumable' });
  const sessionRes = await googleApiFetch(`https://www.googleapis.com/upload/drive/v3/files?${sessionParams.toString()}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': file.type || 'application/octet-stream', 'X-Upload-Content-Length': String(file.size) }, body: JSON.stringify(metadata) });
  const sessionUrl = sessionRes.headers.get('Location');
  if (!sessionUrl) throw new Error(`無法取得「${file.name}」的 Google Drive 可續傳上傳網址。`);
  let uploaded = 0;
  while (uploaded < file.size) {
    const chunk = file.slice(uploaded, uploaded + RESUMABLE_CHUNK_SIZE); const end = uploaded + chunk.size - 1; const totalUploadedNow = uploadedBytesBefore + uploaded; const percent = Math.round((totalUploadedNow / totalBytes) * 100);
    updateUploadProgress(percent, `上傳第 ${index}/${totalFiles} 個：${file.name}（${formatBytesToMB(totalUploadedNow)} / ${formatBytesToMB(totalBytes)} MB）`);
    const chunkRes = await googleApiFetch(sessionUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${uploaded}-${end}/${file.size}` }, body: chunk }, [308]);
    if (chunkRes.status === 308) { uploaded = end + 1; continue; }
    uploaded = file.size;
  }
}
async function uploadFiles() {
  clearNotice(); const validation = validateSettings(); if (validation) throw new Error(validation); if (!state.accessToken) throw new Error('請先到帳戶 / API 設定頁登入 Google。'); if (!state.folderMeta) await validateAndLoadFolderMeta();
  if (!state.folderMeta?.capabilities?.canAddChildren) throw new Error('目前登入帳號對此資料夾沒有上傳權限，請確認該帳號已加入此資料夾且具備「編輯者」權限。');
  if (!state.selectedFiles.length) throw new Error('請先選取至少一個檔案。');
  const oversized = state.selectedFiles.find((file) => file.size > MAX_FILE_BYTES); if (oversized) throw new Error(`檔案「${oversized.name}」超過單檔 100 MB 限制。`);
  const totalBytes = state.selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0); let uploadedBytesBefore = 0; updateUploadProgress(1, '建立批次上傳工作…');
  for (let i = 0; i < state.selectedFiles.length; i += 1) { const file = state.selectedFiles[i]; await uploadSingleFile(file, uploadedBytesBefore, totalBytes, i + 1, state.selectedFiles.length); uploadedBytesBefore += file.size || 0; }
  updateUploadProgress(100, '全部檔案上傳完成，正在重新整理檔案清單…'); showNotice(`已完成 ${state.selectedFiles.length} 個檔案上傳。`, 'success'); clearSelectedFiles(); await refreshFiles();
}
async function downloadFile(file) {
  clearNotice(); const params = buildDriveQueryParams({ alt: 'media' }); const res = await googleApiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?${params.toString()}`); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name || 'download'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
async function deleteFile(file) {
  clearNotice(); if (!window.confirm(`確定要刪除「${file.name}」嗎？`)) return; const params = buildDriveQueryParams(); await googleApiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?${params.toString()}`, { method: 'DELETE' }); showNotice(`檔案「${file.name}」已刪除。`, 'success'); await refreshFiles();
}
async function handleTestConnection() {
  clearNotice(); await initializeGoogleClients(); if (!state.accessToken) { showNotice('請先點「登入 Google」，授權後再測試連線。'); return; }
  try { await fetchCurrentUser(); } catch (error) { console.warn('測試連線時讀取使用者資訊失敗', error); }
  await validateAndLoadFolderMeta(); await refreshFiles(); showNotice('Google Drive 連線測試成功。', 'success');
}
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      state.swRegistration = await navigator.serviceWorker.register('sw.js');
      if (state.swRegistration.waiting) showUpdateBanner('偵測到新的快取版本，請重整頁面以套用更新。', true);
      state.swRegistration.addEventListener('updatefound', () => {
        const newWorker = state.swRegistration.installing; if (!newWorker) return;
        newWorker.addEventListener('statechange', () => { if (newWorker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner('GitHub 上已有新版程式，請按「立即重整更新」。', true); });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
    } catch (error) { console.warn('Service Worker 註冊失敗', error); }
  });
}
function forceReloadFromServer() { if (state.swRegistration?.waiting) { state.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' }); return; } const url = new URL(window.location.href); url.searchParams.set('v', Date.now().toString()); window.location.replace(url.toString()); }
async function checkForUpdates({ silent = false } = {}) {
  try { if (state.swRegistration?.update) await state.swRegistration.update(); } catch (error) { console.warn('Service Worker update 檢查失敗', error); }
  try {
    const url = `${VERSION_ENDPOINT}?ts=${Date.now()}`; const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json(); const remoteVersion = payload.version || '未知版本'; state.remoteVersion = remoteVersion; el.remoteVersionText.textContent = remoteVersion;
    if (remoteVersion !== APP_VERSION) { showUpdateBanner(`偵測到 GitHub 已發布新版 ${remoteVersion}（目前為 ${APP_VERSION}），請立即重整更新。`, true); if (!silent) showNotice(`偵測到新版 ${remoteVersion}。`, 'success'); }
    else { hideUpdateBanner(); if (!silent) showNotice(`目前已是最新版本 ${APP_VERSION}。`, 'success'); }
  } catch (error) { el.remoteVersionText.textContent = '檢查失敗'; if (!silent) showNotice(`檢查更新失敗：${error.message}`, 'error'); }
}
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); state.deferredPrompt = event; el.installBtn.classList.remove('hidden'); });
  el.installBtn.addEventListener('click', async () => { if (!state.deferredPrompt) return; state.deferredPrompt.prompt(); await state.deferredPrompt.userChoice; state.deferredPrompt = null; el.installBtn.classList.add('hidden'); });
}
function setupGoogleLoaderWatchers() {
  const waitForGapi = window.setInterval(() => { if (window.gapi?.load) { clearInterval(waitForGapi); gapi.load('client', () => { state.gapiReady = true; maybeBootstrapAuth(); }); } }, 200);
  const waitForGis = window.setInterval(() => { if (window.google?.accounts?.oauth2) { clearInterval(waitForGis); state.gisReady = true; maybeBootstrapAuth(); } }, 200);
}
function bindEvents() {
  tabButtons.forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  el.themeToggleBtn.addEventListener('click', toggleTheme);
  el.checkUpdateBtn.addEventListener('click', () => checkForUpdates({ silent: false }));
  el.loginBtn.addEventListener('click', async () => { try { await login(); } catch (error) { showNotice(error.message, 'error'); renderTableMessage('登入失敗，請檢查設定後再試。', 'error'); } });
  el.logoutBtn.addEventListener('click', logout);
  el.refreshBtn.addEventListener('click', async () => { try { await bootstrapAfterAuthenticated({ silentNotice: false }); showNotice('檔案清單已重新整理。', 'success'); } catch (error) { showNotice(error.message, 'error'); } });
  el.pickFilesBtn.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', (event) => { state.selectedFiles = Array.from(event.target.files || []); updateSelectedFilesUI(); });
  el.clearFileBtn.addEventListener('click', clearSelectedFiles);
  el.uploadBtn.addEventListener('click', async () => { try { await uploadFiles(); } catch (error) { updateUploadProgress(0, '等待上傳'); showNotice(error.message, 'error'); } });
  el.searchInput.addEventListener('input', () => renderFiles(state.files));
  el.sortSelect.addEventListener('change', () => renderFiles(state.files));
  el.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault(); clearNotice(); state.settings = getSettingsFromForm(); saveSettings(); syncSettingsForm(); state.initialized = false; state.folderMeta = null; showNotice('本機設定已儲存。若剛調整 Client ID / API Key，請重新登入 Google。', 'success'); maybeBootstrapAuth();
  });
  el.testConnectionBtn.addEventListener('click', async () => { try { await handleTestConnection(); } catch (error) { showNotice(error.message, 'error'); renderTableMessage(`測試連線失敗：${error.message}`, 'error'); } });
  el.clearSettingsBtn.addEventListener('click', () => { localStorage.removeItem(SETTINGS_KEY); state.settings = { clientId: '', apiKey: '', folderId: '', appTitle: '', supportsAllDrives: true }; syncSettingsForm(); state.initialized = false; state.folderMeta = null; showNotice('本機設定已清除。'); });
}
async function init() {
  loadSettings(); loadTheme(); loadAuthCache(); syncSettingsForm(); updateAuthUi(); updateSelectedFilesUI(); resetUploadProgress(); bindEvents(); await registerServiceWorker(); setupInstallPrompt(); setupGoogleLoaderWatchers(); await checkForUpdates({ silent: true }); if (!state.accessToken) renderTableMessage('請先完成設定並登入。');
}
init();
