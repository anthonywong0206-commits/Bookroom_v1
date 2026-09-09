# 房間及物品預約系統 v9

最新版本加入 **機構前台登入與嚴格資料隔離**。

前台流程：

**選擇機構 → 輸入機構密碼 → 首頁 → 預約／查詢**

不同機構的房間、物品、借用日曆、封鎖日期及預約申請會按 `organization_id` 分隔。

## Demo Mode

可直接更新網站檔案測試。既有 Demo 機構如未設定密碼，預設為 `1234`；可在管理員後台「機構管理」修改。

## Supabase Mode

除了更新網站檔案，必須在 Supabase SQL Editor 執行：

`supabase/20260909_v9_organization_portal_isolation.sql`

執行後，既有機構的臨時前台密碼為 `1234`，請立即在管理員後台逐一修改。

詳情見 `UPDATE_V9.md`。
