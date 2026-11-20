-- 0017_student_profile.sql
-- What: records the profile_submissions table and submit_profile function that
--       were created directly in Supabase, removes unneeded table privileges, and
--       adds server-side validation of the profile answers.
-- Why:  the table and function had no migration file. submit_profile accepted any
--       JSON of any size. anon and authenticated held full table privileges
--       (Supabase defaults); row-level security blocked them, but they are not
--       needed.
-- Rules in submit_profile (the live logic is kept as it was):
--   - caller must own the journey; journey must be awaiting_profile; the order
--     must be paid
--   - degree_level and field_of_study required; only six known fields are kept,
--     each with a length limit
--   - on success the journey moves to in_research and the 48-hour clock starts
-- Checked against the live database on 20 Nov 2026.

-- 1. Table as it is live
create table if not exists public.profile_submissions (
  id uuid not null default gen_random_uuid(),
  journey_id uuid not null,
  student_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_submissions_pkey primary key (id),
  constraint profile_submissions_journey_id_key unique (journey_id),
  constraint profile_submissions_journey_id_fkey
    foreign key (journey_id) references public.journeys(id) on delete cascade,
  constraint profile_submissions_student_id_fkey
    foreign key (student_id) references public.profiles(id) on delete cascade
);

alter table public.profile_submissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile_submissions'
      and policyname = 'Admins and experts can view all profile submissions'
  ) then
    create policy "Admins and experts can view all profile submissions"
      on public.profile_submissions
      for select to authenticated
      using (public.is_admin_or_expert());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile_submissions'
      and policyname = 'Students can view own profile submissions'
  ) then
    create policy "Students can view own profile submissions"
      on public.profile_submissions
      for select to authenticated
      using (student_id = auth.uid());
  end if;
end $$;

-- 2. Privileges: no anon access; signed-in users can only read (rows still
--    filtered by the policies above). Writes happen only through submit_profile.
revoke all on public.profile_submissions from anon;
revoke all on public.profile_submissions from authenticated;
grant select on public.profile_submissions to authenticated;

-- 3. submit_profile with validation (same signature and return type as live)
create or replace function public.submit_profile(p_journey_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_journey public.journeys%rowtype;
  v_has_paid_order boolean;
  v_now timestamptz := now();
  v_deadline timestamptz := now() + interval '48 hours';
  v_degree text;
  v_field text;
  v_gpa text;
  v_english text;
  v_budget text;
  v_notes text;
  v_clean jsonb;
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
    select 1 from public.orders
    where journey_id = p_journey_id and is_paid = true
  ) into v_has_paid_order;

  if not v_has_paid_order then
    raise exception 'A confirmed paid order is required before submitting profile';
  end if;

  v_degree  := btrim(coalesce(p_details ->> 'degree_level', ''));
  v_field   := btrim(coalesce(p_details ->> 'field_of_study', ''));
  v_gpa     := btrim(coalesce(p_details ->> 'gpa', ''));
  v_english := btrim(coalesce(p_details ->> 'english_status', ''));
  v_budget  := btrim(coalesce(p_details ->> 'budget_band', ''));
  v_notes   := btrim(coalesce(p_details ->> 'notes', ''));

  if v_degree = '' or v_field = '' then
    raise exception 'Degree level and field of study are required';
  end if;

  if char_length(v_degree) > 100
     or char_length(v_field) > 150
     or char_length(v_gpa) > 60
     or char_length(v_english) > 100
     or char_length(v_budget) > 100
     or char_length(v_notes) > 2000 then
    raise exception 'One of the answers is too long';
  end if;

  v_clean := jsonb_build_object(
    'degree_level', v_degree,
    'field_of_study', v_field,
    'gpa', v_gpa,
    'english_status', v_english,
    'budget_band', v_budget,
    'notes', v_notes
  );

  insert into public.profile_submissions (journey_id, student_id, details, submitted_at, updated_at)
  values (p_journey_id, v_uid, v_clean, v_now, v_now)
  on conflict (journey_id) do update
  set details = excluded.details,
      updated_at = v_now;

  update public.journeys
  set status = 'in_research',
      timer_started_at = coalesce(timer_started_at, v_now),
      timer_deadline_at = coalesce(timer_deadline_at, v_deadline),
      sla_deadline = coalesce(sla_deadline, v_deadline),
      updated_at = v_now
  where id = p_journey_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (
    v_uid, 'profile_submitted', 'journeys', p_journey_id,
    jsonb_build_object(
      'new_status', 'in_research',
      'timer_started_at', v_now,
      'timer_deadline_at', v_deadline
    )
  );
end;
$$;

revoke execute on function public.submit_profile(uuid, jsonb) from public, anon;
grant execute on function public.submit_profile(uuid, jsonb) to authenticated;s