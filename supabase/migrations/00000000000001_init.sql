-- ============================================================
-- ARAH — Your Personal Life Operating System
-- Initial schema: enums, tables, indexes, RLS, triggers, functions
-- Single-owner personal application. Every row belongs to auth user.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
create type public.account_type as enum ('cash', 'bank', 'ewallet', 'investment', 'other');
create type public.transaction_type as enum ('income', 'expense');
create type public.category_kind as enum ('income', 'expense');
create type public.goal_status as enum ('active', 'completed', 'archived');
create type public.asset_category as enum ('property', 'vehicle', 'electronics', 'investment', 'jewelry', 'other');
create type public.asset_status as enum ('active', 'sold', 'archived');
create type public.debt_direction as enum ('i_owe', 'they_owe');
create type public.debt_status as enum ('open', 'settled');
create type public.bill_frequency as enum ('weekly', 'monthly', 'quarterly', 'yearly');
create type public.maintenance_frequency as enum ('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly');
create type public.notification_type as enum ('bill', 'debt', 'maintenance', 'goal', 'system');
create type public.notification_status as enum ('unread', 'read', 'archived');

-- ------------------------------------------------------------
-- HELPERS
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Owner',
  username text unique,
  avatar_url text,
  pin_hash text,
  biometric_enabled boolean not null default false,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  currency text not null default 'IDR',
  locale text not null default 'id-ID',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'username'
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind public.category_kind not null,
  icon text not null default 'circle',
  color text not null default '#D7FF2F',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, kind)
);
create index categories_user_idx on public.categories (user_id, kind);

-- ------------------------------------------------------------
-- ACCOUNTS
-- ------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type public.account_type not null default 'bank',
  balance numeric(18, 2) not null default 0,
  color text not null default '#101208',
  icon text not null default 'wallet',
  is_archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id, is_archived);

-- ------------------------------------------------------------
-- ALLOCATIONS (budget envelopes inside accounts)
-- ------------------------------------------------------------
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  name text not null,
  target_amount numeric(18, 2) not null default 0 check (target_amount >= 0),
  current_amount numeric(18, 2) not null default 0 check (current_amount >= 0),
  color text not null default '#D7FF2F',
  period text not null default 'monthly' check (period in ('weekly', 'monthly', 'yearly', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index allocations_user_idx on public.allocations (user_id);

-- ------------------------------------------------------------
-- TRANSACTIONS
-- ------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  allocation_id uuid references public.allocations (id) on delete set null,
  type public.transaction_type not null,
  amount numeric(18, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions (user_id, occurred_at desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_category_idx on public.transactions (category_id);

-- Keep account balance in sync with transactions
create or replace function public.apply_transaction_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  delta numeric(18, 2);
begin
  if tg_op = 'INSERT' then
    delta := case when new.type = 'income' then new.amount else -new.amount end;
    update public.accounts set balance = balance + delta where id = new.account_id;
    return new;
  elsif tg_op = 'DELETE' then
    delta := case when old.type = 'income' then -old.amount else old.amount end;
    update public.accounts set balance = balance + delta where id = old.account_id;
    return old;
  elsif tg_op = 'UPDATE' then
    -- revert old, apply new
    delta := case when old.type = 'income' then -old.amount else old.amount end;
    update public.accounts set balance = balance + delta where id = old.account_id;
    delta := case when new.type = 'income' then new.amount else -new.amount end;
    update public.accounts set balance = balance + delta where id = new.account_id;
    return new;
  end if;
  return null;
end $$;

create trigger transactions_balance_trigger
after insert or update or delete on public.transactions
for each row execute function public.apply_transaction_balance();

-- ------------------------------------------------------------
-- TRANSFERS
-- ------------------------------------------------------------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete cascade,
  to_account_id uuid not null references public.accounts (id) on delete cascade,
  amount numeric(18, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);
create index transfers_user_idx on public.transfers (user_id, occurred_at desc);

create or replace function public.apply_transfer_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.accounts set balance = balance - new.amount where id = new.from_account_id;
    update public.accounts set balance = balance + new.amount where id = new.to_account_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.accounts set balance = balance + old.amount where id = old.from_account_id;
    update public.accounts set balance = balance - old.amount where id = old.to_account_id;
    return old;
  end if;
  return null;
end $$;

create trigger transfers_balance_trigger
after insert or delete on public.transfers
for each row execute function public.apply_transfer_balance();

-- ------------------------------------------------------------
-- GOALS + CONTRIBUTIONS
-- ------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text not null default 'target',
  color text not null default '#D7FF2F',
  target_amount numeric(18, 2) not null check (target_amount > 0),
  current_amount numeric(18, 2) not null default 0 check (current_amount >= 0),
  deadline date,
  status public.goal_status not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id, status);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  amount numeric(18, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id, occurred_at desc);

create or replace function public.apply_goal_contribution()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.goals set current_amount = current_amount + new.amount where id = new.goal_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.goals
      set current_amount = greatest(current_amount - old.amount, 0)
      where id = old.goal_id;
    return old;
  end if;
  return null;
end $$;

create trigger goal_contributions_trigger
after insert or delete on public.goal_contributions
for each row execute function public.apply_goal_contribution();

-- ------------------------------------------------------------
-- ASSETS
-- ------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category public.asset_category not null default 'other',
  value numeric(18, 2) not null default 0 check (value >= 0),
  purchase_value numeric(18, 2),
  purchase_date date,
  status public.asset_status not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_user_idx on public.assets (user_id, status);

-- ------------------------------------------------------------
-- DEBTS + PAYMENTS
-- ------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  counterparty text not null,
  direction public.debt_direction not null,
  amount numeric(18, 2) not null check (amount > 0),
  paid_amount numeric(18, 2) not null default 0 check (paid_amount >= 0),
  due_date date,
  status public.debt_status not null default 'open',
  note text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index debts_user_idx on public.debts (user_id, status, due_date);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount numeric(18, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index debt_payments_debt_idx on public.debt_payments (debt_id, occurred_at desc);

create or replace function public.apply_debt_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.debts%rowtype;
begin
  if tg_op = 'INSERT' then
    update public.debts set paid_amount = paid_amount + new.amount where id = new.debt_id
      returning * into d;
    if d.paid_amount >= d.amount and d.status = 'open' then
      update public.debts set status = 'settled', settled_at = now() where id = d.id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.debts
      set paid_amount = greatest(paid_amount - old.amount, 0),
          status = 'open',
          settled_at = null
      where id = old.debt_id;
    return old;
  end if;
  return null;
end $$;

create trigger debt_payments_trigger
after insert or delete on public.debt_payments
for each row execute function public.apply_debt_payment();

-- ------------------------------------------------------------
-- BILLS + PAYMENTS
-- ------------------------------------------------------------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(18, 2) not null check (amount > 0),
  frequency public.bill_frequency not null default 'monthly',
  next_due_date date not null,
  reminder_days int not null default 3 check (reminder_days >= 0),
  auto_pay boolean not null default false,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bills_user_due_idx on public.bills (user_id, is_active, next_due_date);

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  amount numeric(18, 2) not null check (amount > 0),
  paid_for_date date not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index bill_payments_bill_idx on public.bill_payments (bill_id, paid_for_date desc);

-- When a bill is paid, roll next_due_date forward by frequency
create or replace function public.roll_bill_forward()
returns trigger language plpgsql security definer set search_path = public as $$
declare b public.bills%rowtype;
begin
  select * into b from public.bills where id = new.bill_id;
  if b.id is not null then
    update public.bills
      set next_due_date = case b.frequency
        when 'weekly' then b.next_due_date + interval '7 days'
        when 'monthly' then b.next_due_date + interval '1 month'
        when 'quarterly' then b.next_due_date + interval '3 months'
        when 'yearly' then b.next_due_date + interval '1 year'
      end
      where id = b.id;
  end if;
  return new;
end $$;

create trigger bill_payments_roll_trigger
after insert on public.bill_payments
for each row execute function public.roll_bill_forward();

-- ------------------------------------------------------------
-- MAINTENANCE + HISTORY
-- ------------------------------------------------------------
create table public.maintenance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  name text not null,
  frequency public.maintenance_frequency not null default 'monthly',
  next_due_date date not null,
  reminder_days int not null default 7 check (reminder_days >= 0),
  estimated_cost numeric(18, 2),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_user_due_idx on public.maintenance (user_id, is_active, next_due_date);

create table public.maintenance_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  maintenance_id uuid not null references public.maintenance (id) on delete cascade,
  cost numeric(18, 2),
  note text,
  done_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index maintenance_history_idx on public.maintenance_history (maintenance_id, done_at desc);

create or replace function public.roll_maintenance_forward()
returns trigger language plpgsql security definer set search_path = public as $$
declare m public.maintenance%rowtype;
begin
  select * into m from public.maintenance where id = new.maintenance_id;
  if m.id is not null then
    update public.maintenance
      set next_due_date = case m.frequency
        when 'weekly' then new.done_at + interval '7 days'
        when 'monthly' then new.done_at + interval '1 month'
        when 'quarterly' then new.done_at + interval '3 months'
        when 'semiannual' then new.done_at + interval '6 months'
        when 'yearly' then new.done_at + interval '1 year'
      end
      where id = m.id;
  end if;
  return new;
end $$;

create trigger maintenance_history_roll_trigger
after insert on public.maintenance_history
for each row execute function public.roll_maintenance_forward();

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  body text,
  status public.notification_status not null default 'unread',
  ref_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, status, created_at desc);

-- Generate due reminders (idempotent per day). Called from the app on load,
-- or schedule with pg_cron: select cron.schedule('arah-reminders', '0 6 * * *', $$select public.generate_due_notifications()$$);
create or replace function public.generate_due_notifications()
returns int language plpgsql security definer set search_path = public as $$
declare created int := 0;
begin
  -- Bills
  insert into public.notifications (user_id, type, title, body, ref_id)
  select b.user_id, 'bill',
         b.name || ' is due ' || to_char(b.next_due_date, 'DD Mon'),
         'Amount: ' || b.amount::text, b.id
  from public.bills b
  where b.is_active
    and b.next_due_date <= current_date + b.reminder_days
    and not exists (
      select 1 from public.notifications n
      where n.ref_id = b.id and n.type = 'bill' and n.created_at::date = current_date
    );
  get diagnostics created = row_count;

  -- Maintenance
  insert into public.notifications (user_id, type, title, body, ref_id)
  select m.user_id, 'maintenance',
         m.name || ' scheduled ' || to_char(m.next_due_date, 'DD Mon'),
         coalesce('Estimated cost: ' || m.estimated_cost::text, 'Time for a check-up'), m.id
  from public.maintenance m
  where m.is_active
    and m.next_due_date <= current_date + m.reminder_days
    and not exists (
      select 1 from public.notifications n
      where n.ref_id = m.id and n.type = 'maintenance' and n.created_at::date = current_date
    );

  -- Debts due
  insert into public.notifications (user_id, type, title, body, ref_id)
  select d.user_id, 'debt',
         case when d.direction = 'i_owe'
           then 'You owe ' || d.counterparty
           else d.counterparty || ' owes you' end,
         'Due ' || to_char(d.due_date, 'DD Mon') || ' · remaining ' || (d.amount - d.paid_amount)::text,
         d.id
  from public.debts d
  where d.status = 'open'
    and d.due_date is not null
    and d.due_date <= current_date + 3
    and not exists (
      select 1 from public.notifications n
      where n.ref_id = d.id and n.type = 'debt' and n.created_at::date = current_date
    );

  return created;
end $$;

-- Celebrate completed goals
create or replace function public.notify_goal_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_amount >= new.target_amount and new.status = 'active' then
    update public.goals set status = 'completed', completed_at = now() where id = new.id;
    insert into public.notifications (user_id, type, title, body, ref_id)
    values (new.user_id, 'goal', 'Goal reached: ' || new.name, 'You hit your target. Time to celebrate.', new.id);
  end if;
  return new;
end $$;

create trigger goals_completed_trigger
after update of current_amount on public.goals
for each row execute function public.notify_goal_completed();

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','accounts','allocations','transactions','transfers',
    'goals','assets','debts','bills','maintenance','notifications'
  ] loop
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "profiles owner select" on public.profiles for select using (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array[
    'categories','accounts','allocations','transactions','transfers',
    'goals','goal_contributions','assets','debts','debt_payments',
    'bills','bill_payments','maintenance','maintenance_history','notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%s owner all" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- DEFAULT CATEGORY SEEDING PER USER
-- ------------------------------------------------------------
create or replace function public.seed_default_categories()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.categories (user_id, name, kind, icon, is_default) values
    (new.id, 'Salary', 'income', 'briefcase', true),
    (new.id, 'Bonus', 'income', 'gift', true),
    (new.id, 'Other income', 'income', 'plus-circle', true),
    (new.id, 'Food & drink', 'expense', 'utensils', true),
    (new.id, 'Transport', 'expense', 'car', true),
    (new.id, 'Housing', 'expense', 'home', true),
    (new.id, 'Utilities', 'expense', 'zap', true),
    (new.id, 'Shopping', 'expense', 'shopping-bag', true),
    (new.id, 'Health', 'expense', 'heart-pulse', true),
    (new.id, 'Entertainment', 'expense', 'clapperboard', true),
    (new.id, 'Other', 'expense', 'circle', true);
  return new;
end $$;

create trigger on_profile_created_seed_categories
after insert on public.profiles
for each row execute function public.seed_default_categories();
