-- Mom's Perisa V1 Supabase schema. Run in Supabase SQL Editor as project owner.
-- Never expose a service_role key in browser code.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Mom’s Perisa user',
 role text not null default 'customer' check (role in ('customer','cook','admin')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cook_applications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 ssm_number text not null, ssm_file_path text not null, hygiene_file_path text not null, hygiene_notes text not null default '',
 ssm_status text not null default 'pending' check (ssm_status in ('pending','approved','changes_requested')),
 hygiene_status text not null default 'pending' check (hygiene_status in ('pending','approved','changes_requested')),
 status text not null default 'pending' check (status in ('pending','approved','changes_requested')),
 rejection_reason text, reviewed_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.dishes (
 id uuid primary key default gen_random_uuid(), cook_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 100), description text not null check (char_length(description) between 2 and 1000),
 ingredients text not null default '', price numeric(10,2) not null check (price > 0),
 category text not null default 'mains' check (category in ('rice','mains','desserts','vegetarian')),
 portions_available integer not null default 1 check (portions_available between 0 and 500), image_url text,
 available boolean not null default true, status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id), cook_id uuid not null references public.profiles(id),
 preferred_date date not null, preferred_time text, fulfilment_method text not null default 'pickup' check (fulfilment_method in ('pickup','arrange')),
 customer_note text not null default '', status text not null default 'pending' check (status in ('pending','accepted','rejected','completed','cancelled')),
 payment_status text not null default 'external' check (payment_status in ('external','unpaid','paid','refunded')),
 total_amount numeric(10,2) not null default 0 check (total_amount >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 dish_id uuid references public.dishes(id) on delete set null, dish_name text not null, unit_price numeric(10,2) not null check (unit_price >= 0),
 quantity integer not null check (quantity between 1 and 500), created_at timestamptz not null default now()
);
create index if not exists dishes_public_listing_idx on public.dishes(status, available, created_at desc);
create index if not exists dishes_cook_idx on public.dishes(cook_id, created_at desc);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_cook_idx on public.orders(cook_id, created_at desc);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'); $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare requested_role text;
begin
 requested_role := coalesce(new.raw_user_meta_data->>'requested_role','customer');
 if requested_role not in ('customer','cook') then requested_role := 'customer'; end if;
 insert into public.profiles(id,display_name,role) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(new.email,'@',1)),requested_role) on conflict(id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and not public.is_admin() and tg_op='UPDATE' then
  if new.role is distinct from old.role then raise exception 'Only an administrator can change account roles'; end if;
 end if;
 new.updated_at := now(); return new;
end; $$;
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before insert or update on public.profiles for each row execute procedure public.protect_profile_role();

create or replace function public.protect_cook_application() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then new.status:='pending'; new.ssm_status:='pending'; new.hygiene_status:='pending'; new.rejection_reason:=null; new.reviewed_by:=null;
 else new.reviewed_by:=auth.uid(); end if;
 new.updated_at:=now(); return new;
end; $$;
drop trigger if exists protect_cook_application_trigger on public.cook_applications;
create trigger protect_cook_application_trigger before insert or update on public.cook_applications for each row execute procedure public.protect_cook_application();

create or replace function public.protect_dish_approval() returns trigger language plpgsql security definer set search_path=public as $$
begin if not public.is_admin() then new.status:='pending'; end if; new.updated_at:=now(); return new; end; $$;
drop trigger if exists protect_dish_approval_trigger on public.dishes;
create trigger protect_dish_approval_trigger before insert or update on public.dishes for each row execute procedure public.protect_dish_approval();

alter table public.profiles enable row level security;
alter table public.cook_applications enable row level security;
alter table public.dishes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles: public sees only approved cook profiles; private account fields stay in Auth.
drop policy if exists "profile read own admin or approved cook" on public.profiles;
create policy "profile read own admin or approved cook" on public.profiles for select to authenticated using (
 id=auth.uid() or public.is_admin() or (role='cook' and exists(select 1 from public.cook_applications ca where ca.user_id=profiles.id and ca.status='approved'))
);
drop policy if exists "profile update own basic details" on public.profiles;
create policy "profile update own basic details" on public.profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());

-- Seller application rows are private to their owner and admins.
drop policy if exists "application select owner or admin" on public.cook_applications;
create policy "application select owner or admin" on public.cook_applications for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "cook create own application" on public.cook_applications;
create policy "cook create own application" on public.cook_applications for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='cook'));
drop policy if exists "cook update own application or admin" on public.cook_applications;
create policy "cook update own application or admin" on public.cook_applications for update to authenticated using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

-- Public menu rows are only approved dishes from approved cooks.
drop policy if exists "public approved dishes readable" on public.dishes;
create policy "public approved dishes readable" on public.dishes for select to anon,authenticated using(status='approved' and available=true and portions_available>0 and exists(select 1 from public.cook_applications ca where ca.user_id=dishes.cook_id and ca.status='approved'));
drop policy if exists "cook or admin read own dishes" on public.dishes;
create policy "cook or admin read own dishes" on public.dishes for select to authenticated using(cook_id=auth.uid() or public.is_admin());
drop policy if exists "approved cook create own dish" on public.dishes;
create policy "approved cook create own dish" on public.dishes for insert to authenticated with check(cook_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='cook') and exists(select 1 from public.cook_applications ca where ca.user_id=auth.uid() and ca.status='approved'));
drop policy if exists "cook update own dish or admin" on public.dishes;
create policy "cook update own dish or admin" on public.dishes for update to authenticated using(cook_id=auth.uid() or public.is_admin()) with check(cook_id=auth.uid() or public.is_admin());
drop policy if exists "cook delete own dish or admin" on public.dishes;
create policy "cook delete own dish or admin" on public.dishes for delete to authenticated using(cook_id=auth.uid() or public.is_admin());

-- Preorders: customers create; assigned cook and admins can manage statuses.
drop policy if exists "customer cook or admin read orders" on public.orders;
create policy "customer cook or admin read orders" on public.orders for select to authenticated using(customer_id=auth.uid() or cook_id=auth.uid() or public.is_admin());
drop policy if exists "customer create preorders" on public.orders;
create policy "customer create preorders" on public.orders for insert to authenticated with check(customer_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='customer') and exists(select 1 from public.cook_applications ca where ca.user_id=cook_id and ca.status='approved'));
drop policy if exists "cook update assigned orders or admin" on public.orders;
create policy "cook update assigned orders or admin" on public.orders for update to authenticated using(cook_id=auth.uid() or public.is_admin()) with check(cook_id=auth.uid() or public.is_admin());

drop policy if exists "order items visible to order parties" on public.order_items;
create policy "order items visible to order parties" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or o.cook_id=auth.uid() or public.is_admin())));
drop policy if exists "customer add items to own preorder" on public.order_items;
create policy "customer add items to own preorder" on public.order_items for insert to authenticated with check(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()) and exists(select 1 from public.dishes d where d.id=dish_id and d.status='approved' and d.available=true and d.portions_available>=quantity));
drop policy if exists "admin update order items" on public.order_items;
create policy "admin update order items" on public.order_items for update to authenticated using(public.is_admin()) with check(public.is_admin());

-- Private documents: max 8 MB, PDF/JPG/PNG. Do not make this bucket public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('seller-private-documents','seller-private-documents',false,8388608,array['application/pdf','image/jpeg','image/png']) on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['application/pdf','image/jpeg','image/png'];
insert into storage.buckets(id,name,public) values('food-images','food-images',true) on conflict(id) do update set public=true;
drop policy if exists "seller uploads into own private folder" on storage.objects;
create policy "seller uploads into own private folder" on storage.objects for insert to authenticated with check(bucket_id='seller-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "seller reads own private files or admin reads all" on storage.objects;
create policy "seller reads own private files or admin reads all" on storage.objects for select to authenticated using(bucket_id='seller-private-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
drop policy if exists "seller replaces own private files" on storage.objects;
create policy "seller replaces own private files" on storage.objects for update to authenticated using(bucket_id='seller-private-documents' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='seller-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "food images are publicly readable" on storage.objects;
create policy "food images are publicly readable" on storage.objects for select to anon,authenticated using(bucket_id='food-images');
drop policy if exists "authenticated users upload food images to own folder" on storage.objects;
create policy "authenticated users upload food images to own folder" on storage.objects for insert to authenticated with check(bucket_id='food-images' and (storage.foldername(name))[1]=auth.uid()::text);

-- ADMIN BOOTSTRAP: create your own account through the website, then run this manually:
-- update public.profiles p set role='admin' from auth.users u where p.id=u.id and u.email='YOUR-ADMIN-EMAIL';

-- Allow anonymous visitors to resolve the display name of approved cooks only.
drop policy if exists "public approved cook profile names" on public.profiles;
create policy "public approved cook profile names" on public.profiles for select to anon, authenticated
using (role='cook' and exists(select 1 from public.cook_applications ca where ca.user_id=profiles.id and ca.status='approved'));

-- A verified cook's new menu item becomes public automatically. A cook who is not
-- approved cannot create dishes due to the INSERT policy above.
create or replace function public.protect_dish_approval() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then
  if exists(select 1 from public.cook_applications ca where ca.user_id=new.cook_id and ca.status='approved') then new.status:='approved';
  else new.status:='pending'; end if;
 end if;
 new.updated_at:=now(); return new;
end; $$;

-- SECURITY DEFINER helper functions allow public policies to check approval without
-- exposing private application rows to anonymous visitors or customers.
create or replace function public.is_approved_cook(cook_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.cook_applications ca where ca.user_id=cook_user_id and ca.status='approved');
$$;

drop policy if exists "public approved cook profile names" on public.profiles;
create policy "public approved cook profile names" on public.profiles for select to anon, authenticated
using (role='cook' and public.is_approved_cook(id));

drop policy if exists "public approved dishes readable" on public.dishes;
create policy "public approved dishes readable" on public.dishes for select to anon,authenticated
using(status='approved' and available=true and portions_available>0 and public.is_approved_cook(cook_id));

drop policy if exists "customer create preorders" on public.orders;
create policy "customer create preorders" on public.orders for insert to authenticated
with check(customer_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='customer') and public.is_approved_cook(cook_id));

drop policy if exists "customer add items to own preorder" on public.order_items;
create policy "customer add items to own preorder" on public.order_items for insert to authenticated
with check(
 exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid() and o.cook_id=(select d.cook_id from public.dishes d where d.id=dish_id))
 and exists(select 1 from public.dishes d where d.id=dish_id and d.status='approved' and d.available=true and d.portions_available>=quantity)
);

-- Atomic preorder creation: validates the approved dish, cook, quantity and price,
-- and writes the order + order item in one database transaction.
create or replace function public.create_preorder(
 p_cook_id uuid, p_dish_id uuid, p_quantity integer, p_preferred_date date,
 p_preferred_time text default '', p_fulfilment_method text default 'pickup', p_customer_note text default ''
) returns uuid language plpgsql security invoker set search_path=public as $$
declare selected_dish public.dishes%rowtype; created_order_id uuid;
begin
 if auth.uid() is null then raise exception 'Please sign in before ordering'; end if;
 if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least one'; end if;
 if p_fulfilment_method not in ('pickup','arrange') then raise exception 'Invalid fulfilment method'; end if;
 select * into selected_dish from public.dishes d
 where d.id=p_dish_id and d.cook_id=p_cook_id and d.status='approved' and d.available=true and d.portions_available>0 for share;
 if not found then raise exception 'This dish is no longer available'; end if;
 if not public.is_approved_cook(p_cook_id) then raise exception 'This cook is not approved'; end if;
 if selected_dish.portions_available < p_quantity then raise exception 'Not enough portions are available'; end if;
 insert into public.orders(customer_id,cook_id,preferred_date,preferred_time,fulfilment_method,customer_note,status,payment_status,total_amount)
 values(auth.uid(),p_cook_id,p_preferred_date,nullif(p_preferred_time,''),p_fulfilment_method,coalesce(p_customer_note,''),'pending','external',selected_dish.price*p_quantity)
 returning id into created_order_id;
 insert into public.order_items(order_id,dish_id,dish_name,unit_price,quantity)
 values(created_order_id,selected_dish.id,selected_dish.name,selected_dish.price,p_quantity);
 return created_order_id;
end; $$;
revoke all on function public.create_preorder(uuid,uuid,integer,date,text,text,text) from public;
grant execute on function public.create_preorder(uuid,uuid,integer,date,text,text,text) to authenticated;

-- Keep a display-name snapshot on the preorder so cooks do not need broad access
-- to private customer profile fields.
alter table public.orders add column if not exists customer_display_name text;

create or replace function public.protect_order_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare expected_total numeric(10,2); customer_name text;
begin
 if not public.is_admin() then
  if tg_op='INSERT' then
   if new.customer_id is distinct from auth.uid() then raise exception 'You can only place an order for your own account'; end if;
   new.status:='pending'; new.payment_status:='external'; new.total_amount:=0;
   select p.display_name into customer_name from public.profiles p where p.id=auth.uid();
   new.customer_display_name:=customer_name;
  elsif tg_op='UPDATE' then
   if new.id is distinct from old.id or new.customer_id is distinct from old.customer_id or new.cook_id is distinct from old.cook_id or new.preferred_date is distinct from old.preferred_date or new.preferred_time is distinct from old.preferred_time or new.fulfilment_method is distinct from old.fulfilment_method or new.customer_note is distinct from old.customer_note or new.payment_status is distinct from old.payment_status or new.customer_display_name is distinct from old.customer_display_name then
    raise exception 'Order details cannot be changed';
   end if;
   if new.total_amount is distinct from old.total_amount then
    select coalesce(sum(oi.unit_price*oi.quantity),0) into expected_total from public.order_items oi where oi.order_id=old.id;
    if new.total_amount is distinct from expected_total then raise exception 'Order total must match its items'; end if;
   end if;
   if old.cook_id = auth.uid() then
    if new.total_amount is distinct from old.total_amount then raise exception 'Cook cannot change order totals'; end if;
   else
    if new.status is distinct from old.status or new.total_amount is not distinct from old.total_amount then raise exception 'Only the assigned cook can update order status'; end if;
   end if;
  end if;
 end if;
 new.updated_at:=now(); return new;
end; $$;
drop trigger if exists protect_order_changes_trigger on public.orders;
create trigger protect_order_changes_trigger before insert or update on public.orders for each row execute procedure public.protect_order_changes();

create or replace function public.validate_order_item()
returns trigger language plpgsql security definer set search_path=public as $$
declare order_row public.orders%rowtype; dish_row public.dishes%rowtype;
begin
 select * into order_row from public.orders where id=new.order_id;
 select * into dish_row from public.dishes where id=new.dish_id;
 if not found or dish_row.status <> 'approved' or not dish_row.available then raise exception 'Dish is not available'; end if;
 if order_row.cook_id <> dish_row.cook_id then raise exception 'Dish does not belong to the selected cook'; end if;
 if new.quantity < 1 or dish_row.portions_available < new.quantity then raise exception 'Not enough portions are available'; end if;
 new.dish_name:=dish_row.name; new.unit_price:=dish_row.price;
 return new;
end; $$;
drop trigger if exists validate_order_item_trigger on public.order_items;
create trigger validate_order_item_trigger before insert or update on public.order_items for each row execute procedure public.validate_order_item();

create or replace function public.recalculate_order_total()
returns trigger language plpgsql security definer set search_path=public as $$
declare affected_order_id uuid;
begin
 affected_order_id:=coalesce(new.order_id,old.order_id);
 update public.orders o set total_amount=coalesce((select sum(oi.unit_price*oi.quantity) from public.order_items oi where oi.order_id=affected_order_id),0), updated_at=now()
 where o.id=affected_order_id;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists recalculate_order_total_trigger on public.order_items;
create trigger recalculate_order_total_trigger after insert or update or delete on public.order_items for each row execute procedure public.recalculate_order_total();

create or replace function public.create_preorder(
 p_cook_id uuid, p_dish_id uuid, p_quantity integer, p_preferred_date date,
 p_preferred_time text default '', p_fulfilment_method text default 'pickup', p_customer_note text default ''
) returns uuid language plpgsql security invoker set search_path=public as $$
declare selected_dish public.dishes%rowtype; created_order_id uuid;
begin
 if auth.uid() is null then raise exception 'Please sign in before ordering'; end if;
 if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least one'; end if;
 if p_fulfilment_method not in ('pickup','arrange') then raise exception 'Invalid fulfilment method'; end if;
 select * into selected_dish from public.dishes d where d.id=p_dish_id and d.cook_id=p_cook_id and d.status='approved' and d.available=true and d.portions_available>0 for share;
 if not found then raise exception 'This dish is no longer available'; end if;
 if not public.is_approved_cook(p_cook_id) then raise exception 'This cook is not approved'; end if;
 if selected_dish.portions_available < p_quantity then raise exception 'Not enough portions are available'; end if;
 insert into public.orders(customer_id,cook_id,preferred_date,preferred_time,fulfilment_method,customer_note,status,payment_status,total_amount,customer_display_name)
 values(auth.uid(),p_cook_id,p_preferred_date,nullif(p_preferred_time,''),p_fulfilment_method,coalesce(p_customer_note,''),'pending','external',0,(select p.display_name from public.profiles p where p.id=auth.uid()))
 returning id into created_order_id;
 insert into public.order_items(order_id,dish_id,dish_name,unit_price,quantity) values(created_order_id,selected_dish.id,selected_dish.name,selected_dish.price,p_quantity);
 return created_order_id;
end; $$;
revoke all on function public.create_preorder(uuid,uuid,integer,date,text,text,text) from public;
grant execute on function public.create_preorder(uuid,uuid,integer,date,text,text,text) to authenticated;

-- Direct browser inserts are disabled: only the validated RPC can create preorders.
drop policy if exists "customer create preorders" on public.orders;
drop policy if exists "customer add items to own preorder" on public.order_items;

create or replace function public.create_preorder(
 p_cook_id uuid, p_dish_id uuid, p_quantity integer, p_preferred_date date,
 p_preferred_time text default '', p_fulfilment_method text default 'pickup', p_customer_note text default ''
) returns uuid language plpgsql security definer set search_path=public as $$
declare selected_dish public.dishes%rowtype; created_order_id uuid; customer_name text;
begin
 if auth.uid() is null then raise exception 'Please sign in before ordering'; end if;
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='customer') then raise exception 'Only customer accounts can place preorders'; end if;
 if p_preferred_date is null or p_preferred_date < current_date then raise exception 'Choose today or a future date'; end if;
 if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least one'; end if;
 if p_fulfilment_method not in ('pickup','arrange') then raise exception 'Invalid fulfilment method'; end if;
 select * into selected_dish from public.dishes d where d.id=p_dish_id and d.cook_id=p_cook_id and d.status='approved' and d.available=true and d.portions_available>0 for share;
 if not found then raise exception 'This dish is no longer available'; end if;
 if not public.is_approved_cook(p_cook_id) then raise exception 'This cook is not approved'; end if;
 if selected_dish.portions_available < p_quantity then raise exception 'Not enough portions are available'; end if;
 select p.display_name into customer_name from public.profiles p where p.id=auth.uid();
 insert into public.orders(customer_id,cook_id,preferred_date,preferred_time,fulfilment_method,customer_note,status,payment_status,total_amount,customer_display_name)
 values(auth.uid(),p_cook_id,p_preferred_date,nullif(p_preferred_time,''),p_fulfilment_method,coalesce(p_customer_note,''),'pending','external',0,customer_name)
 returning id into created_order_id;
 insert into public.order_items(order_id,dish_id,dish_name,unit_price,quantity) values(created_order_id,selected_dish.id,selected_dish.name,selected_dish.price,p_quantity);
 return created_order_id;
end; $$;
revoke all on function public.create_preorder(uuid,uuid,integer,date,text,text,text) from public;
grant execute on function public.create_preorder(uuid,uuid,integer,date,text,text,text) to authenticated;
