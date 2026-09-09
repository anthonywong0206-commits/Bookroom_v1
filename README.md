# 房間及物品預約系統 — 管理員 CRUD 修正版

本版本修正管理員後台無法新增／修改機構、房間及物品的問題，並保留上一版前台設定。

## 今次修正

### 管理員後台
- 補回及重建 `admin-app.js`
- 補回及重建 `admin.css`
- 管理員可新增、修改、啟用／停用、刪除機構
- 管理員可新增、修改、啟用／停用、刪除房間
- 管理員可新增、修改、啟用／停用、刪除物品
- 房間可設定容量、位置、描述
- 物品可設定庫存、位置、描述、是否必須配合房間使用
- 房間／物品可設定每週固定時段或指定日期時段
- 已有借用紀錄的機構／資源會阻止硬刪除，以保護歷史記錄

### Demo Mode
`demoMode: true` 時，管理員 CRUD 會保存到瀏覽器 `localStorage`，重新整理頁面仍然保留，可完整測試後台操作。

### Supabase 正式模式
`demoMode: false` 時，同一套介面會直接對以下資料表 CRUD：
- `organizations`
- `resources`
- `resource_availability`

管理員登入帳戶必須在 `profiles` 表內設定 `role = 'admin'`。

如果舊 Supabase deployment 出現 RLS / permission denied，請執行：

`supabase/20260909_admin_crud_fix.sql`

## 保留上一版前台設定
- 手機底部導航只保留：首頁／預約／查詢
- 公開查詢只顯示房間／物品名稱及借用日期
- 不公開姓名、電話、用途、申請編號及備註
- Desktop 與手機首頁均採用「預約／查詢」大按鈕
- 管理員登入入口只在 Desktop 顯示

## 更新建議

如你的 `config.js` 已填入 Supabase URL / Publishable Key，請使用 Patch ZIP，以免覆蓋現有設定。

Patch 主要更新：
- `admin.html`
- `admin-app.js`
- `admin.css`
- `app.js`
- `styles.css`
- `supabase/20260909_admin_crud_fix.sql`

完整 ZIP 則包含整套網站。
