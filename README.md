
# Drive Share Hub V0.1

扁平化（flat）PWA 專案，所有檔案都在同一層，適合直接部署到 GitHub Pages。

## 檔案清單
- index.html
- app.css
- app.js
- manifest.json
- sw.js
- offline.html
- icon-192.png
- icon-512.png
- README.md

## 功能
1. Google Drive 單檔上傳（上限 100 MB）
2. Google Drive 檔案列表 / 下載 / 刪除
3. 設定頁本機儲存：Client ID、API Key、Folder ID、App 名稱
4. 可設定共用資料夾，讓多位使用者在同一頁面操作共享資源
5. Light / Dark 主題切換
6. PWA 安裝與離線殼層快取

## 使用前準備
1. 到 Google Cloud 建立專案。
2. 啟用 Google Drive API。
3. 建立 **OAuth Client ID（Web application）**。
4. 建立 **API Key**。
5. 在 OAuth Client 的 **Authorized JavaScript origins** 加入你的 GitHub Pages 網址。
6. 建立（或指定）要共用的 Google Drive 資料夾 / Shared Drive 內資料夾，並把需要使用的人加進去。

## 部署到 GitHub Pages
1. 建立 GitHub repository。
2. 把本資料夾所有檔案直接放在 repository 根目錄。
3. 推送到 GitHub。
4. 到 **Settings > Pages**，選 `main` 與 `/ (root)`。
5. 儲存後等待 GitHub Pages 發布。

## 首次使用
1. 開啟頁面後切到「帳戶 / API 設定」。
2. 輸入 Client ID、API Key、Folder ID。
3. 按「儲存設定」。
4. 回到「檔案中心」，按「登入 Google」。
5. 成功授權後即可上傳、下載、刪除與管理檔案。

## 備註
- 本專案是純前端靜態 PWA，**不含後端**。
- 為了支援多人共享同一批檔案，建議所有使用者都連到同一個共用資料夾 / Shared Drive 內資料夾，並擁有適當權限。
- 本機設定使用 `localStorage` 儲存，不會提交到 GitHub。
- 如果之後要公開給組織外部使用，請留意 Google OAuth 驗證與敏感/受限 scope 審查。
