# 房間及物品預約系統 — v10 LIVE Supabase

這是目前正式 Supabase 跨平台版本。

## Supabase

- Project：`room-resource-booking-system`
- Project ref：`xdilyyjmuaovafcewins`
- Region：Singapore
- Mode：LIVE (`demoMode: false`)

前台、後台、房間／物品、時段、借用日曆、封鎖日期、用途設定及圖片均使用同一 Supabase project，因此不同電腦／手機會讀取同一份資料。

## 安全

- Browser 只包含 Publishable Key。
- 不包含 service-role key。
- 所有 public tables 均啟用 RLS。
- 前台需要先選擇機構及輸入機構密碼。
- 前台資料由 organization-scoped RPC 讀取／提交，避免機構資料混雜。
- 管理員 CRUD RPC 只開放給 authenticated 帳戶，且函數內再次檢查 `profiles.role = admin`。
- 管理員首次啟用使用一次性啟用碼，啟用碼不會放入網站檔案。

詳細內容請看 `UPDATE_V10.md`。

## v10.4 Telegram 通知
新申請可透過 Supabase Edge Function 即時推送 Telegram。詳見 `TELEGRAM_INSTALL.md`。
