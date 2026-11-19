-- 0016_reports_outbox_security_cleanup.sql
-- What: (1) moves the reports and notifications_outbox policies from role public
--       to role authenticated, (2) adds a database rule that a report cannot be
--       published unless every pathway is fact-verified and has an http(s)
--       source URL, even if an admin edits the table directly, (3) renames the
--       0013 unpublish trigger so it always runs before the new rule, (4) records
--       the existing foreign keys, (5) closes execute on is_admin and
--       is_admin_or_expert to public and anon.
-- Why:  our rule is no policies for anon; admins could set is_published straight
--       through the table, skipping publish_report's checks; the repository must
--       be able to rebuild the database.
-- Checked against the live database on 19 Nov 2026: the three foreign keys exist
-- with these exact definitions, and there are no orphan rows.

-- 1. Policies scoped to authenticated
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

-- 2. Publish rules enforced by the database itself
create or replace function public.enforce_report_publish_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_published is true then
    if new.content is null
       or jsonb_typeof(new.content) <> 'array'
       or jsonb_array_length(new.content) = 0 then
      raise exception 'Cannot publish a report without pathways';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(new.content) as elem
      where elem -> 'fact_verified' is distinct from 'true'::jsonb
         or coalesce(elem ->> 'source_url', '') !~* '^https?://\S+'
    ) then
      raise exception 'Every pathway needs fact_verified and an http(s) source URL before publishing';
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

-- 3. Make the unpublish-on-edit trigger (0013) run first (BEFORE triggers run
--    in alphabetical order by name)
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.reports'::regclass
      and tgname = 'trg_reports_unpublish_on_edit'
  ) then
    alter trigger trg_reports_unpublish_on_edit on public.reports
      rename to trg_a_reports_unpublish_on_edit;
  end if;
end $$;

-- 4. Record the foreign keys exactly as they are live
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reports_journey_id_fkey'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_journey_id_fkey
      foreign key (journey_id) references public.journeys(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_outbox_journey_id_fkey'
      and conrelid = 'public.notifications_outbox'::regclass
  ) then
    alter table public.notifications_outbox
      add constraint notifications_outbox_journey_id_fkey
      foreign key (journey_id) references public.journeys(id) on delete