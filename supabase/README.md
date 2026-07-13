# Database

- `migrations/00000000000001_init.sql` — full schema: enums, tables, indexes, FKs, RLS policies, triggers, functions.
- `seed.sql` — optional sample data. Register your account first, then run it.

## Apply

**Supabase CLI**

```bash
supabase link --project-ref <your-ref>
supabase db push
```

**Or** paste the migration into the Supabase Dashboard → SQL Editor and run it.

## Daily reminders (optional)

Enable the `pg_cron` extension, then:

```sql
select cron.schedule('arah-reminders', '0 6 * * *', $$select public.generate_due_notifications()$$);
```

The app also calls `generate_due_notifications()` on load, so this is optional.
