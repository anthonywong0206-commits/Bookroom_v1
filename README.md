# 房間及物品預約系統 v10.5

Supabase LIVE 版本。

本版新增：
- 全站房間／物品開放申請期限設定
- 兩種期限規則：每月指定日子、期數開始前 N 日
- Supabase 後端強制驗證預約日期
- 物品自訂分類
- 外借、房間附加物品、借用查詢均可按分類篩選
- 保留 v10.4 Telegram 新申請通知

## 更新現有網站
使用 `room-resource-booking-system-v10.5-PATCH.zip` 覆蓋網站檔案。

LIVE Supabase project 已套用 v10.5 database migration，不須再次執行 SQL。

如日後重建 Supabase，可執行：
`supabase/20260910_v10_5_booking_window_item_categories.sql`
