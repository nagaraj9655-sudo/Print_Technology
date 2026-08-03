-- ============================================================================
--  Magizhini — Supabase schema (run once in the Supabase SQL Editor)
--  Dashboard → SQL Editor → New query → paste all of this → Run.
--  Safe to re-run: it uses IF NOT EXISTS / OR REPLACE / DROP POLICY guards.
-- ============================================================================

-- ---------- Profiles (one row per auth user, holds the app role) ------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null default '',
  email         text not null default '',
  role          text not null default 'Operator' check (role in ('Admin','Operator')),
  allowed_menus jsonb, -- Operator menu access (null = full access)
  created_at    timestamptz not null default now()
);
-- If upgrading an existing project, make sure the column exists:
alter table public.profiles add column if not exists allowed_menus jsonb;

-- Is the current caller an Admin?  (security definer so it can read profiles)
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin');
$$;

-- Auto-create a profile whenever an auth user is created.
-- The very first user to sign up becomes the Admin; everyone else Operator
-- (unless a role was passed in user metadata by the admin-create-user function).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare cnt int;
begin
  select count(*) into cnt from public.profiles;
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    case when cnt = 0 then 'Admin'
         else coalesce(new.raw_user_meta_data->>'role', 'Operator') end
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Business tables --------------------------------------------------
create table if not exists public.companies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default '',
  address        text default '',
  phone          text default '',
  email          text,
  gstin          text,
  state_code     text,
  logo_data_url  text,
  bank_details   text,
  invoice_prefix text,
  quote_prefix   text,
  accent         text,
  accent2        text,
  template       text,
  font_family    text,
  terms          text,
  handbooks      jsonb not null default '[]'::jsonb,
  is_active      boolean not null default true,
  updated_at     timestamptz not null default now()
);
alter table public.companies add column if not exists handbooks jsonb not null default '[]'::jsonb;

create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  address    text default '',
  phone      text default '',
  gstin      text,
  notes      text,
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id                  uuid primary key default gen_random_uuid(),
  bill_no             int  not null default 0,
  company_bill_no     text not null default 'DRAFT',
  date                date not null,
  company_id          uuid references public.companies(id) on delete set null,
  customer_type       text not null default 'Regular',
  customer_id         uuid,
  customer_name       text default '',
  customer_address    text default '',
  customer_phone      text default '',
  customer_gstin      text,
  items               jsonb not null default '[]'::jsonb,
  discount_amount     numeric not null default 0,
  discount_is_percent boolean default false,
  gst_enabled         boolean,
  original_cost       numeric,
  bill_type           text default 'Online',
  handbook_id         uuid,
  hand_book_no        text,
  hand_bill_no        text,
  received_amount     numeric not null default 0,
  payments            jsonb not null default '[]'::jsonb,
  doc_status          text not null default 'Draft',
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create table if not exists public.quotations (
  id                  uuid primary key default gen_random_uuid(),
  quote_no            int  not null default 0,
  company_quote_no    text not null default 'DRAFT',
  date                date not null,
  company_id          uuid references public.companies(id) on delete set null,
  customer_type       text not null default 'Regular',
  customer_id         uuid,
  customer_name       text default '',
  customer_address    text default '',
  customer_phone      text default '',
  customer_gstin      text,
  items               jsonb not null default '[]'::jsonb,
  discount_amount     numeric not null default 0,
  discount_is_percent boolean default false,
  gst_enabled         boolean,
  original_cost       numeric,
  status              text not null default 'Draft',
  valid_until         date,
  converted_bill_id   uuid,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- Single-row config + numbering counters
create table if not exists public.app_settings (
  id   int primary key default 1 check (id = 1),
  data jsonb not null
);

create table if not exists public.counters (
  id                 int primary key default 1 check (id = 1),
  bill_no            int not null default 0,
  quote_no           int not null default 0,
  company_bill_seq   jsonb not null default '{}'::jsonb,
  company_quote_seq  jsonb not null default '{}'::jsonb
);

-- ---------- Row-level security ----------------------------------------------
alter table public.profiles     enable row level security;
alter table public.companies    enable row level security;
alter table public.customers    enable row level security;
alter table public.bills        enable row level security;
alter table public.quotations   enable row level security;
alter table public.app_settings enable row level security;
alter table public.counters     enable row level security;

-- profiles: any signed-in user can read; users edit their own row; admins manage all
drop policy if exists "profiles read"       on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles admin all"  on public.profiles;
create policy "profiles read"       on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());
create policy "profiles admin all"  on public.profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- business tables: any authenticated member of this organisation has full access
do $$
declare t text;
begin
  foreach t in array array['companies','customers','bills','quotations','app_settings','counters']
  loop
    execute format('drop policy if exists "%s all" on public.%I', t, t);
    execute format('create policy "%s all" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- Done. Sign up your first user in the app (they become Admin automatically),
-- then the app auto-seeds your two companies on first load.
