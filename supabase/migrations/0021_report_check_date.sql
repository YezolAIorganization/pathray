-- 0021_report_check_date.sql
-- What: publishing now also requires every pathway to carry checked_on, the date
--       the fact was checked against its source, as text YYYY-MM-DD, not in the future
--       (one day of slack for time zones).
-- Why:  the Quick Check and the order page promise "the source and check date for
--       every fact". Both publish_report and the trigger enforce_report_publish_rules
--       enforce this, so a direct table edit cannot skip it either.
-- Note: the rest of both functions is unchanged from the live versions read on 27 Nov 2026.
--       Save Draft is not affected; only publishing is. Do not run this before the
--       report builder has a "Checked on" field, or publishing will be refused.

create or replace function public.enforce_report_publish_rules()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
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

    if exists (
      select 1
      from jsonb_array_elements(new.content) as elem
      where case
              when coalesce(elem ->> 'checked_on', '') ~ '^\d{4}-\d{2}-\d{2}$'
                then (elem ->> 'checked_on')::date > current_date + 1
              else true
            end
    ) then
      raise exception 'Every pathway needs a valid checked_on date (YYYY-MM-DD, not in the future) before publishing';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.publish_report(p_journey_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if exists (
    select 1
    from jsonb_array_elements(v_content) e
    where case
            when coalesce(e ->> 'checked_on', '') ~ '^\d{4}-\d{2}-\d{2}$'
              then (e ->> 'checked_on')::date > current_date + 1
            else true
          end
  ) then
    raise exception 'Every pathway needs a valid checked_on date (YYYY-MM-DD, not in the future)';
  end if;

  update public.reports
  set is_published = true, updated_at = now()
  where journey_id = p_journey_id;

  update public.journeys
  set status = 'delivered', updated_at = now()
  where id = p_journey_id and status = 'in_review';
end;
$function$;