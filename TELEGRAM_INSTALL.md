# Telegram 通知安裝及設定指引（v10.4）

v10.4 已將 Telegram 設定整合到管理員後台，Bot Token 會透過管理員 RPC 加密存入 **Supabase Vault**，不會寫入 `config.js`、前端 JS 或公開 ZIP。

## A. 目前 LIVE Supabase
如果你使用目前的 `room-resource-booking-system` LIVE Supabase，只要：

1. 更新網站至 v10.4。
2. 登入 `admin.html`。
3. 左側選單按 **Telegram 通知**。
4. 填入 Bot Token、Chat ID。
5. 勾選 **啟用新申請 Telegram 通知**。
6. 按 **儲存設定**。
7. 按 **發送測試通知**。

資料庫及通知 Trigger 已經設定完成，不需要再次執行 SQL。

## B. 建立 Telegram Bot
1. 在 Telegram 搜尋官方 **@BotFather**。
2. 傳送 `/newbot`。
3. 按指示設定 Bot 名稱及 username。
4. BotFather 會回覆一組 Bot Token，例如 `123456789:AA...`。
5. 開啟你剛建立的 Bot，按 **Start** 或傳送 `/start`。

> Bot Token 屬於密鑰，請勿貼到 `config.js`、GitHub、公開訊息或網站 HTML。

## C. 取得 Chat ID
向 Bot 傳送 `/start` 後，在瀏覽器輸入：

`https://api.telegram.org/bot<你的BOT_TOKEN>/getUpdates`

在 JSON 結果中尋找：

`"chat":{"id":123456789,...}`

其中 `123456789` 就是 Chat ID。

### 發送到群組
1. 把 Bot 加入 Telegram 群組。
2. 在群組傳送一則訊息。
3. 再開 `getUpdates`。
4. 群組 Chat ID 通常會是負數，例如 `-1001234567890`。

## D. 後台設定
進入：

**管理員後台 → Telegram 通知**

填寫：
- **Bot Token**：BotFather 提供的 token
- **Telegram Chat ID**：你的個人／群組 Chat ID
- 勾選 **啟用新申請 Telegram 通知**

按 **儲存設定**。

Token 儲存後，後台只會顯示「已安全設定」，不會把原始 Token 再傳回瀏覽器。

## E. 測試
在同一頁按 **發送測試通知**。

Telegram 應收到：

`✅ 房間及物品預約系統 Telegram 通知測試成功。`

測試成功後，再由前台正式提交一個新申請。

## F. 正式新申請通知內容
通知會包括：
- 申請編號
- 所屬機構
- 房間／物品類型
- 申請人
- 電話
- 用途
- 備註
- 房間、日期、時間
- 同日物品及數量
- 或外借物品、數量、借用至歸還日期
- 提交時間
- 待審批狀態

房間連物品只會整合成 **一則通知**；一次外借多件物品亦會整合成 **一則通知**。

## G. 安裝到另一個 Supabase project
如果不是目前 LIVE project：

1. 確保已有原系統 schema，包括 `private.is_admin()`。
2. 執行：
   `supabase/20260909_v10_4_telegram_notifications.sql`
3. 更新網站 v10.4 檔案。
4. 進管理員後台 → Telegram 通知完成設定。

## H. 收不到通知時檢查
SQL Editor：

```sql
select id,status_code,error_msg,content,created
from net._http_response
order by created desc
limit 20;
```

常見原因：
- Bot Token 錯誤
- Chat ID 錯誤
- 未向 Bot 按 Start／傳送 `/start`
- Bot 被封鎖
- 群組未加入 Bot
- Telegram API 暫時不可用

Telegram 發送失敗 **不會阻止原本預約申請提交成功**。
