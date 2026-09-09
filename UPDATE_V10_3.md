# v10.3 — 機構密碼 pgcrypto 修復

修正後台「機構管理」設定前台登入密碼時出現：

`function gen_salt(unknown, integer) does not exist`

## 原因
Hosted Supabase 的 `pgcrypto` functions 位於 `extensions` schema，而密碼相關 SECURITY DEFINER functions 使用 `search_path = ''`。舊版本未 schema-qualify `crypt()` / `gen_salt()`，因此執行時無法解析 functions。

## 修正
- `gen_salt(...)` → `extensions.gen_salt(...)`
- `crypt(...)` → `extensions.crypt(...)`
- 同時修正設定密碼及驗證密碼兩邊，避免設定成功後前台登入再出同類問題。
- 保留 admin RPC 權限：anon 不可執行管理員密碼設定 function。

## LIVE Supabase
此修正已經套用到目前 `room-resource-booking-system` Supabase project，現有網站毋須重新執行 SQL 才能即時生效。

附件 migration 主要供日後重新部署／備份使用。
