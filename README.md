# 房間及物品預約系統 — Responsive Split UI

本版本按 2026-09-09 最新要求更新，將**手機用戶版**與**桌面網頁版**的介面分開，同時保留獨立管理員後台。

## 1. 手機版（< 900px）

沿用已確認的手機概念圖：

- 首頁兩個大型按鈕：**預約 / 查詢**
- 預約後選擇：**房間 / 外借物品**
- 房間流程：房間 → 日曆日期 → 時段 → 是否需要同日中心使用物品 → 提交
- 外借物品流程：開始日期 → 預設一星期 → 可修改歸還日期 → 選物品 → 提交
- 底部導航列只保留：
  - **首頁**
  - **預約**
  - **查詢**
- 手機版不顯示「我的」
- 手機版不顯示管理員登入入口

## 2. 桌面網頁版（>= 900px）

桌面版改回接近原有系統風格：

- 左側 Sidebar
- 上方 Topbar
- 大型內容 Panel
- 功能：首頁 / 提交預約 / 資源借用查詢
- Sidebar 下方顯示 **管理員登入**

桌面版與手機版使用同一個 `index.html`，系統按 viewport 自動切換，不需兩個公開網址。

## 3. 管理員後台

管理員後台獨立於：

```text
/admin.html
```

保留原版本完整管理功能，包括：

- 管理員登入 / Supabase Auth
- 管理員總覽
- 機構管理
- 房間管理
- 物品管理
- 容量 / 庫存
- 可用日期及時段
- 預約申請審批
- 批准 / 拒絕 / 完成
- Supabase Realtime

為符合要求，`admin.html` 在手機寬度會顯示「請使用桌面版」提示，而不顯示登入介面。

## 4. 公開查詢頁私隱調整

公開查詢頁現在只顯示：

- **房間 / 物品名稱**
- **借用日期**
- 外借物品會顯示借用日期範圍

不再公開顯示：

- 申請編號
- 申請人姓名
- 電話
- 用途
- 備註
- 詳細申請內容

目前公開列表只顯示已批准 / 已歸還的借用紀錄，不公開待審批申請資料。

## 5. 主要檔案

```text
room-resource-booking-system/
├── index.html              # 公開網站，自動切換手機 / 桌面 UI
├── app.js                  # 公開預約流程
├── styles.css              # Responsive 公開 UI
│
├── admin.html              # 桌面管理員入口
├── admin-app.js            # 原完整管理員系統功能
├── admin.css               # 原管理員 / 後台介面
│
├── config.js               # Supabase / Demo 設定
├── config.example.js
├── manifest.webmanifest
├── sw.js
├── vercel.json
├── assets/
│   └── app-icon.svg
└── supabase/
    ├── schema.sql
    └── optional-demo-data.sql
```

## 6. 部署

可直接上傳整個資料夾到 GitHub repository，然後使用 Vercel 部署。

`vercel.json`、GitHub Pages workflow、Supabase schema 均保留。

### 正式 Supabase

如使用正式 Supabase：

```js
window.APP_CONFIG = {
  appName: '房間及物品預約系統',
  demoMode: false,
  supabaseUrl: 'YOUR_PROJECT_URL',
  supabasePublishableKey: 'YOUR_PUBLISHABLE_KEY'
};
```

管理員登入使用 Supabase Auth 及 `profiles.role = 'admin'` 權限。
