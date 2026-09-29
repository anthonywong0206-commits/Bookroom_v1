# 房間及物品預約系統 v10.9

本版本以 v10.6 為基礎，重整管理員的房間／物品預約管理，並加入前台每小時可借用時間表。

## 現有 LIVE 網站更新
使用 `room-resource-booking-system-v10.7-PATCH.zip` 覆蓋網站根目錄的同名檔案即可。PATCH 不包含 `config.js`，不會覆蓋現有 Supabase 連線設定。

目前 LIVE Supabase 已套用 v10.7 SQL，不需要再次執行 migration。

部署後建議在瀏覽器按 Ctrl + F5 強制更新快取。

## 新 Supabase / 重建環境
依序執行 `supabase` 資料夾內 migrations；v10.7 對應檔案：
`20260922_v10_7_booking_management.sql`


Current frontend version: v10.9 room availability status update.
