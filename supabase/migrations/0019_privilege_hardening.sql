-- 0019_privilege_hardening.sql
-- What: (1) removes every table privilege from the anon role in schema public,
--       (2) removes direct write privileges from signed-in users on tables that
--       only change through security-definer functions, (3) moves the remaining
--       role-public policies on journeys, orders and profiles to authenticated.
-- Why:  Supabase grants anon and authenticated broad table privileges by default.
--       Row-level security blocks them today, but our rule is no anon access and
--       writes only through functions (defense in depth). Found by the security
--       check on 23 Nov 2026.
-- Careful: profiles keeps its column-level UPDATE grants (full_name, market_id,
--       phone). They are NOT touched here, because revoking table-level UPDATE
--       would also remove those column grants. reports keeps INSERT and UPDATE
--       for the admin report builder (its policies allow admins only).
-- If something breaks, the app only needs what is listed under "keeps" below;
--       restore a privilege with: grant <privilege> on public.<table> to authenticated;

-- 1. anon: no access to anything in public
revoke all on all tables in schema public from anon;

-- 2a. Tables only functions touch: signed-in users lose everything
revoke all on public.audit_logs, public.payments, public.quick_checks
  from authenticated;

-- 2b. Read-only for signed-in users (keeps SELECT, loses writes and extras)
revoke insert, update, delete, truncate, references, trigger
  on public.journeys, public.orders, public.markets, public.notifications_outbox,
     public.services, public.service_market_prices
  from authenticated;

-- 2c. profiles: keeps SELECT and the column-level UPDATE grants; loses the rest
revoke insert, delete, truncate, references, trigger
  on public.profiles
  from authenticated;

-- 2d. reports: keeps SELECT, INSERT, UPDATE for the admin report builder
revoke delete, truncate, references, trigger
  on public.reports
  from authenticated;

-- 3. Policies: role public -> authenticated (conditions are unchanged)
alter policy "Admins can view all journeys" on public.journeys to authenticated;
alter policy "Admins manage journeys" on public.journeys to authenticated;
alter policy "Students view own journeys" on public.journeys to authenticated;
alter policy "Admins can view all orders" on public.orders to authenticated;
alter policy "Students view own orders" on public.orders to authenticated;
alter policy "Users update own profile" on public.profiles to authenticated;
alter policy "Users view own profile" on public.profiles to authenticated;