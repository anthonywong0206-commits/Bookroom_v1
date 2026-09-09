# 房間及物品預約系統 — 管理員 CRUD + Desktop 大按鈕更新

此版本在上一個 responsive 版本上更新，保留手機版流程及桌面專用管理員入口。

## 本次更新

### 1. 管理員：機構完整管理
管理員後台 > 資源管理現在可：
- 新增機構
- 修改機構名稱
- 啟用／停用機構
- 刪除機構

為保障歷史資料，如機構旗下資源已經有借用紀錄，系統會拒絕硬刪除；可改為停用機構／資源。

### 2. 管理員：房間／物品功能修復
已重新整理新增及管理流程：
- 新增房間
- 新增物品
- 編輯房間／物品
- 刪除沒有歷史借用紀錄的房間／物品
- 啟用／停用資源
- 房間名額
- 物品庫存量
- 物品是否需要配合房間
- 可預約日期／星期／時段

新增資源前必須先建立／選擇機構；表單亦增加清晰驗證及錯誤訊息。

### 3. Desktop 前台改為大按鈕模式
電腦版不再以 Sidebar 作為主要操作方式。

桌面首頁與手機版採用相同主要流程：
- **預約**（大按鈕）
- **查詢**（大按鈕）

點選「預約」後再選：
- 房間
- 外借物品

桌面版頂部仍保留簡單導覽，以及只在 Desktop 顯示的「管理員登入」。

### 4. 公開查詢資料
維持上一版私隱設定：公開查詢只顯示：
- 房間／物品名稱
- 借用日期或日期範圍

不顯示申請人、電話、用途、申請編號、備註等資料。

## Supabase 已部署舊版本時
如果管理員仍然收到 RLS / permission denied / insert denied 等錯誤，請在 Supabase SQL Editor 執行：

`supabase/20260909_admin_crud_fix.sql`

新建 Supabase Project 則直接執行完整：

`supabase/schema.sql`

## 主要更新檔案

```text
app.js
styles.css
admin-app.js
admin.css
README.md
supabase/20260909_admin_crud_fix.sql
```

## 部署
把整個資料夾覆蓋 GitHub repository 內容並 commit；Vercel 連接該 repository 時會自動重新部署。
