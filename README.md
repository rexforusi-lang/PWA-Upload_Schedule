
# Drive Share Hub V0.2

扁平化（flat）PWA 專案，所有檔案都在同一層，適合直接部署到 GitHub Pages。

## 這次修正（V0.2）
1. 修正 Google 登入成功後狀態仍顯示「尚未登入」的問題：
   - 授權成功後會先立即切換成已登入狀態。
   - 新增 `openid email profile` scope。
   - 若 userinfo 讀取失敗，也不會回退成未登入。
2. 新增 GitHub 版本檢查：
   - 每次進站載入時會檢查 `version.json`。
   - 同步呼叫 Service Worker `registration.update()` 檢查新快取。
   - 偵測到新版時會顯示更新通知，並可一鍵重整更新。
3. 新增「檢查更新」按鈕與遠端版本顯示。

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

## 部署提醒
每次更新版本時，請同步修改：
- `app.js` 內 `APP_VERSION`
- `sw.js` 內 cache 名稱
- `version.json`

若使用 GitHub Pages，更新後建議第一次手動按一次「檢查更新」確認快取已刷新。
