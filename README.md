# 房間及物品預約系統 — 前後台同步修正版

本版本修正「後台更新房間／物品後，前台沒有同步」問題。

## 資料同步

### Demo Mode
前後台共用同一份瀏覽器資料：`rrbs_admin_demo_v4`。

後台新增／修改／刪除：
- 機構
- 房間
- 物品
- 可用時段

前台會讀取相同資料，不再使用 hardcoded 房間／物品。

前台提交預約後，管理員後台亦會讀到相同 pending booking；管理員批准後，前台「查詢」會顯示該資源的借用日期。

### Supabase Mode
前台直接使用 Supabase 作唯一資料來源，並訂閱 Realtime：
- organizations
- resources
- resource_availability

公開借用情況透過安全 RPC 取得，不公開個人資料。

## 正式模式更新步驟

1. 將今次 ZIP 全部檔案覆蓋現有網站。
2. 如仍使用 `demoMode: true`，不需執行 SQL，Demo 前後台已同步。
3. 如使用 `demoMode: false`，在 Supabase SQL Editor 執行：
   `supabase/20260909_frontend_backend_sync.sql`
4. 確認 `config.js` 保留你的 Supabase URL / Publishable Key。
5. Push 到 GitHub，等 Vercel 自動部署。

## 主要修復檔案

- `app.js` — 前台改讀共同資料源、Realtime、同步預約提交
- `admin-app.js` — Demo 跨頁同步 + Supabase Realtime
- `index.html` — 正式模式自動載入 Supabase library
- `supabase/20260909_frontend_backend_sync.sql` — 公開 catalogue、公開安全查詢、前台提交 RPC
- `supabase/schema.sql` — 全新安裝已包含同步修正

詳細測試與說明見 `SYNC_FIX.md`。
