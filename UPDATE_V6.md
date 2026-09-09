# v6 更新：管理員「借用狀況」日曆

## 新增後台頁面：借用狀況

管理員後台左側新增「借用狀況」。

使用方式：
1. 選擇房間或物品。
2. 以月曆查看該資源的借用狀況。
3. 顏色：
   - 綠色：空位／可借用
   - 紅色：已有已批准或已完成的借用紀錄
   - 灰色：未開放或已由管理員設為不可借用
4. 點擊日期可查看當日相關紀錄。
5. 點擊紅色日期的紀錄可「檢視／修改」或「刪除」。
6. 綠色日期可按「設為不可借用」，灰色封鎖日期可解除封鎖。

外借物品如借用多日，借用範圍內每一天均會標示為紅色。

## 修改借用紀錄

管理員可修改：
- 房間／物品
- 借用開始日期
- 歸還日期（物品）
- 開始／結束時間
- 數量
- 狀態
- 申請人姓名
- 電話
- 用途
- 備註

亦可直接刪除紀錄。

## 不可借用日期

新增 `resource_blocks` 資料表。

- 管理員封鎖日期後，前台房間日曆會停用該日。
- 外借物品的 3 日借用期只要跨過任何封鎖日期，該開始日期便不能選擇。
- 資料庫亦有 trigger 防止使用者繞過 UI 提交封鎖日期。
- 已有已批准／完成借用的日期不可再設為封鎖。

## Demo Mode

Demo Mode 會把 `resourceBlocks` 與 bookings 一同儲存在：

`rrbs_admin_demo_v4`

所以前後台會共用同一份資料。

## Supabase 正式模式

更新網站後，請在 Supabase SQL Editor 執行：

`supabase/20260909_v6_borrowing_calendar.sql`

此 migration 會新增：
- `resource_blocks`
- 前台安全讀取封鎖日期的 RLS
- 管理員封鎖／解除封鎖 RLS
- `admin_update_booking_record(...)`
- `admin_delete_booking_record(...)`
- 借用日期封鎖 database trigger
- Supabase Realtime publication
