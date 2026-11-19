-- 0013_report_verification.sql
-- What: (1) fixes queue_report_delivery_notification, (2) makes publish_report
--       verify the report content on the server, (3) unpublishes a published
--       report when its content or summary is edited.
-- Why:  (1) the old trigger function selected journeys.user_id, profile_id and
--           owner_id, which do not exist, so saving a report would fail.
--       (2) fact verification only existed in the browser; a direct call to
--           publish_report could publish unverified content.
--       (3) editing a published report changed what the student sees with no
--           verification step.
-- Security: publish_report stays admin only, search_path public, execute
--           revoked from public and anon.

-- 1. Notification trigger function (uses student_id only)
create or replace function public.queue_report_delivery_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if new.is_published = true then
    if tg_op = 'INSERT' or old.is_published is distinct from true then
      select student_id into v_user_id
      from public.journeys
      where id = new.journey_id;

      insert into public.notifications_outbox (user_id, journey_id, event_type, payload)
      values (v_user_id, new.journey_id, 'report_published',
              jsonb_build_object('report_id', new.id));
    end if;
  end if;
  return new;
end;
$$;

-- 2. Unpublish a published report when its content or summary changes
create or replace function public.reports_unpublish_on_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_published = true and new.is_published = true
     and (new.content is distinct from old.content
          or new.summary is distinct from old.summary) then
    new.is_published := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reports_unpublish_on_edit on public.reports;
create trigger trg_reports_unpublish_on_edit
  before update on public.reports
  for each row execute function public.reports_unpublish_on_edit();

-- 3. publish_report with server-side verification
create or replace function public.publish_report(p_journey_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.journey_status;
  v_content jsonb;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  select status into v_current
  from public.journeys
  where id = p_journey_id
  for update;

  if not found then
    raise exception 'Journey not found';
  end if;

  if v_current not in ('in_review', 'delivered') then
    raise exception 'Journey must be in_review or delivered to publish (it is %)', v_current;
  end if;

  select content into v_content
  from public.reports
  where journey_id = p_journey_id;

  if not found then
    raise exception 'No report to publish';
  end if;

  if v_content is null
     or jsonb_typeof(v_content) <> 'array'
     or jsonb_array_length(v_content) = 0 then
    raise exception 'Report has no pathways';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_content) e
    where e -> 'fact_verified' is distinct from 'true'::jsonb
       or coalesce(e ->> 'source_url', '') !~* '^https?://\S+'
  ) then
    raise exception 'Every pathway needs fact_verified and an official source URL';
  end if;

  update public.reports
  set is_published = true, updated_at = now()
  where journey_id = p_journey_id;

  update public.journeys
  set status = 'delivered', updated_at = now()
  where id = p_journey_id and status = 'in_review';
end;
$$;

revoke execute on function public.publish_report(uuid) from public, anon;
grant execute on function public.publish_report(uuid) to authenticated;