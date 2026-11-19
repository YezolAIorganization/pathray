-- 0014_backfill_undocumented_objects.sql
-- What: writes back, as a migration, database objects that were created directly
--       in Supabase: journeys.sla_deadline, the reports and notifications_outbox
--       tables with their policies, the notification trigger, and the helper
--       functions is_admin and is_admin_or_expert.
-- Why:  the repository must be able to rebuild the database. Definitions below
--       were copied from the live database on 19 Nov 2026.
-- Safe to run on the live database: every statement is guarded, so it changes
-- nothing that already exists.
-- Not captured here (not read from the live database yet): foreign keys on the
-- two tables, and execute grants on is_admin and is_admin_or_expert.
-- Already covered elsewhere: advance_journey_status and publish_report (0012,
-- 0013), queue_report_delivery_notification (0013).

-- journeys.sla_deadline
alter table public.journeys
  add column if not exists sla_deadline timestamptz;

-- reports
create table if not exists public.reports (
  id uuid not null default gen_random_uuid(),
  journey_id uuid not null,
  summary text,
  content jsonb default '[]'::jsonb,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint reports_pkey primary key (id),
  constraint reports_journey_id_key unique (journey_id)
);

alter table public.reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports'
      and policyname = 'Admins can manage reports'
  ) then
    create policy "Admins can manage reports" on public.reports
      for all using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports'
      and policyname = 'Students can view published reports for their journeys'
  ) then
    create policy "Students can view published reports for their journeys"
      on public.reports for select
      using (
        is_published = true
        and exists (
          select 1 from public.journeys
          where journeys.id = reports.journey_id
            and journeys.student_id = auth.uid()
        )
      );
  end if;
end $$;

-- notifications_outbox
create table if not exists public.notifications_outbox (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  journey_id uuid,
  event_type text not null,
  payload jsonb default '{}'::jsonb,
  is_sent boolean default false,
  created_at timestamptz default now(),
  constraint notifications_outbox_pkey primary key (id)
);

alter table public.notifications_outbox enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications_outbox'
      and policyname = 'Admins can manage notifications outbox'
  ) then
    create policy "Admins can manage notifications outbox"
      on public.notifications_outbox
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- helper functions
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

create or replace function public.is_admin_or_expert()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'expert')
  );
end;
$$;

-- notification trigger (function defined in 0013)
drop trigger if exists trg_queue_report_notification on public.reports;
create trigger trg_queue_report_notification
  after insert or update on public.reports
  for each row execute function public.queue_report_delivery_notification();