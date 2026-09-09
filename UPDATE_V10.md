# v10 — LIVE Supabase 跨平台同步

## 已完成

- 已建立獨立 Supabase project：`room-resource-booking-system`
- Project ref：`xdilyyjmuaovafcewins`
- Region：Singapore (`ap-southeast-1`)
- `config.js` 已切換為 `demoMode: false`
- 前端只使用 Supabase Publishable Key，不包含 service-role / secret key
- 資料表已建立並啟用 RLS：
  - profiles
  - organizations
  - resources
  - resource_availability
  - bookings
  - purpose_options
  - resource_blocks
- `resource-images` Storage bucket 已建立，支援 JPG / PNG / WebP（5MB）
- Realtime publication 已包含機構、資源、時段、預約、封鎖日期及用途設定
- 前台機構密碼隔離 RPC 已啟用
- 管理員日曆／CRUD RPC 已啟用
- 管理員 RPC 已明確禁止 anon 執行
- 前台加入 focus / visibility refresh + 30 秒同步 refresh，確保不同裝置更新後可取得最新資料

## 管理員帳戶首次啟用

基於安全原因，管理員密碼不會寫入網站檔案、SQL migration 或工具呼叫。

系統已為指定管理員電郵預留一次性啟用資格。第一次進入 `admin.html`：

1. 輸入指定管理員電郵。
2. 輸入你要使用的 Supabase Auth 密碼。
3. 輸入由 ChatGPT 對話提供的一次性啟用碼。
4. 如 Supabase 要求電郵確認，先完成電郵確認，再返回管理員頁以同一密碼及啟用碼登入。
5. 成功啟用後，啟用碼失效；日後只需電郵＋密碼登入。

> 一次性啟用碼刻意不放在 repository / ZIP 內，避免部署到公開 GitHub 後洩露。

## 部署

將此版本上載 GitHub / Vercel 即可。此 project 的 Supabase schema 已經由系統設定完成，不需要再次手動執行 v5–v9 SQL。
