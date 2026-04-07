-- Chạy trong Supabase → SQL Editor (đồng bộ với backend/lib/supabase.js).
-- Cột: name, jan_code, purchase_price — khớp payload upsert từ Backend.

create table if not exists public.my_inventory (
  jan_code text not null primary key,
  name text not null default '',
  purchase_price integer not null default 0 check (purchase_price >= 0)
);

comment on table public.my_inventory is 'Đồng bộ từ PUT /api/inventory — jan_code = mã JAN.';

-- Nếu đã có bảng cũ (id, jan, …), cần migrate tay hoặc đổi tên cột jan → jan_code.
