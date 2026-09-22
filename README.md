# v10.7 PATCH

1. 將本 PATCH 內的 `admin-app.js`, `admin.css`, `admin.html`, `app.js`, `styles.css`, `index.html` 覆蓋網站根目錄同名檔案。
2. 不要刪除或覆蓋你原有的 `config.js`。
3. 你現時的 LIVE Supabase 已經套用 v10.7 migration，所以毋須再執行 SQL。
4. 如部署到另一個 Supabase，才執行 `supabase/20260922_v10_7_booking_management.sql`。
5. 部署完成後按 Ctrl + F5。
