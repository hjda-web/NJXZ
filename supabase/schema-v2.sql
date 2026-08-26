alter table public.users
  add column if not exists common_crops jsonb not null default '[]'::jsonb;

create table if not exists public.region_crops (
  province text primary key,
  crops jsonb not null default '[]'::jsonb
);

create table if not exists public.solar_terms (
  term text primary key,
  tasks text not null
);

create table if not exists public.fertilizer_rules (
  crop text primary key,
  fertilizers jsonb not null default '[]'::jsonb
);

create table if not exists public.fertilizer_prices (
  fertilizer text primary key,
  min_price numeric not null,
  max_price numeric not null,
  unit text not null default '元/吨'
);

create table if not exists public.group_messages (
  id text primary key,
  group_id text not null,
  sender_phone text not null,
  nickname text not null,
  content text not null,
  created_at timestamptz not null
);

alter table public.region_crops enable row level security;
alter table public.solar_terms enable row level security;
alter table public.fertilizer_rules enable row level security;
alter table public.fertilizer_prices enable row level security;
alter table public.group_messages enable row level security;
