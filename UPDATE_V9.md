# v9 更新：機構登入與資料隔離

## 前台

- 用戶進入網站後，必須先：
  1. 選擇所屬機構
  2. 輸入該機構密碼
  3. 驗證成功後才可進入「預約」及「查詢」
- 登入後，前台只載入該機構的：
  - 房間
  - 物品
  - 可用日期／時段
  - 不可借用日期
  - 已批准借用狀況
- 切換機構必須先登出，再重新輸入另一機構密碼。
- 機構登入只保存在目前瀏覽器分頁的 sessionStorage；關閉分頁後需要重新登入。

## 管理員後台

「機構管理」新增 **前台登入密碼**：

- 新增機構：必須設定至少 4 個字元密碼。
- 修改機構：密碼欄留空即保留原密碼；輸入新密碼則更新。
- Demo Mode：密碼保存在 Demo localStorage。
- Supabase Mode：密碼以 bcrypt/pgcrypto hash 儲存，前台無法讀取原始密碼或 hash。

## Supabase 資料隔離

正式模式新增以下安全 RPC：

- `get_portal_organizations()`：只回傳啟用機構的 id / name。
- `verify_organization_portal()`：驗證機構密碼。
- `get_organization_portal_data()`：驗證後只回傳該機構資源及借用狀況。
- `submit_organization_room_request()`：只可提交該機構房間／物品。
- `submit_organization_loan_request()`：只可提交該機構可外借物品。
- `admin_set_organization_portal_password()`：只供管理員修改機構密碼。

同時撤銷舊匿名跨機構資料讀取與未經機構密碼的舊提交 RPC 權限。

## 既有機構臨時密碼

執行 v9 migration 後，所有原有而尚未有密碼的機構會暫時設定為：

`1234`

請登入管理員後台 → **機構管理**，逐一更改成正式密碼。

## 正式模式必須執行

`supabase/20260909_v9_organization_portal_isolation.sql`
