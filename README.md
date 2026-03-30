
# Drive Share Hub V0.5

扁平化（flat）PWA 專案，所有檔案都在同一層，適合直接部署到 GitHub Pages。

## 這次修正（V0.5）
1. 完整恢復真實 Google Drive PWA 功能（非示意版本）：登入、列檔、下載、刪除、上傳。
2. 修正手機 / 電腦自適應排版：
   - Mobile-first 版型
   - PWA safe-area
   - 手機時單欄置中、桌機時雙欄
3. 登入後會隱藏「登入 Google」按鈕，只保留登出 / 重新整理。
4. 支援直接貼入 Google Drive 資料夾連結，自動擷取 folder ID。
5. 針對 File not found / 權限不足提供人性化錯誤訊息：
   - 找不到資料夾
   - 未加入資料夾
   - 沒有編輯者權限
6. 保留版本檢查、Service Worker 更新提示與本機設定儲存。

## 檔案清單
- index.html
- app.css
- app.js
- manifest.json
- sw.js
- offline.html
- version.json
- icon-192.png
- icon-512.png
- README.md

## 使用提醒
- 若資料夾是 Shared Drive，請保留 supportsAllDrives 開啟。
- 若只開放「知道連結即可檢視」，仍然可能無法透過 API 上傳；請把登入帳號加入資料夾且至少給「編輯者」權限。
- 若 OAuth token 過期，前端會先嘗試靜默更新；失敗才需要重新登入。
