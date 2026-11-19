-- 0012_fix_advance_and_publish.sql
-- What: replaces advance_journey_status and publish_report.
-- Why:  advance_journey_status wrote text into an enum column and accepted any
--       status in any order. publish_report marked the journey delivered even
--       when no report existed.
-- Rules now:
--   advance_journey_status allows only these moves:
--     awaiting_profile -> in_research
--     in_research      -> in_review
--     in_review        -> in_research   (send back for more work)
--     delivered        -> closed
--   "delivered" can only be reached through publish_report.
--   publish_report requires the journey to be in_review and a report with
--   content to exist.
-- Security: admin only, search_path fixed to public, execute revoked from
--           public and anon, granted to signed-in users only.

create or replace function public.advance_journey_status(p_journey_id uuid, p_new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.journey_status;
  v_new public.journey_status;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  begin
    v_new := p_new_status::public.journey_status;
  exception when invalid_text_representation then
    raise exception 'Invalid status: %', p_new_status;
  end;

  select status into v_current
  from public.journeys
  where id = p_journey_id
  for update;

  if not found then
    raise exception 'Journey not found';
  end if;

  if not (
       (v_current = 'awaiting_profile' and v_new = 'in_research')
    or (v_current = 'in_research'      and v_new = 'in_review')
    or (v_current = 'in_review'        and v_new = 'in_research')
    or (v_current = 'delivered'        and v_new = 'closed')
  ) then
    raise exception 'Move from % to % is not allowed', v_current, v_new;
  end if;

  update public.journeys
  set status = v_new, updated_at = now()
  where id = p_journey_id;
end;
$$;

create or replace function public.publish_report(p_journey_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.journey_status;
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

  if v_current <> 'in_review' then
    raise exception 'Journey must be in_review to publish (it is %)', v_current;
  end if;

  if not exists (
    select 1 from public.reports
    where journey_id = p_journey_id and content is not null
  ) then
    raise exception 'No report to publish';
  end if;

  update public.reports
  set is_published = true, updated_at = now()
  where journey_id = p_journey_id;

  update public.journeys
  set status = 'delivered', updated_at = now()
  where id = p_journey_id;
end;
$$;

revoke execute on function public.advance_journey_status(uuid, text) from public, anon;
revoke execute on function public.publish_report(uuid) from public, anon;
grant execute on function public.advance_journey_status(uuid, text) to authenticated;
grant execute on function public.publish_report(uuid) to authenticated;s