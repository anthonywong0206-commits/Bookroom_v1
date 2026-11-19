# v10.9.2 — Booking window cumulative release fix

## Fixed
- Fixed an issue where a previously opened month became closed when the next monthly release occurred.
- Example: if 15 Oct 12:00 opens November, November remains bookable after 15 Nov 12:00 opens December.
- Frontend date selection and server-side submission validation now use the same cumulative rule.
- Past dates remain unavailable.

## Database
The LIVE Supabase project has already been migrated. The SQL file is included only for reproducibility.
