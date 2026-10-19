
-- Mom's Perisa Phase 1 security patch
-- Run AFTER schema.sql and phase1_workflows.sql.
-- Review and test on a development Supabase project first.

begin;

-- =========================================================
-- 1. STRICT ORDER STATUS TRANSITIONS
-- =========================================================

create or replace function public.protect_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_total numeric(10,2);
  customer_name text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null
       or new.customer_id is distinct from auth.uid()
       or not exists (
         select 1 from public.profiles
         where id = auth.uid() and role = 'customer'
       ) then
      raise exception 'A customer can only create their own order';
    end if;

    new.status := 'pending';
    new.payment_status := 'external';
    new.total_amount := 0;

    select display_name into customer_name
    from public.profiles
    where id = auth.uid();

    new.customer_display_name := customer_name;
    new.customer_received_confirmation := null;
    new.customer_confirmed_at := null;
    new.handed_over_at := null;

    return new;
  end if;

  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  -- Immutable order details.
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

  -- Only the customer receipt RPC may change confirmation fields.
  if new.customer_received_confirmation is distinct from old.customer_received_confirmation
     or new.customer_confirmed_at is distinct from old.customer_confirmed_at then
    if auth.uid() is distinct from old.customer_id
       or old.status <> 'handed_over'
       or old.customer_received_confirmation is not null
       or new.customer_confirmed_at is null
       or new.customer_received_confirmation is null then
      raise exception 'Invalid receipt confirmation';
    end if;
  end if;

  if new.handed_over_at is distinct from old.handed_over_at
     and auth.uid() is distinct from old.cook_id then
    raise exception 'Only the assigned cook can mark an order as handed over';
  end if;

  if new.total_amount is distinct from old.total_amount then
    select coalesce(sum(oi.unit_price * oi.quantity), 0)
      into expected_total
    from public.order_items oi
    where oi.order_id = old.id;

    if new.total_amount is distinct from expected_total
       or auth.uid() = old.cook_id then
      raise exception 'Invalid order total change';
    end if;
  end if;

  if new.status is distinct from old.status then
    if auth.uid() = old.cook_id then
      if not (
        (old.status = 'pending' and new.status in ('accepted', 'rejected'))
        or (old.status = 'accepted' and new.status in ('cooking', 'cancelled'))
        or (old.status = 'cooking' and new.status in ('ready', 'cancelled'))
        or (old.status = 'ready' and new.status in ('handed_over', 'cancelled'))
      ) then
        raise exception 'Invalid order status transition';
      end if;
    elsif auth.uid() = old.customer_id then
      if not (
        old.status = 'handed_over'
        and new.status = 'completed'
        and new.customer_received_confirmation = true
        and old.customer_received_confirmation is null
      ) then
        raise exception 'Customers may only complete an order after confirming receipt';
      end if;
    else
      raise exception 'You are not authorised to change this order';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


-- =========================================================
-- 2. PREVENT CUSTOMERS FROM EDITING OR DELETING REVIEWS
-- =========================================================

drop policy if exists "customer review confirmed order"
  on public.reviews;

create policy "customer review confirmed order"
on public.reviews
for insert
to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.customer_id = auth.uid()
      and o.cook_id = reviews.cook_id
      and o.customer_received_confirmation = true
      and o.status = 'completed'
  )
);

drop policy if exists "reviews are immutable"
  on public.reviews;

create policy "reviews are immutable"
on public.reviews
for update
to authenticated
using (false)
with check (false);

create policy "reviews cannot be deleted by users"
on public.reviews
for delete
to authenticated
using (false);


-- =========================================================
-- 3. LIMIT HYGIENE SUBMISSIONS TO ONE PER THREE DAYS
-- =========================================================

create or replace function public.enforce_hygiene_submission_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_submission timestamptz;
begin
  if auth.uid() is null
     or new.cook_id is distinct from auth.uid()
     or not exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'cook'
     ) then
    raise exception 'You may only submit hygiene evidence for your own cook account';
  end if;

  -- Lock the cook's profile row so concurrent submissions cannot bypass cooldown.
  perform 1
  from public.profiles
  where id = new.cook_id
  for update;

  select max(submitted_at)
  into last_submission
  from public.hygiene_submissions
  where cook_id = new.cook_id;

  if last_submission is not null
     and last_submission > now() - interval '3 days' then
    raise exception 'You can submit new hygiene evidence once every three days';
  end if;

  new.status := 'pending';
  new.review_note := null;
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.submitted_at := now();
  new.created_at := now();

  return new;
end;
$$;

drop trigger if exists enforce_hygiene_submission_cooldown_trigger
  on public.hygiene_submissions;

create trigger enforce_hygiene_submission_cooldown_trigger
before insert on public.hygiene_submissions
for each row
execute function public.enforce_hygiene_submission_cooldown();


-- =========================================================
-- 4. PREVENT COOKS FROM EDITING REVIEW DECISIONS
-- =========================================================

create or replace function public.protect_hygiene_submission_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if new.status is distinct from old.status
       or new.review_note is distinct from old.review_note then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;

    return new;
  end if;

  -- A cook cannot update a submission after it has been created.
  raise exception 'Hygiene submissions can only be reviewed by an administrator';
end;
$$;

drop trigger if exists protect_hygiene_submission_review_trigger
  on public.hygiene_submissions;

create trigger protect_hygiene_submission_review_trigger
before update on public.hygiene_submissions
for each row
execute function public.protect_hygiene_submission_review();


-- =========================================================
-- 5. SAFER INVENTORY RESTORATION
-- =========================================================

create or replace function public.restore_dish_portions_on_order_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row record;
begin
  if new.status in ('rejected', 'cancelled')
     and old.status not in ('rejected', 'cancelled') then

    for item_row in
      select dish_id, quantity
      from public.order_items
      where order_id = new.id
        and dish_id is not null
    loop
      update public.dishes
      set portions_available = portions_available + item_row.quantity
      where id = item_row.dish_id;
    end loop;
  end if;

  return new;
end;
$$;


-- =========================================================
-- 6. ENSURE REVIEWED COOK APPLICATIONS ARE NOT SELF-EDITABLE
-- =========================================================

create or replace function public.protect_cook_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null
       or new.user_id is distinct from auth.uid()
       or not exists (
         select 1 from public.profiles
         where id = auth.uid() and role = 'cook'
       ) then
      raise exception 'Invalid cook application owner';
    end if;

    new.status := 'pending';
    new.ssm_status := 'pending';
    new.hygiene_status := 'pending';
    new.rejection_reason := null;
    new.reviewed_by := null;
    new.updated_at := now();

    return new;
  end if;

  if public.is_admin() then
    new.reviewed_by := auth.uid();
    new.updated_at := now();
    return new;
  end if;

  -- Owners must not alter application details or review outcomes directly.
  raise exception 'Cook applications can only be changed by an administrator';
end;
$$;

commit;
