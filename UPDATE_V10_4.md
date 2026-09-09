# v10.4 — Telegram 新申請通知

- 管理員後台新增「Telegram 通知」頁面。
- Bot Token 透過 Supabase Vault 加密保存，不回傳原始 Token 到前端。
- 可設定個人／群組 Chat ID。
- 可啟用／停用通知。
- 可由後台直接發送測試通知。
- 新房間／物品申請會在交易完成後異步發送 Telegram。
- 房間＋同日物品及多件外借會合併成單一通知。
- Telegram API 錯誤不影響預約資料寫入。
