# v10.8 PATCH

將 PATCH 內檔案覆蓋網站根目錄同名檔案：
- index.html
- app.js
- styles.css

`config.js` 不包含在 PATCH，現有 Supabase / 管理員設定不會被覆蓋。
本版本不需要執行 Supabase SQL。
部署後建議重新整理／關閉再重開網站，確保載入 v10.8 cache-busting 檔案。
