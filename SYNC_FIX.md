# 前後台資料同步修復

## 根因
舊版本前後台使用不同資料來源：

- 管理員 Demo：`rrbs_admin_demo_v4`
- 前台：硬編碼 `rooms / centerUseItems / loanItems` + 另一組 localStorage bookings

因此後台新增或修改房間／物品後，前台不可能同步。

## 今次修正

### Demo Mode
前台及後台現在共同使用：

`rrbs_admin_demo_v4`

同步內容：
- 機構
- 房間
- 物品
- 可用日期／星期／時段
- 預約申請
- 管理員審批狀態

另外加入：
- `storage` event
- `BroadcastChannel`
- window focus / visibility refresh

所以同一瀏覽器開兩個分頁時，修改後會自動重新讀取資料。

### Supabase 正式模式
前台不再使用 hardcoded 資源，會直接讀：
- `organizations`
- `resources`
- `resource_availability`

並訂閱 Supabase Realtime 更新。

公開「查詢」不直接讀 `bookings`，而是呼叫：

`get_public_resource_bookings()`

只回傳：
- 資源名稱
- 資源類型
- 借用日期
- 歸還日期
- 狀態

不會回傳姓名、電話、用途、申請編號或管理員備註。

## 正式 Supabase 必須執行

如 `config.js` 已設：

```js
demoMode: false
```

請在 Supabase SQL Editor 執行：

`supabase/20260909_frontend_backend_sync.sql`

如果是全新資料庫，可直接執行最新 `supabase/schema.sql`，已包含同一組同步修正。

## 已驗證流程

1. 後台新增機構 -> 前台讀到
2. 後台新增房間 -> 前台房間列表讀到
3. 後台新增外借物品 -> 前台外借物品列表讀到
4. 後台修改房間名稱 -> 前台更新名稱
5. 前台提交外借物品申請 -> 後台出現 pending 申請
6. 後台批准 -> 前台公開查詢出現資源及借用日期
7. 公開查詢不顯示申請人、用途、電話、申請編號
