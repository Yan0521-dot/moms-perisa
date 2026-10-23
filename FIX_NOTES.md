# Fix notes — Pre-order button produced no order

## What was wrong

The website never inserted into `orders` directly. It calls one database function,
`public.create_preorder(...)`, and then reads the new row back. Three things could make
that whole flow end in complete silence:

1. **No `profiles` row for the account.** `role` comes from `profiles.role`, and the order
   sheet was only rendered when `role === 'customer'`. An account created before the
   `handle_new_user()` trigger existed (or before the SQL was applied) has no profile row,
   so `role` stayed `null`: clicking **Pre-order** opened nothing, no request was sent, and
   the cook never saw an order. The customer's "My orders" page and the cook dashboard are
   gated on the same value.
2. **A missing database function or missing tables.** Without `create_preorder()`,
   `order_items`, `notifications`, or `reviews`, Supabase rejects the order. The order lists
   even join `reviews` and `notifications`, so a missing table also leaves both dashboards
   empty.
3. **The error was invisible.** Failures were written to the page-level error banner, which
   renders *behind* the fixed modal backdrop. The form simply stayed on screen, so a failed
   order looked identical to a successful one that was never saved.

## What changed in the website

- The order sheet now opens for every signed-in account. Cook and admin accounts get an
  explicit explanation instead of a dead button.
- A failed pre-order is reported **inside the order sheet**, with the actual database message
  translated into an action (missing function, missing profile, RLS, dish unavailable, ...).
- Every order is verified after creation: the app re-reads the new row and only shows
  "Pre-order submitted" when that row exists. No more fake success states.
- If the signed-in account has no profile row, the app calls `ensure_my_profile()` and
  creates it, then shows a banner if it still cannot.
- Live updates: the cook sees a new pre-order immediately through Supabase realtime, on top
  of the existing 15-second poll. The cook's Orders tab shows a count of pending orders.
- The preferred date now uses the local calendar day instead of UTC.

## What you must run in Supabase (once)

In **Supabase → SQL Editor**:

1. Run `supabase/check_preorders.sql` to see what is missing.
2. Run `supabase/fix_preorders.sql` (safe to repeat, deletes nothing). It creates the
   missing profile rows, `create_preorder()`, `ensure_my_profile()`, the order triggers,
   RLS policies, and table grants.
3. Re-run `supabase/check_preorders.sql`. Every row should be `ok` and
   `accounts_without_profile` should be `0`.
4. Reload the website, sign out, and sign in again.
5. Place a test pre-order. Check **Table Editor → orders** and **order_items**: both rows
   appear immediately. The cook account gets a "New pre-order" notification and the order
   in **My dashboard → Orders for my menu**.

If the account you order with shows `cook` or `admin` in the report, that is the whole
problem — use a customer account, or run:

```sql
update public.profiles set role = 'customer' where id = 'THE-USER-UUID';
```

## Verifying locally

`npm install` then `npm run dev`. The app reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` from `.env.local`.

A failed order now always shows a red box in the order dialog, for example:

> **Pre-order not saved**
> Your Supabase project does not have the create_preorder() database function, so no order
> can be saved. Run supabase/fix_preorders.sql in the Supabase SQL Editor, then try again.
