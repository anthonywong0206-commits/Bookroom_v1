# v10.9.1 Hotfix

日期：2026-10-14

## 修正
- 修正管理員按「房間預約管理」後沒有反應。
- 原因：v10.9 狀態計算新增逐小時預約重疊檢查，但 `admin-app.js` 漏載 `timeRangesOverlap()` helper；當月曆遇到已批准／已完成預約時會產生 JavaScript ReferenceError。
- 補回安全的時間重疊判斷函數，房間日曆可正常計算「可預約／少量空位／已滿／不可借用」。
- 更新 admin asset cache-busting，避免瀏覽器繼續使用舊 v10.9 JavaScript。

## 資料庫
- 不需要執行 SQL。
- 不修改任何 Supabase booking/resource 資料。

## 部署
PATCH 只需覆蓋：
- `admin.html`
- `admin-app.js`

部署後重新整理管理員頁面。
