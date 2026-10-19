-- Mom's Perisa Phase 1 workflow extension.
-- Run this AFTER supabase/schema.sql in the Supabase SQL Editor.
-- It adds recurring hygiene checks, menu moderation notes, notifications, receipt confirmation, and reviews.

alter table public.profiles
  add column if not exists hygiene_review_status text not null default 'not_submitted'
    check (hygiene_review_status in ('not_submitted','pending','approved','changes_requested')),
  add column if not exists hygiene_last_updated_at timestamptz,
  add column if not exists hygiene_pending_since timestamptz;

alter table public.dishes add column if not exists moderation_note text;
alter table public.orders add column if not exists customer_received_confirmation boolean;
alter table public.orders add column if not exists customer_confirmed_at timestamptz;
alter table public.orders add column if not exists handed_over_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','accepted','cooking','ready','handed_over','completed','rejected','cancelled'));

create table if not exists public.hygiene_submissions (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','changes_requested')),
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists hygiene_submissions_cook_time_idx on public.hygiene_submissions(cook_id, submitted_at desc);

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
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  cook_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists reviews_cook_created_idx on public.reviews(cook_id, created_at desc);

alter table public.hygiene_submissions enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;


create or replace function public.sync_initial_hygiene_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='approved' and (old.status is distinct from new.status or old.hygiene_status is distinct from new.hygiene_status) then
    update public.profiles set hygiene_review_status='approved', hygiene_last_updated_at=now(), hygiene_pending_since=null where id=new.user_id;
  elsif new.hygiene_status='changes_requested' and old.hygiene_status is distinct from new.hygiene_status then
    update public.profiles set hygiene_review_status='changes_requested', hygiene_pending_since=now() where id=new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists sync_initial_hygiene_status_trigger on public.cook_applications;
create trigger sync_initial_hygiene_status_trigger after update on public.cook_applications
  for each row execute procedure public.sync_initial_hygiene_status();

-- Private hygiene files and submissions are only visible to the cook and admin.
drop policy if exists "cook/admin read hygiene submissions" on public.hygiene_submissions;
create policy "cook/admin read hygiene submissions" on public.hygiene_submissions
  for select to authenticated using (cook_id = auth.uid() or public.is_admin());
drop policy if exists "cook submit own hygiene evidence" on public.hygiene_submissions;
create policy "cook submit own hygiene evidence" on public.hygiene_submissions
  for insert to authenticated with check (
    cook_id = auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='cook')
  );
drop policy if exists "admin review hygiene submissions" on public.hygiene_submissions;
create policy "admin review hygiene submissions" on public.hygiene_submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Users can read and mark only their own notifications as read.
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Reviews are public, but a customer can review only an order they confirmed receiving.
drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews for select to anon, authenticated using (true);
drop policy if exists "customer review confirmed order" on public.reviews;
create policy "customer review confirmed order" on public.reviews for insert to authenticated with check (
  customer_id = auth.uid() and exists (
    select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()
      and o.cook_id=reviews.cook_id and o.customer_received_confirmation=true
      and o.status in ('handed_over','completed')
  )
);

-- Profile updates from the browser are limited to display_name. Admin role and hygiene status
-- are managed through trusted SQL/trigger workflows, not ordinary client updates.
revoke update on public.profiles from public, anon, authenticated;
grant update(display_name) on public.profiles to authenticated;

create or replace function public.sync_hygiene_public_status()
returns trigger language plpgsql security definer set search_path=public as $$
declare newer_pending timestamptz;
begin
  if tg_op = 'INSERT' then
    update public.profiles set hygiene_review_status='pending', hygiene_pending_since=new.submitted_at where id=new.cook_id;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status='approved' then
      select min(h.submitted_at) into newer_pending from public.hygiene_submissions h
        where h.cook_id=new.cook_id and h.id<>new.id and h.status in ('pending','changes_requested');
      if newer_pending is not null then
        update public.profiles set hygiene_review_status='pending', hygiene_pending_since=newer_pending where id=new.cook_id;
      else
        update public.profiles set hygiene_review_status='approved', hygiene_last_updated_at=coalesce(new.reviewed_at,now()), hygiene_pending_since=null where id=new.cook_id;
      end if;
    elsif new.status='changes_requested' then
      update public.profiles set hygiene_review_status='changes_requested' where id=new.cook_id;
    elsif new.status='pending' then
      update public.profiles set hygiene_review_status='pending', hygiene_pending_since=new.submitted_at where id=new.cook_id;
    end if;
    new.reviewed_by := case when public.is_admin() then auth.uid() else new.reviewed_by end;
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;
  return new;
end; $$;
drop trigger if exists sync_hygiene_public_status_trigger on public.hygiene_submissions;
create trigger sync_hygiene_public_status_trigger before insert or update on public.hygiene_submissions
  for each row execute procedure public.sync_hygiene_public_status();


create or replace function public.set_handover_timestamp()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='handed_over' and old.status is distinct from new.status then new.handed_over_at := now(); end if;
  return new;
end; $$;
drop trigger if exists set_handover_timestamp_trigger on public.orders;
create trigger set_handover_timestamp_trigger before update on public.orders
  for each row execute procedure public.set_handover_timestamp();

create or replace function public.notify_order_events()
returns trigger language plpgsql security definer set search_path=public as $$
declare cook_name text; dish_names text;
begin
  if tg_op='INSERT' then
    insert into public.notifications(recipient_id, related_order_id, kind, title, body)
      values(new.cook_id,new.id,'new_order','New pre-order','A customer has submitted a pre-order. Please review it in your cook dashboard.');
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.notifications(recipient_id, related_order_id, kind, title, body)
      values(new.customer_id,new.id,'order_status','Your order has been updated',
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


create or replace function public.notify_application_review()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status is distinct from old.status or new.ssm_status is distinct from old.ssm_status or new.hygiene_status is distinct from old.hygiene_status then
    insert into public.notifications(recipient_id,kind,title,body)
      values(new.user_id,'application_review','Your cook verification was updated',
        case when new.status='approved' then 'Your SSM and initial kitchen checks are approved. You can submit menu items for review.'
             when new.status='changes_requested' then coalesce(new.rejection_reason,'Your application needs corrections. Please check the admin feedback.')
             else 'The admin updated the review status of your cook application.' end);
  end if;
  return new;
end; $$;
drop trigger if exists notify_application_review_trigger on public.cook_applications;
create trigger notify_application_review_trigger after update on public.cook_applications
  for each row execute procedure public.notify_application_review();

-- Notify customers who previously ordered a dish when the cook changes its public details.
create or replace function public.notify_dish_customers()
returns trigger language plpgsql security definer set search_path=public as $$
declare customer_row record;
begin
  if old.status is distinct from new.status or old.name is distinct from new.name or old.description is distinct from new.description or old.ingredients is distinct from new.ingredients or old.price is distinct from new.price or old.image_url is distinct from new.image_url or old.available is distinct from new.available or old.category is distinct from new.category then
    for customer_row in
      select distinct o.customer_id from public.orders o join public.order_items oi on oi.order_id=o.id
      where oi.dish_id=new.id and o.cook_id=new.cook_id and o.customer_id is not null
    loop
      insert into public.notifications(recipient_id, kind, title, body)
        values(customer_row.customer_id,'menu_update','A cook updated a menu item',new.name || ' was updated by the home cook. Check the latest menu details before ordering again.');
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists notify_dish_customers_trigger on public.dishes;
create trigger notify_dish_customers_trigger after update on public.dishes
  for each row execute procedure public.notify_dish_customers();

-- Replace the base order guard so customers can confirm receipt through the RPC, while all
-- other order-status changes remain restricted to the assigned cook/admin.
create or replace function public.protect_order_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare expected_total numeric(10,2); customer_name text;
begin
  if not public.is_admin() then
    if tg_op='INSERT' then
      if new.customer_id is distinct from auth.uid() then raise exception 'You can only place an order for your own account'; end if;
      new.status := 'pending'; new.payment_status := 'external'; new.total_amount := 0;
      select p.display_name into customer_name from public.profiles p where p.id=auth.uid();
      new.customer_display_name := customer_name;
    elsif tg_op='UPDATE' then
      if new.id is distinct from old.id or new.customer_id is distinct from old.customer_id or new.cook_id is distinct from old.cook_id or new.preferred_date is distinct from old.preferred_date or new.preferred_time is distinct from old.preferred_time or new.fulfilment_method is distinct from old.fulfilment_method or new.customer_note is distinct from old.customer_note or new.payment_status is distinct from old.payment_status or new.customer_display_name is distinct from old.customer_display_name then
        raise exception 'Order details cannot be changed';
      end if;
      if new.total_amount is distinct from old.total_amount then
        select coalesce(sum(oi.unit_price*oi.quantity),0) into expected_total from public.order_items oi where oi.order_id=old.id;
        if new.total_amount is distinct from expected_total then raise exception 'Order total must match its items'; end if;
        if old.cook_id=auth.uid() then raise exception 'Cook cannot change order totals'; end if;
      end if;
      if new.customer_received_confirmation is distinct from old.customer_received_confirmation and auth.uid() is distinct from old.customer_id then
        raise exception 'Only the customer can confirm receipt';
      end if;
      if new.customer_confirmed_at is distinct from old.customer_confirmed_at and auth.uid() is distinct from old.customer_id then
        raise exception 'Only the customer can confirm receipt';
      end if;
      if new.handed_over_at is distinct from old.handed_over_at and auth.uid() is distinct from old.cook_id then
        raise exception 'Only the assigned cook can mark an order as handed over';
      end if;
      if new.status is distinct from old.status then
        if old.cook_id=auth.uid() then
          null; -- The assigned cook can progress the order through the allowed status check.
        elsif old.customer_id=auth.uid() and old.status='handed_over' and new.status='completed' and new.customer_received_confirmation=true and old.customer_received_confirmation is null then
          null; -- Customer confirmed receipt through confirm_order_received().
        else
          raise exception 'Only the assigned cook can update order status';
        end if;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;

-- Confirm receipt through a constrained RPC; customer confirmation completes the order.
create or replace function public.confirm_order_received(p_order_id uuid, p_received boolean)
returns void language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype;
begin
  select * into target from public.orders where id=p_order_id for update;
  if not found or target.customer_id <> auth.uid() then raise exception 'Order not found'; end if;
  if target.status <> 'handed_over' then raise exception 'The cook must mark the order as handed over first'; end if;
  if target.customer_received_confirmation is not null then raise exception 'Receipt has already been confirmed'; end if;
  update public.orders set customer_received_confirmation=p_received, customer_confirmed_at=now(), status=case when p_received then 'completed' else status end, updated_at=now() where id=p_order_id;
  if not p_received then
    insert into public.notifications(recipient_id,related_order_id,kind,title,body)
      values(target.cook_id,target.id,'receipt_issue','Customer reported an order issue','The customer said they have not received the order. Please contact them and resolve it.');
  end if;
end; $$;
revoke all on function public.confirm_order_received(uuid,boolean) from public;
grant execute on function public.confirm_order_received(uuid,boolean) to authenticated;

-- Public read-only hygiene view exposes status only, never private image paths.
create or replace view public.public_cook_hygiene_status as
select p.id as cook_id,
  case
    when p.hygiene_review_status in ('pending','changes_requested') and p.hygiene_pending_since >= now() - interval '3 days' then 'process'
    when p.hygiene_review_status='approved' and p.hygiene_last_updated_at >= now() - interval '3 days' then 'updated'
    else 'outdated'
  end as display_status,
  p.hygiene_last_updated_at
from public.profiles p
where p.role='cook' and exists(select 1 from public.cook_applications ca where ca.user_id=p.id and ca.status='approved');
grant select on public.public_cook_hygiene_status to anon, authenticated;



-- Keep cook edits pending for moderation, but do not unpublish a dish when inventory alone changes.
create or replace function public.protect_dish_approval()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then
    if tg_op='INSERT' then
      new.status := 'pending';
    elsif old.name is distinct from new.name or old.description is distinct from new.description or old.ingredients is distinct from new.ingredients or old.price is distinct from new.price or old.category is distinct from new.category or old.image_url is distinct from new.image_url then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;

-- Atomic preorder: lock the dish row, validate stock, create the order, and reserve portions.
create or replace function public.create_preorder(
  p_cook_id uuid, p_dish_id uuid, p_quantity integer, p_preferred_date date,
  p_preferred_time text default '', p_fulfilment_method text default 'pickup', p_customer_note text default ''
) returns uuid language plpgsql security definer set search_path=public as $$
declare selected_dish public.dishes%rowtype; created_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in before ordering'; end if;
  if p_preferred_date is null or p_preferred_date < current_date then raise exception 'Choose today or a future date'; end if;
  if char_length(coalesce(p_customer_note,'')) > 500 then raise exception 'Order note is too long'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least one'; end if;
  if p_fulfilment_method not in ('pickup','arrange') then raise exception 'Invalid fulfilment method'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='customer') then raise exception 'Customer account required'; end if;
  select * into selected_dish from public.dishes d
    where d.id=p_dish_id and d.cook_id=p_cook_id and d.status='approved' and d.available=true and d.portions_available>=p_quantity
    for update;
  if not found then raise exception 'This dish is unavailable or there are not enough portions'; end if;
  if not public.is_approved_cook(p_cook_id) then raise exception 'This cook is not approved'; end if;
  insert into public.orders(customer_id,cook_id,preferred_date,preferred_time,fulfilment_method,customer_note,status,payment_status,total_amount,customer_display_name)
    values(auth.uid(),p_cook_id,p_preferred_date,nullif(p_preferred_time,''),p_fulfilment_method,coalesce(p_customer_note,''),'pending','external',0,(select p.display_name from public.profiles p where p.id=auth.uid()))
    returning id into created_order_id;
  insert into public.order_items(order_id,dish_id,dish_name,unit_price,quantity)
    values(created_order_id,selected_dish.id,selected_dish.name,selected_dish.price,p_quantity);
  update public.dishes set portions_available=portions_available-p_quantity where id=selected_dish.id;
  return created_order_id;
end; $$;
revoke all on function public.create_preorder(uuid,uuid,integer,date,text,text,text) from public;
grant execute on function public.create_preorder(uuid,uuid,integer,date,text,text,text) to authenticated;

-- Return reserved portions if a cook rejects or an authorised user cancels an order.
create or replace function public.restore_dish_portions_on_order_cancel()
returns trigger language plpgsql security definer set search_path=public as $$
declare item_row record;
begin
  if new.status in ('rejected','cancelled') and old.status not in ('rejected','cancelled') then
    for item_row in select dish_id, quantity from public.order_items where order_id=new.id and dish_id is not null loop
      update public.dishes set portions_available=least(500,portions_available+item_row.quantity) where id=item_row.dish_id;
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists restore_dish_portions_on_order_cancel_trigger on public.orders;
create trigger restore_dish_portions_on_order_cancel_trigger after update of status on public.orders
  for each row execute procedure public.restore_dish_portions_on_order_cancel();

-- Keep notification records and reviews out of anonymous writes.
-- Public food images remain in the existing public food-images bucket; SSM and hygiene files stay private.

revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
