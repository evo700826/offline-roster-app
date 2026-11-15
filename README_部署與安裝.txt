自動排班系統｜手機離線 PWA 部署包 v0.5.177
製作：林邵賢

本資料夾是把既有 phone_offline.html 包裝成可透過 HTTPS 首次安裝、之後離線開啟的 PWA 部署素材。

檔案：
- index.html：手機操作介面（沿用 v0.5.177 phone_offline.html）
- manifest.webmanifest：主畫面安裝資訊
- sw.js：Service Worker 離線快取
- icons/：主畫面圖示

重要：
1. 目前尚未部署成公開 HTTPS 網址；必須先部署到支援 HTTPS 的靜態網站空間，才能用 iPhone Safari「加入主畫面」。
2. 部署時只上傳本資料夾內容，不要把 Windows 的 local_settings.db、員工資料或正式班表資料庫上傳到公開網站。
3. 首次以 Safari 開啟 HTTPS 網址，等待頁面載入及 Service Worker 快取完成，再按分享 > 加入主畫面。
4. 安裝後可在無網路時開啟已快取的介面；手機資料保存在該 iPhone 的 Safari/PWA 本機儲存區。
5. 請勿清除 Safari 網站資料或刪除 PWA，否則可能清除手機本機修改資料；重要修改應及時回傳 Windows 備份。
6. 此包裝不會自動補上原試用版尚未完成的 QR 圖片產生器、相機掃描相容性或完整 Excel 班表顯示。這些仍需獨立開發及實機驗收。
7. Windows 與手機資料仍透過既有離線 QR 封包交換；網站只提供靜態程式檔，不作雲端資料同步。
