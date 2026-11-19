-- Migration 0015: Add profile_submissions table and submit_profile RPC
-- What & Why: Stores student profile details submitted after payment confirmation,
-- transitions the journey from awaiting_profile to in_research, and starts the
-- 48-hour turnaround timer only once paid and profile-complete.

create table if not exists public.profile_submissions (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null unique references public.journeys(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  details jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_submissions_journey_id
  on public.profile_submissions(journey_id);

create index if not exists idx_profile_submissions_student_id
  on public.profile_submissions(student_id);

alter table public.profile_submissions enable row level security;

drop policy if exists "Students can view own profile submissions" on public.profile_submissions;
create policy "Students can view own profile submissions"
  on public.profile_submissions
  for select
  to authenticated
  using (student_id = auth.uid());

drop policy if exists "Admins and experts can view all profile submissions" on public.profile_submissions;
create policy "Admins and experts can view all profile submissions"
  on public.profile_submissions
  for select
  to authenticated
  using (public.is_admin_or_expert());

create or replace function public.submit_profile(
  p_journey_id uuid,
  p_details jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_journey public.journeys%rowtype;
  v_has_paid_order boolean;
  v_now timestamptz := now();
  v_deadline timestamptz := now() + interval '48 hours';
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Profile details must be a JSON object';
  end if;

  select * into v_journey
  from public.journeys
  where id = p_journey_id
  for update;

  if not found then
    raise exception 'Journey not found';
  end if;

  if v_journey.student_id <> v_uid then
    raise exception 'Unauthorized';
  end if;

  if v_journey.status <> 'awaiting_profile' then
    raise exception 'Profile can only be submitted when awaiting profile (current status: %)', v_journey.status;
  end if;

  select exists (
    select 1
    from public.orders
    where journey_id = p_journey_id
      and is_paid = true
  ) into v_has_paid_order;

  if not v_has_paid_order then
    raise exception 'A confirmed paid order is required before submitting profile';
  end if;

  insert into public.profile_submissions (
    journey_id,
    student_id,
    details,
    submitted_at,
    updated_at
  )
  values (
    p_journey_id,
    v_uid,
    p_details,
    v_now,
    v_now
  )
  on conflict (journey_id) do update
  set
    details = excluded.details,
    updated_at = v_now;

  update public.journeys
  set
    status = 'in_research',
    timer_started_at = coalesce(timer_started_at, v_now),
    timer_deadline_at = coalesce(timer_deadline_at, v_deadline),
    sla_deadline = coalesce(sla_deadline, v_deadline),
    updated_at = v_now
  where id = p_journey_id;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    details
  )
  values (
    v_uid,
    'profile_submitted',
    'journeys',
    p_journey_id,
    jsonb_build_object(
      'new_status', 'in_research',
      'timer_started_at', v_now,
      'timer_deadline_at', v_deadline
    )
  );
end;
$$;

revoke all on function public.submit_profile(uuid, jsonb) from public;
revoke all on function public.submit_profile(uuid, jsonb) from anon;
grant execute on function public.submit_profile(uuid, jsonb) to authenticated;