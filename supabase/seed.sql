-- Initial members + baseline cumulative fines.
-- Run this once after schema.sql.
-- legacy_paid_total = cumulative fines already settled before the app existed (total 64,000 KRW).
-- No carried-over pending fines — everyone starts fresh from here.

insert into public.users (name, is_admin, legacy_paid_total) values
  ('멤버1', true,  0),
  ('멤버2', false, 0),
  ('멤버3', false, 0),
  ('멤버4', false, 0),
  ('멤버5', false, 0),
  ('멤버6', false, 0),
  ('멤버7', false, 0),
  ('멤버8', false, 0)
on conflict (name) do nothing;
