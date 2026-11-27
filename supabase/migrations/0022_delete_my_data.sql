-- 0022_delete_my_data.sql
-- What: adds delete_my_data(), which erases the signed-in student's personal data in place:
--       clears name and phone, replaces the email with a placeholder, deletes Quick Check
--       answers, profile forms, reports and unsent notifications, and clears the payment
--       receipt path, transaction ID and reject reason. Order and payment rows stay
--       (reference, amount, dates, status) for accounting. Returns the old receipt file
--       paths so the app can delete those files through the Storage API (SQL cannot).
-- Why:  the consent text promises "Delete it any time". Chosen option B1 (erase in place,
--       login email stays in Supabase Auth; orders stay linked to the account).
-- Rules: acts only on auth.uid(); refuses admin and expert accounts; security definer with
--       a fixed search_path; executable by signed-in users only, never anon or public.

create or replace function public.delete_my_data()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_paths jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  if public.is_admin_or_expert() then
    raise exception 'Staff accounts cannot use this function';
  end if;

  -- Receipt files to delete afterwards through the Storage API.
  select coalesce(jsonb_agg(p.proof_file_path), '[]'::jsonb)
  into v_paths
  from payments p
  join orders o on o.id = p.order_id
  join journeys j on j.id = o.journey_id
  where j.student_id = v_uid
    and p.proof_file_path is not null
    and p.proof_file_path <> 'deleted';

  -- Order and payment rows stay; personal and proof details are cleared.
  update payments p
  set proof_file_path = 'deleted',
      trx_id = null,
      reject_reason = null
  from orders o
  join journeys j on j.id = o.journey_id
  where p.order_id = o.id
    and j.student_id = v_uid;

  delete from quick_checks
  where journey_id in (select id from journeys where student_id = v_uid);

  delete from profile_submissions
  where student_id = v_uid;

  delete from reports
  where journey_id in (select id from journeys where student_id = v_uid);

  delete from notifications_outbox
  where user_id = v_uid
     or journey_id in (select id from journeys where student_id = v_uid);

  update profiles
  set full_name = null,
      phone = null,
      email = 'deleted-' || v_uid::text || '@deleted.invalid',
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object('proof_paths', v_paths);
end;
$function$;

revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- Receipt files: a student may delete a file in their own folder only when no payment row
-- still points to it (the receipt of a live order stays; after delete_my_data() clears the
-- path, the file can go). The helper is needed because students cannot read payments.
create or replace function public.is_proof_file_in_use(p_path text)
returns boolean
language sql
security definer
set search_path to 'public'
stable
as $function$
  select exists (select 1 from payments where proof_file_path = p_path);
$function$;

revoke execute on function public.is_proof_file_in_use(text) from public, anon;
grant execute on function public.is_proof_file_in_use(text) to authenticated;

create policy "Students delete own unused payment proofs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = (auth.uid())::text
  and not public.is_proof_file_in_use(name)
);