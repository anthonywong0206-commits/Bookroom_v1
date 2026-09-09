# 管理員 CRUD 修復版

本版修正管理員後台無法新增／修改機構、房間及物品的問題。

## 修正內容
- 補回 `admin-app.js` 及 `admin.css`，管理員頁不再引用不存在的檔案。
- Demo Mode：機構、房間、物品、可用時段的新增／修改／刪除會保存至 localStorage，重新整理仍保留。
- Supabase Mode：使用同一介面直接 CRUD `organizations`、`resources`、`resource_availability`。
- 機構支援新增、改名、啟用／停用、刪除。
- 房間支援新增、修改容量、位置、描述、狀態、刪除。
- 物品支援新增、修改庫存、位置、描述、是否需要配合房間、狀態、刪除。
- 房間／物品可新增及刪除每週固定或指定日期可用時段。
- 已有借用紀錄的機構／資源會阻止硬刪，建議改為停用。

## 正式 Supabase 模式
如 `config.js` 設定 `demoMode: false`，請填入：
- `supabaseUrl`
- `supabasePublishableKey`

管理員登入帳戶亦必須在 `profiles` 表中設定 `role = 'admin'`。

如果舊資料庫出現 RLS / permission denied，請在 Supabase SQL Editor 執行：
`supabase/20260909_admin_crud_fix.sql`
