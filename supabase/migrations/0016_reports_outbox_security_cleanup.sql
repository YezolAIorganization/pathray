-- Migration 0016: Scope report/outbox policies to authenticated, enforce publish invariants, and record FKs/grants
-- What & Why: Ensures policies target authenticated (not public/anon), closes direct table-level
-- report publishing without verified pathways/sources, and records foreign keys and helper grants.

drop policy if exists "Admins can manage notifications outbox" on public.notifications_outbox;
create policy "Admins can manage notifications outbox"
  on public.notifications_outbox
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can manage reports" on public.reports;
create policy "Admins can manage reports"
  on public.reports
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Students can view published reports for their journeys" on public.reports;
create policy "Students can view published reports for their journeys"
  on public.reports
  for select
  to authenticated
  using (
    is_published = true
    and exists (
      select 1
      from public.journeys
      where journeys.id = reports.journey_id
        and journeys.student_id = auth.uid()
    )
  );

create or replace function public.enforce_report_publish_rules()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_count int;
  v_unverified int;
  v_bad_url int;
begin
  if new.is_published is true then
    if new.content is null or jsonb_typeof(new.content) <> 'array' then
      raise exception 'Cannot publish report without pathways array';
    end if;

    select count(*) into v_count
    from jsonb_array_elements(new.content);

    if v_count < 1 then
      raise exception 'Cannot publish report with zero pathways';
    end if;

    select count(*) into v_unverified
    from jsonb_array_elements(new.content) as elem
    where coalesce((elem->>'fact_verified')::boolean, false) is not true;

    if v_unverified > 0 then
      raise exception 'Cannot publish report while pathways are unverified';
    end if;

    select count(*) into v_bad_url
    from jsonb_array_elements(new.content) as elem
    where coalesce(trim(elem->>'source_url'), '') !~* '^https?://';

    if v_bad_url > 0 then
      raise exception 'Every pathway must have a valid http(s) source_url before publishing';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_report_publish_rules on public.reports;
create trigger trg_enforce_report_publish_rules
  before insert or update of is_published, content on public.reports
  for each row
  execute function public.enforce_report_publish_rules();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reports_journey_id_fkey'
  ) then
    alter table public.reports
      add constraint reports_journey_id_fkey
      foreign key (journey_id) references public.journeys(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'notifications_outbox_journey_id_fkey'
  ) then
    alter table public.notifications_outbox
      add constraint notifications_outbox_journey_id_fkey
      foreign key (journey_id) references public.journeys(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'notifications_outbox_user_id_fkey'
  ) then
    alter table public.notifications_outbox
      add constraint notifications_outbox_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete set null;
  end if;
end;
$$;

revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_admin_or_expert() from anon;
grant execute on function public.is_admin_or_expert() to authenticated;