# 房間及物品預約系統

以概念圖為基礎製作的可部署版本。前端是 **零建置（no-build）SPA**，可直接放到 GitHub Pages 或 Vercel；登入、資料庫、權限、Realtime 跨平台同步由 **Supabase** 負責。

> 預設 `config.js` 為 `demoMode: true`。即使未建立 Supabase，也可以直接開網站試管理員／用戶流程。

## 已實作功能

### 管理員
- 建立多個機構
- 房間管理：名稱、位置、名額、啟用／停用
- 物品管理：名稱、位置、庫存數量、可獨立借用／需配合房間
- 每個資源可設定：
  - 指定日期時段
  - 每週循環時段
  - 循環開始／結束日期
- 查看所有申請
- 批准／拒絕／標記完成
- 批准時再次檢查：
  - 房間撞期
  - 物品庫存是否超額
  - 需要房間的物品是否已有已批准房間預約

### 一般用戶
- 選擇借用種類：房間／物品
- 選擇機構、資源、日期、時段
- 房間填寫預計人數；物品填寫數量
- 填寫用途、姓名、電話後提交
- 查詢自己的申請狀態
- 查看管理員備註
- 取消仍在待審批的申請

### 跨平台同步
- Supabase Auth
- PostgreSQL + RLS
- Supabase Realtime：管理員或用戶在另一部手機／電腦更新後會自動刷新
- PWA manifest + service worker，可在支援的手機瀏覽器加入主畫面

---

# 1. 先在本機預覽

不需要安裝 Node.js。

```bash
python -m http.server 8080
```

然後開：

```text
http://localhost:8080
```

預設會進入示範管理員畫面，可在頁頂切換成「用戶」畫面。

---

# 2. 建立 Supabase 資料庫

1. 建立新的 Supabase project。
2. 開啟 **SQL Editor**。
3. 執行：
   - `supabase/schema.sql`
4. 如想建立示範機構及資源，再執行：
   - `supabase/optional-demo-data.sql`

`schema.sql` 已包括：
- Tables
- Indexes
- RLS policies
- 明確 Data API grants
- Auth user -> profile trigger
- 提交申請 RPC
- 安全審批 RPC
- 房間／庫存防撞期邏輯
- Realtime publication

---

# 3. 建立第一個管理員

先用網站「註冊」一個帳戶，之後在 Supabase SQL Editor 執行：

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = '你的管理員電郵@example.com'
);
```

重新登入後就會看到管理員後台。

> 一般用戶不能自行把自己變成 admin。

---

# 4. 連接網站到 Supabase

在 Supabase Project 的 **Connect** 畫面取得：
- Project URL
- Publishable Key (`sb_publishable_...`)

修改 `config.js`：

```js
window.APP_CONFIG = {
  appName: '房間及物品預約系統',
  demoMode: false,
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabasePublishableKey: 'sb_publishable_xxxxxxxxx',
};
```

## 重要安全提示

**Publishable Key 可以放在前端。** 真正保護資料的是 RLS policies。

**絕對不要**把以下資料放入 `config.js`、GitHub 或瀏覽器：
- Supabase Secret Key (`sb_secret_...`)
- 舊式 `service_role` key
- Database password

---

# 5. Supabase Auth URL 設定

到 Supabase：

**Authentication → URL Configuration**

設定你的正式網址，例如：

### Vercel
```text
Site URL:
https://your-project.vercel.app

Redirect URLs:
https://your-project.vercel.app/**
```

### GitHub Pages
```text
https://YOUR_GITHUB_NAME.github.io/YOUR_REPOSITORY/**
```

本機測試可加入：

```text
http://localhost:8080/**
```

如果 Supabase 開啟「Confirm email」，新用戶需要先按確認電郵才能正常登入。

---

# 6. 部署到 GitHub

將整個資料夾推到 repository：

```bash
git init
git add .
git commit -m "Initial room resource booking system"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin main
```

## GitHub Pages

專案已包括：

```text
.github/workflows/pages.yml
```

到 GitHub：

**Settings → Pages → Source → GitHub Actions**

之後每次 push 到 `main` 都會自動部署。

---

# 7. 部署到 Vercel

1. 在 Vercel 選 **Add New → Project**。
2. Import 你的 GitHub repository。
3. Framework Preset 選 **Other**／靜態網站即可。
4. 不需要 Build Command。
5. Deploy。

此專案已包含 `vercel.json`，可直接由根目錄提供網站。

---

# 8. 主要檔案

```text
room-resource-booking-system/
├─ index.html                 # 網站入口
├─ styles.css                 # 完整 UI / responsive design
├─ app.js                     # 前端邏輯、Supabase、Realtime、Demo adapter
├─ config.js                  # 目前設定（預設 Demo Mode）
├─ config.example.js          # Supabase 設定範本
├─ manifest.webmanifest       # PWA
├─ sw.js                      # 離線 shell cache
├─ vercel.json                # Vercel 設定
├─ assets/
│  └─ app-icon.svg
├─ docs/
│  └─ concept-reference.png   # 今次使用的概念圖
├─ supabase/
│  ├─ schema.sql              # 必須執行
│  └─ optional-demo-data.sql  # 可選示範資料
└─ .github/workflows/
   └─ pages.yml               # GitHub Pages 自動部署
```

---

# 9. 資料結構

- `profiles`：用戶及 admin role
- `organizations`：機構
- `resources`：房間／物品
- `resource_availability`：指定日期或每週可借時段
- `bookings`：預約申請、狀態、管理員備註

系統故意將「房間」和「物品」放在同一 resource model，方便日後加：
- 車輛
- 場地
- 電子器材
- 運動器材
- 活動套裝

---

# 10. 建議下一階段功能

現版本已足以作第一版實際測試。下一階段可再加入：
- Email / WhatsApp 批核通知
- QR Code 借出／歸還
- 物品歸還狀態、損壞記錄
- 重複預約
- 假期／黑名單日期
- Calendar 月曆檢視
- Excel / PDF 報表
- 不同機構各自的 admin 權限
- 上載用途附件／活動文件
- 審批層級（主任 → 經理）
