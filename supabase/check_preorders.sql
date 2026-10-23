-- Mom's Perisa — pre-order diagnostics (read-only).
-- Run this in the Supabase SQL Editor to see why a pre-order is not being saved.
-- It changes nothing. Copy the whole result if you need help.

-- 1. Are the pieces the ordering flow needs present?
select 'create_preorder() function' as check_name,
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'create_preorder'
       ) then 'ok' else 'MISSING -> run supabase/fix_preorders.sql' end as status
union all
select 'ensure_my_profile() function',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'ensure_my_profile'
       ) then 'ok' else 'MISSING -> run supabase/fix_preorders.sql' end
union all
select 'orders table',
       case when to_regclass('public.orders') is not null then 'ok' else 'MISSING -> run supabase/schema.sql' end
union all
select 'order_items table',
       case when to_regclass('public.order_items') is not null then 'ok' else 'MISSING -> run supabase/schema.sql' end
union all
select 'notifications table',
       case when to_regclass('public.notifications') is not null then 'ok' else 'MISSING -> run supabase/phase1_workflows.sql' end
union all
select 'reviews table (the order lists join it)',
       case when to_regclass('public.reviews') is not null then 'ok' else 'MISSING -> run supabase/phase1_workflows.sql' end
union all
select 'orders RLS enabled',
       case when exists (select 1 from pg_class c where c.oid = to_regclass('public.orders') and c.relrowsecurity) then 'ok' else 'MISSING -> run supabase/fix_preorders.sql' end
union all
select 'orders SELECT policy',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and cmd = 'SELECT') then 'ok' else 'MISSING -> run supabase/fix_preorders.sql' end
union all
select 'orders UPDATE policy (cook actions)',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and cmd = 'UPDATE') then 'ok' else 'MISSING -> run supabase/fix_preorders.sql' end
union all
select 'orders.status allows cooking/ready/handed_over',
       case when exists (
         select 1 from pg_constraint c
          where c.conrelid = to_regclass('public.orders')
            and c.contype = 'c'
            and pg_get_constraintdef(c.oid) like '%handed_over%'
       ) then 'ok' else 'MISSING -> run supabase/phase1_workflows.sql' end;

-- If section 1 reported a MISSING table, run the matching SQL file first and then
-- re-run this script; the queries below need those tables to exist.

-- 2. Accounts that have no profiles row. These accounts cannot order at all,
--    because the website cannot tell that they are customers.
--    "accounts_without_profile" should be 0.
select count(*) as accounts_without_profile
  from auth.users u
  left join public.profiles p on p.id = u.id
 where p.id is null;

-- 3. The role of each account. The account used for ordering must be "customer".
select u.email, p.role, p.display_name, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
 order by p.created_at desc
 limit 20;

-- 4. Orders actually stored, newest first.
select o.created_at, o.id, o.status, o.total_amount,
       cu.email as customer_email, ko.email as cook_email,
       (select string_agg(oi.quantity || ' x ' || oi.dish_name, ', ') from public.order_items oi where oi.order_id = o.id) as items
  from public.orders o
  left join auth.users cu on cu.id = o.customer_id
  left join auth.users ko on ko.id = o.cook_id
 order by o.created_at desc
 limit 10;

-- 5. Dishes that customers can actually order right now.
--    If this is empty the Pre-order button has nothing valid to order.
select d.name, d.status, d.available, d.portions_available, d.price,
       u.email as cook_email,
       exists (select 1 from public.cook_applications ca
                where ca.user_id = d.cook_id and ca.status = 'approved') as cook_is_approved
  from public.dishes d
  left join auth.users u on u.id = d.cook_id
 order by d.created_at desc
 limit 20;
