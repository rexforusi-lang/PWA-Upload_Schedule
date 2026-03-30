
# Drive Share Hub V0.3

## 這次修正
1. 修正重新整理頁面後需要重新登入：
   - 以 `sessionStorage + localStorage` 快取 access token、到期時間、使用者資訊。
   - 載入頁面時會先恢復有效 token；若 token 過期，會再嘗試靜默更新 token。
2. 修正登入後右側檔案檢視區仍顯示「請先完成設定並登入」：
   - 新增表格狀態切換（未登入 / 載入中 / 讀取失敗 / 空資料 / 正常清單）。
   - 登入成功、重新整理、測試連線都會主動刷新檔案清單。
3. 保留 GitHub 版本檢查與 Service Worker 更新提醒。

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
