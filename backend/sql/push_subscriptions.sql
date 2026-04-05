-- Chạy trong Supabase SQL Editor. Bảng lưu đăng ký Web Push (iPhone / PWA).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_updated_at_idx
  on public.push_subscriptions (updated_at desc);

-- Backend dùng SUPABASE_SERVICE_ROLE_KEY hoặc chính sách RLS phù hợp (insert/update own rows).
-- Ví dụ cho MVP (chỉ server ghi): tắt RLS hoặc policy chỉ service_role.

alter table public.push_subscriptions enable row level security;

-- Gỡ policy cũ nếu tạo lại:
-- drop policy if exists "service role all push_subscriptions" on public.push_subscriptions;

create policy "service role all push_subscriptions"
  on public.push_subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
