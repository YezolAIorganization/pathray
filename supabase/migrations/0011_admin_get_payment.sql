-- 0011_admin_get_payment.sql
-- What: adds admin_get_payment_for_order(p_order_id), which returns the latest
--       payment (method, trx id, status, proof path, reject reason, date) for one order.
-- Why:  the admin page queried a table "payment_proofs" that does not exist, and
--       admins have no select policy on payments. This gives admins a safe,
--       read-only way to see the proof without opening the table.
-- Security: admin only (raises Unauthorized otherwise), search_path fixed to public,
--           execute revoked from public and anon, granted to signed-in users only.

create or replace function public.admin_get_payment_for_order(p_order_id uuid)
returns table (
  id uuid,
  payment_method text,
  trx_id text,
  status text,
  proof_file_path text,
  reject_reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select p.id, p.payment_method, p.trx_id, p.status,
         p.proof_file_path, p.reject_reason, p.created_at
  from public.payments p
  where p.order_id = p_order_id
  order by p.created_at desc
  limit 1;
end;
$$;

revoke execute on function public.admin_get_payment_for_order(uuid) from public, anon;
grant execute on function public.admin_get_payment_for_order(uuid) to authenticated;