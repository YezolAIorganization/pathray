-- Migration 0010: fix confirm_payment and reject_payment
-- Run by hand in the Supabase SQL Editor, then keep this file in supabase/migrations.
--
-- Problems in the versions made earlier:
--  * Both wrote orders.updated_at, a column that does not exist, so they failed.
--  * Neither updated payments.status, so a rejected proof stayed "pending_review" and the
--    student could never send a new one (submit_payment_proof blocks while one is pending).
--  * reject_payment ignored the reason.
--  * confirm_payment started the 48 hour clock at payment time. The roadmap starts it when the
--    case is paid AND the profile is complete, so the clock is left for the profile step.
-- Both functions now check admin, lock and validate the order, update the payment row, write an
-- audit log entry, and are callable by signed-in users only.

alter function public.is_admin_or_expert() set search_path = public;

create or replace function public.confirm_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_payment_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.is_paid then
    raise exception 'This order is already paid';
  end if;

  select id into v_payment_id
  from payments
  where order_id = v_order.id and status = 'pending_review'
  order by created_at desc
  limit 1;
  if v_payment_id is null then
    raise exception 'No payment proof is waiting for review';
  end if;

  update payments
  set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  where id = v_payment_id;

  update orders set is_paid = true where id = v_order.id;

  update journeys
  set status = 'awaiting_profile', updated_at = now()
  where id = v_order.journey_id and status = 'payment_review';

  insert into audit_logs (actor_id, action, target_table, target_id, details)
  values (
    auth.uid(), 'payment_confirmed', 'orders', v_order.id,
    jsonb_build_object('payment_id', v_payment_id, 'reference', v_order.reference)
  );
end;
$$;

create or replace function public.reject_payment(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_payment_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'A reason between 3 and 500 characters is required';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.is_paid then
    raise exception 'This order is already paid';
  end if;

  select id into v_payment_id
  from payments
  where order_id = v_order.id and status = 'pending_review'
  order by created_at desc
  limit 1;
  if v_payment_id is null then
    raise exception 'No payment proof is waiting for review';
  end if;

  update payments
  set status = 'rejected', reject_reason = v_reason
  where id = v_payment_id;

  update journeys
  set status = 'awaiting_payment', updated_at = now()
  where id = v_order.journey_id and status = 'payment_review';

  insert into audit_logs (actor_id, action, target_table, target_id, details)
  values (
    auth.uid(), 'payment_rejected', 'orders', v_order.id,
    jsonb_build_object('payment_id', v_payment_id, 'reference', v_order.reference, 'reason', v_reason)
  );
end;
$$;

revoke all on function public.confirm_payment(uuid) from public, anon;
grant execute on function public.confirm_payment(uuid) to authenticated;

revoke all on function public.reject_payment(uuid, text) from public, anon;
grant execute on function public.reject_payment(uuid, text) to authenticated;
