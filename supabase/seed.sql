-- Initial members + baseline cumulative fines.
-- Run this once after schema.sql.
-- legacy_paid_total = cumulative fines already settled before the app existed (total 64,000 KRW).
-- No carried-over pending fines — everyone starts fresh from here.

insert into public.users (name, is_admin, legacy_paid_total) values
  ('김준영', true,  19000),
  ('고성민', false, 13000),
  ('윤지훈', false, 1000),
  ('한유선', false, 4000),
  ('김현지', false, 12000),
  ('손은혜', false, 10000),
  ('주혜지', false, 3000),
  ('박서윤', false, 2000)
on conflict (name) do nothing;
