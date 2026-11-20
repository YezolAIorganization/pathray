-- 0018_advance_status_no_skip.sql
-- What: replaces advance_journey_status so an admin can no longer move a journey
--       from awaiting_profile to in_research.
-- Why:  that move skipped the student's profile and never started the 48-hour
--       clock. Only submit_profile (called by the student) may make that move.
-- Allowed admin moves now:
--     in_research -> in_review
--     in_review   -> in_research   (send back for more work)
--     delivered   -> closed
--   "delivered" is reached only through publish_report.
-- Security: admin only, search_path public, execute revoked from public and anon.

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
       (v_current = 'in_research' and v_new = 'in_review')
    or (v_current = 'in_review'   and v_new = 'in_research')
    or (v_current = 'delivered'   and v_new = 'closed')
  ) then
    raise exception 'Move from % to % is not allowed', v_current, v_new;
  end if;

  update public.journeys
  set status = v_new, updated_at = now()
  where id = p_journey_id;
end;
$$;

revoke execute on function public.advance_journey_status(uuid, text) from public, anon;
grant execute on function public.advance_journey_status(uuid, text) to authenticated;