# 預約系統 v5 更新說明

## 本次更新

1. 物品借用規則
   - 勾選「此物品只可配合房間預約／中心內使用」：只會出現在房間預約附加物品。
   - 未勾選：會同時出現在房間預約附加物品及「外借物品」單獨預約。

2. 外借物品流程
   - 先選擇物品及數量。
   - 再顯示可預約日期日曆。
   - 日曆會按物品可用規則及已批准借用量判斷可選日期。
   - 預設歸還日期為借用開始日期後 3 日，可再修改。

3. 外借確認頁
   - 只需要：申請者姓名、電話、用途、備註。
   - 用途改為按鈕選擇。
   - 預設：個案／小組／外出活動。

4. 管理員用途設定
   - 新增「用途設定」頁。
   - 可新增、修改、排序、啟用／停用及刪除用途選項。

5. 房間／物品圖片
   - 管理員新增／修改房間或物品時可上載 JPG / PNG / WebP。
   - 前台房間卡及物品卡會直接顯示圖片。
   - Demo Mode：圖片存在瀏覽器 localStorage，建議圖片 1.2MB 以下。
   - Supabase Mode：圖片存於 `resource-images` Storage bucket，最大 5MB。

## Supabase 正式模式

如 `config.js` 的 `demoMode` 已設為 `false`，更新網站檔案後，請在 Supabase SQL Editor 執行：

`supabase/20260909_v5_items_images_purposes.sql`

此 migration 會新增：
- `resources.image_url`
- `bookings.applicant_note`
- `purpose_options` 資料表及 RLS
- `resource-images` Storage bucket 及 admin upload policies
- 更新公開借用資料 RPC
- 更新房間附加物品規則
- 更新單獨外借 RPC

## 建議更新方式

如現有網站已經有自己的 `config.js`（Supabase URL / Publishable Key），建議用 PATCH ZIP，避免覆蓋設定。
