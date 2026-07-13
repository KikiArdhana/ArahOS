-- ============================================================
-- ARAH seed data
-- Run AFTER you have registered your account in the app.
-- Replace the email below with the email you registered with,
-- then run:  psql $DATABASE_URL -f supabase/seed.sql
-- (or paste into the Supabase SQL editor)
-- ============================================================

do $$
declare
  uid uuid;
  acc_bank uuid; acc_cash uuid; acc_ewallet uuid;
  cat_salary uuid; cat_food uuid; cat_transport uuid; cat_utilities uuid;
  g1 uuid; d1 uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception 'Register an account first, then run the seed.';
  end if;

  -- Accounts
  insert into public.accounts (user_id, name, type, icon, sort_order)
    values (uid, 'BCA', 'bank', 'landmark', 0) returning id into acc_bank;
  insert into public.accounts (user_id, name, type, icon, sort_order)
    values (uid, 'Cash', 'cash', 'banknote', 1) returning id into acc_cash;
  insert into public.accounts (user_id, name, type, icon, sort_order)
    values (uid, 'GoPay', 'ewallet', 'smartphone', 2) returning id into acc_ewallet;

  select id into cat_salary from public.categories where user_id = uid and name = 'Salary';
  select id into cat_food from public.categories where user_id = uid and name = 'Food & drink';
  select id into cat_transport from public.categories where user_id = uid and name = 'Transport';
  select id into cat_utilities from public.categories where user_id = uid and name = 'Utilities';

  -- Transactions (triggers keep balances in sync)
  insert into public.transactions (user_id, account_id, category_id, type, amount, note, occurred_at) values
    (uid, acc_bank, cat_salary, 'income', 12000000, 'Monthly salary', now() - interval '10 days'),
    (uid, acc_bank, cat_utilities, 'expense', 450000, 'Electricity', now() - interval '8 days'),
    (uid, acc_cash, cat_food, 'expense', 85000, 'Lunch with friends', now() - interval '3 days'),
    (uid, acc_ewallet, cat_transport, 'expense', 32000, 'Ride to office', now() - interval '1 day');

  insert into public.transfers (user_id, from_account_id, to_account_id, amount, note)
    values (uid, acc_bank, acc_ewallet, 500000, 'Top up e-wallet');

  -- Allocation
  insert into public.allocations (user_id, account_id, name, target_amount, current_amount)
    values (uid, acc_bank, 'Groceries', 2000000, 650000);

  -- Goal + contribution
  insert into public.goals (user_id, name, icon, target_amount, deadline)
    values (uid, 'Emergency fund', 'shield', 30000000, current_date + 300) returning id into g1;
  insert into public.goal_contributions (user_id, goal_id, account_id, amount, note)
    values (uid, g1, acc_bank, 5000000, 'First deposit');

  -- Assets
  insert into public.assets (user_id, name, category, value, purchase_value, purchase_date) values
    (uid, 'Honda Vario', 'vehicle', 18000000, 24000000, current_date - 700),
    (uid, 'MacBook Air', 'electronics', 13000000, 18000000, current_date - 400);

  -- Debt + partial payment
  insert into public.debts (user_id, counterparty, direction, amount, due_date, note)
    values (uid, 'Andi', 'they_owe', 1500000, current_date + 14, 'Concert tickets') returning id into d1;
  insert into public.debt_payments (user_id, debt_id, amount, note)
    values (uid, d1, 500000, 'First installment');

  -- Bills
  insert into public.bills (user_id, name, amount, frequency, next_due_date, reminder_days) values
    (uid, 'Internet', 350000, 'monthly', current_date + 5, 3),
    (uid, 'Netflix', 120000, 'monthly', current_date + 12, 2),
    (uid, 'Motor insurance', 900000, 'yearly', current_date + 60, 14);

  -- Maintenance
  insert into public.maintenance (user_id, name, frequency, next_due_date, estimated_cost) values
    (uid, 'Motor oil change', 'quarterly', current_date + 10, 150000),
    (uid, 'AC service', 'semiannual', current_date + 40, 250000);

  perform public.generate_due_notifications();
end $$;
