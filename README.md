# 房間及物品預約系統 v10.9.2

v10.9.2 fixes the cumulative booking-window logic. A month that has already been released remains open until its dates pass; opening the next month no longer closes the previous month.

The LIVE Supabase project has already been migrated. Deploy the PATCH over the current site; `config.js` is intentionally not included in the PATCH.
