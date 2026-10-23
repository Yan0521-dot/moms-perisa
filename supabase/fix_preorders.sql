-- Mom's Perisa — pre-order repair script.
-- Use this when "Pre-order" appears to do nothing, when an order does not appear
-- in the Supabase orders table, or when the customer/cook dashboards stay empty.
--
-- It is safe to run more than once and it deletes no data.
-- Run the WHOLE file in the Supabase SQL Editor as the project owner.
--
-- What it does:
--   1. Stops with a clear message if schema.sql was never applied.
--   2. Makes sure the orders / order_items / notifications / reviews tables and
--      every column the website reads exist.
--   3. Creates a profile row for auth users that are missing one. This is the most
--      common cause of a silent "Pre-order" click: without a profiles row the app
--      cannot tell that the signed-in user is a customer.
--   4. Re-creates the create_preorder() database function and all order triggers.
--   5. Restores the row-level-security policies and table grants the app relies on.
--   6. Prints a verification report at the end.

begin;

-- 1. Base schema check -------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.dishes') is null
     or to_regclass('public.cook_applications') is null then
    raise exception 'Base tables are missing. Run supabase/schema.sql first, then this file.';
  end if;
end $$;

-- 2. Tables and columns the ordering flow needs ------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  cook_id uuid not null references public.profiles(id),
  preferred_date date not null,
  preferred_time text,
  fulfilment_method text not null default 'pickup',
  customer_note text not null default '',
  status text not null default 'pending',
  payment_status text not null default 'external',
  total_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists customer_display_name text;
alter table public.orders add column if not exists customer_received_confirmation boolean;
alter table public.orders add column if not exists customer_confirmed_at timestamptz;
alter table public.orders add column if not exists handed_over_at timestamptz;
alter table public.orders add column if not exists payment_status text not null default 'external';
alter table public.orders add column if not exists total_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists updated_at timestamptz not null default now();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  dish_id uuid references public.dishes(id) on delete set null,
  dish_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  related_order_id uuid references public.orders(id) on delete cascade,
  kind text not null default 'general',
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  cook_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Columns the public menu query and the dashboards read from profiles.
alter table public.profiles add column if not exists hygiene_review_status text not null default 'not_submitted';
alter table public.profiles add column if not exists hygiene_last_updated_at timestamptz;
alter table public.profiles add column if not exists hygiene_pending_since timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','accepted','cooking','ready','handed_over','completed','rejected','cancelled'));

create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_cook_idx on public.orders(cook_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- 3. Repair missing profile rows --------------------------------------------
-- Accounts created before handle_new_user() existed have no profiles row. The
-- website then cannot know the account is a customer, so Pre-order does nothing.
insert into public.profiles (id, display_name, role)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Mom’s Perisa customer'),
       case
         when u.raw_user_meta_data->>'requested_role' in ('customer', 'cook')
           then u.raw_user_meta_data->>'requested_role'
         else 'customer'
       end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Keep the trigger in place so new sign-ups always get a profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'requested_role', 'customer');
  if requested_role not in ('customer', 'cook') then requested_role := 'customer'; end if;
  insert into public.profiles (id, display_name, role)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Mom’s Perisa customer'),
          requested_role)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Self-heal RPC the website calls when the signed-in account has no profile row.
create or replace function public.ensure_my_profile()
returns public.profiles language plpgsql security definer set search_path = public as $$
declare found_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  select * into found_profile from public.profiles where id = auth.uid();
  if found then return found_profile; end if;
  insert into public.profiles (id, display_name, role)
  values (
    auth.uid(),
    coalesce(nullif((select u.raw_user_meta_data->>'display_name' from auth.users u where u.id = auth.uid()), ''), 'Mom’s Perisa customer'),
    'customer'
  )
  on conflict (id) do nothing;
  select * into found_profile from public.profiles where id = auth.uid();
  return found_profile;
end; $$;
revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

-- 4. Order functions and triggers -------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.is_approved_cook(cook_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cook_applications ca where ca.user_id = cook_user_id and ca.status = 'approved');
$$;

create or replace function public.protect_order_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare expected_total numeric(10,2); customer_name text;
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.customer_id is distinct from auth.uid() then
        raise exception 'You can only place an order for your own account';
      end if;
      new.status := 'pending';
      new.payment_status := 'external';
      new.total_amount := 0;
      select p.display_name into customer_name from public.profiles p where p.id = auth.uid();
      new.customer_display_name := customer_name;
    elsif tg_op = 'UPDATE' then
      if new.id is distinct from old.id
         or new.customer_id is distinct from old.customer_id
         or new.cook_id is distinct from old.cook_id
         or new.preferred_date is distinct from old.preferred_date
         or new.preferred_time is distinct from old.preferred_time
         or new.fulfilment_method is distinct from old.fulfilment_method
         or new.customer_note is distinct from old.customer_note
         or new.payment_status is distinct from old.payment_status
         or new.customer_display_name is distinct from old.customer_display_name then
        raise exception 'Order details cannot be changed';
      end if;
      if new.total_amount is distinct from old.total_amount then
        select coalesce(sum(oi.unit_price * oi.quantity), 0) into expected_total
          from public.order_items oi where oi.order_id = old.id;
        if new.total_amount is distinct from expected_total then
          raise exception 'Order total must match its items';
        end if;
        if old.cook_id = auth.uid() then raise exception 'Cook cannot change order totals'; end if;
      end if;
      if new.customer_received_confirmation is distinct from old.customer_received_confirmation
         and auth.uid() is distinct from old.customer_id then
        raise exception 'Only the customer can confirm receipt';
      end if;
      if new.customer_confirmed_at is distinct from old.customer_confirmed_at
         and auth.uid() is distinct from old.customer_id then
        raise exception 'Only the customer can confirm receipt';
      end if;
      if new.handed_over_at is distinct from old.handed_over_at
         and auth.uid() is distinct from old.cook_id then
        raise exception 'Only the assigned cook can mark an order as handed over';
      end if;
      if new.status is distinct from old.status then
        if old.cook_id = auth.uid() then
          null;
        elsif old.customer_id = auth.uid()
              and old.status = 'handed_over'
              and new.status = 'completed'
              and new.customer_received_confirmation = true
              and old.customer_received_confirmation is null then
          null;
        else
          raise exception 'Only the assigned cook can update order status';
        end if;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists protect_order_changes_trigger on public.orders;
create trigger protect_order_changes_trigger before insert or update on public.orders
  for each row execute procedure public.protect_order_changes();

create or replace function public.validate_order_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare order_row public.orders%rowtype; dish_row public.dishes%rowtype;
begin
  select * into order_row from public.orders where id = new.order_id;
  select * into dish_row from public.dishes where id = new.dish_id;
  if not found or dish_row.status <> 'approved' or not dish_row.available then
    raise exception 'Dish is not available';
  end if;
  if order_row.cook_id <> dish_row.cook_id then
    raise exception 'Dish does not belong to the selected cook';
  end if;
  if new.quantity < 1 or dish_row.portions_available < new.quantity then
    raise exception 'Not enough portions are available';
  end if;
  new.dish_name := dish_row.name;
  new.unit_price := dish_row.price;
  return new;
end; $$;
drop trigger if exists validate_order_item_trigger on public.order_items;
create trigger validate_order_item_trigger before insert or update on public.order_items
  for each row execute procedure public.validate_order_item();

create or replace function public.recalculate_order_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare affected_order_id uuid;
begin
  affected_order_id := coalesce(new.order_id, old.order_id);
  update public.orders o
     set total_amount = coalesce((select sum(oi.unit_price * oi.quantity) from public.order_items oi where oi.order_id = affected_order_id), 0),
         updated_at = now()
   where o.id = affected_order_id;
  if tg_op = 'DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists recalculate_order_total_trigger on public.order_items;
create trigger recalculate_order_total_trigger after insert or update or delete on public.order_items
  for each row execute procedure public.recalculate_order_total();

create or replace function public.set_handover_timestamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'handed_over' and old.status is distinct from new.status then
    new.handed_over_at := now();
  end if;
  return new;
end; $$;
drop trigger if exists set_handover_timestamp_trigger on public.orders;
create trigger set_handover_timestamp_trigger before update on public.orders
  for each row execute procedure public.set_handover_timestamp();

-- The cook's "New pre-order" notification. This is how a cook notices an order.
create or replace function public.notify_order_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (recipient_id, related_order_id, kind, title, body)
    values (new.cook_id, new.id, 'new_order', 'New pre-order',
            'A customer has submitted a pre-order. Please review it in your cook dashboard.');
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.notifications (recipient_id, related_order_id, kind, title, body)
    values (new.customer_id, new.id, 'order_status', 'Your order has been updated',
      case new.status
        when 'accepted' then 'The cook accepted your pre-order.'
        when 'cooking' then 'Your food is being prepared.'
        when 'ready' then 'Your order is ready for collection.'
        when 'handed_over' then 'The cook marked your order as handed over. Please confirm whether you received it.'
        when 'rejected' then 'The cook could not accept this pre-order.'
        when 'cancelled' then 'Your order was cancelled.'
        when 'completed' then 'Your order is complete.'
        else 'Your order status changed to ' || new.status || '.'
      end);
  end if;
  return new;
end; $$;
drop trigger if exists notify_order_events_trigger on public.orders;
create trigger notify_order_events_trigger after insert or update on public.orders
  for each row execute procedure public.notify_order_events();

create or replace function public.restore_dish_portions_on_order_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare item_row record;
begin
  if new.status in ('rejected', 'cancelled') and old.status not in ('rejected', 'cancelled') then
    for item_row in select dish_id, quantity from public.order_items where order_id = new.id and dish_id is not null
    loop
      update public.dishes set portions_available = least(500, portions_available + item_row.quantity)
       where id = item_row.dish_id;
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists restore_dish_portions_on_order_cancel_trigger on public.orders;
create trigger restore_dish_portions_on_order_cancel_trigger after update of status on public.orders
  for each row execute procedure public.restore_dish_portions_on_order_cancel();

-- The single supported way to create a pre-order. Direct inserts are not allowed.
create or replace function public.create_preorder(
  p_cook_id uuid, p_dish_id uuid, p_quantity integer, p_preferred_date date,
  p_preferred_time text default '', p_fulfilment_method text default 'pickup', p_customer_note text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare selected_dish public.dishes%rowtype; created_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in before ordering'; end if;
  if p_preferred_date is null or p_preferred_date < current_date then
    raise exception 'Choose today or a future date';
  end if;
  if char_length(coalesce(p_customer_note, '')) > 500 then raise exception 'Order note is too long'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least one'; end if;
  if p_fulfilment_method not in ('pickup', 'arrange') then raise exception 'Invalid fulfilment method'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer') then
    raise exception 'Customer account required';
  end if;
  select * into selected_dish
    from public.dishes d
   where d.id = p_dish_id
     and d.cook_id = p_cook_id
     and d.status = 'approved'
     and d.available = true
     and d.portions_available >= p_quantity
   for update;
  if not found then raise exception 'This dish is unavailable or there are not enough portions'; end if;
  if not public.is_approved_cook(p_cook_id) then raise exception 'This cook is not approved'; end if;
  insert into public.orders (
    customer_id, cook_id, preferred_date, preferred_time, fulfilment_method,
    customer_note, status, payment_status, total_amount, customer_display_name
  ) values (
    auth.uid(), p_cook_id, p_preferred_date, nullif(p_preferred_time, ''), p_fulfilment_method,
    coalesce(p_customer_note, ''), 'pending', 'external', 0,
    (select p.display_name from public.profiles p where p.id = auth.uid())
  ) returning id into created_order_id;
  insert into public.order_items (order_id, dish_id, dish_name, unit_price, quantity)
  values (created_order_id, selected_dish.id, selected_dish.name, selected_dish.price, p_quantity);
  update public.dishes set portions_available = portions_available - p_quantity
   where id = selected_dish.id;
  return created_order_id;
end; $$;
revoke all on function public.create_preorder(uuid, uuid, integer, date, text, text, text) from public;
grant execute on function public.create_preorder(uuid, uuid, integer, date, text, text, text) to authenticated;

create or replace function public.confirm_order_received(p_order_id uuid, p_received boolean)
returns void language plpgsql security definer set search_path = public as $$
declare target public.orders%rowtype;
begin
  select * into target from public.orders where id = p_order_id for update;
  if not found or target.customer_id <> auth.uid() then raise exception 'Order not found'; end if;
  if target.status <> 'handed_over' then raise exception 'The cook must mark the order as handed over first'; end if;
  if target.customer_received_confirmation is not null then raise exception 'Receipt has already been confirmed'; end if;
  update public.orders
     set customer_received_confirmation = p_received,
         customer_confirmed_at = now(),
         status = case when p_received then 'completed' else status end,
         updated_at = now()
   where id = p_order_id;
  if not p_received then
    insert into public.notifications (recipient_id, related_order_id, kind, title, body)
    values (target.cook_id, target.id, 'receipt_issue', 'Customer reported an order issue',
            'The customer said they have not received the order. Please contact them and resolve it.');
  end if;
end; $$;
revoke all on function public.confirm_order_received(uuid, boolean) from public;
grant execute on function public.confirm_order_received(uuid, boolean) to authenticated;

-- Reserving portions updates public.dishes. The base-schema version of this trigger
-- sends every cook edit back to 'pending', which would unpublish a dish as soon as
-- somebody ordered it. Keep inventory-only updates published.
create or replace function public.protect_dish_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
    elsif old.name is distinct from new.name
       or old.description is distinct from new.description
       or old.ingredients is distinct from new.ingredients
       or old.price is distinct from new.price
       or old.category is distinct from new.category
       or old.image_url is distinct from new.image_url then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists protect_dish_approval_trigger on public.dishes;
create trigger protect_dish_approval_trigger before insert or update on public.dishes
  for each row execute procedure public.protect_dish_approval();

-- 5. Row-level security and grants ------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;

-- Only the two parties of an order (and admins) may read it. Anonymous visitors
-- and other customers can never see someone else's pre-order.
drop policy if exists "customer cook or admin read orders" on public.orders;
create policy "customer cook or admin read orders" on public.orders
  for select to authenticated
  using (customer_id = auth.uid() or cook_id = auth.uid() or public.is_admin());

-- Direct inserts are intentionally disabled; create_preorder() is the only path.
drop policy if exists "customer create preorders" on public.orders;

drop policy if exists "cook update assigned orders or admin" on public.orders;
create policy "cook update assigned orders or admin" on public.orders
  for update to authenticated
  using (cook_id = auth.uid() or public.is_admin())
  with check (cook_id = auth.uid() or public.is_admin());

drop policy if exists "order items visible to order parties" on public.order_items;
create policy "order items visible to order parties" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_id
       and (o.customer_id = auth.uid() or o.cook_id = auth.uid() or public.is_admin())
  ));
drop policy if exists "customer add items to own preorder" on public.order_items;

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews
  for select to anon, authenticated using (true);

drop policy if exists "customer review confirmed order" on public.reviews;
create policy "customer review confirmed order" on public.reviews
  for insert to authenticated with check (
    customer_id = auth.uid() and exists (
      select 1 from public.orders o
       where o.id = order_id
         and o.customer_id = auth.uid()
         and o.cook_id = reviews.cook_id
         and o.customer_received_confirmation = true
         and o.status in ('handed_over', 'completed')
    )
  );

-- Table grants. Without these PostgREST answers "permission denied for table".
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

commit;

-- 6. Verification report ----------------------------------------------------
-- Every row below should say "ok". If one does not, copy the whole result back.
select 'create_preorder() function' as check_name,
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'create_preorder'
       ) then 'ok' else 'MISSING' end as status
union all
select 'ensure_my_profile() function',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'ensure_my_profile'
       ) then 'ok' else 'MISSING' end
union all
select 'orders table',
       case when to_regclass('public.orders') is not null then 'ok' else 'MISSING' end
union all
select 'order_items table',
       case when to_regclass('public.order_items') is not null then 'ok' else 'MISSING' end
union all
select 'notifications table',
       case when to_regclass('public.notifications') is not null then 'ok' else 'MISSING' end
union all
select 'orders RLS enabled',
       case when exists (select 1 from pg_class c where c.oid = to_regclass('public.orders') and c.relrowsecurity) then 'ok' else 'MISSING' end
union all
select 'orders select policy',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and cmd = 'SELECT') then 'ok' else 'MISSING' end
union all
select 'accounts without a profile: ' || count(*)::text,
       case when count(*) = 0 then 'ok' else 'run this script again' end
  from auth.users u left join public.profiles p on p.id = u.id where p.id is null
union all
select 'pre-orders stored: ' || count(*)::text, 'info' from public.orders;

-- Accounts and roles (check that the account you order with says "customer").
select u.email, p.role, p.created_at
  from public.profiles p join auth.users u on u.id = p.id
 order by p.created_at desc
 limit 10;
