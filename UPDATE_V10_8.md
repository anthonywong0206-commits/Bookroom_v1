# v10.8 Mobile UI Fix

- 手機底部導航固定貼齊畫面最低位置，捲動頁面時不會跟隨內容移位。
- 支援 iPhone safe-area，Home Indicator 不會遮住導航。
- 表單輸入字體固定最少 16px，避免 iOS Safari 輸入時自動放大頁面。
- 使用 Visual Viewport API 處理手機鍵盤開合，減少畫面跳動。
- 申請者姓名、電話、用途及備註輸入時，focus 欄位保持在可視區域。
- 本版本不需要 Supabase schema 更新。
