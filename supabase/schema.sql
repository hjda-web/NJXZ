create table if not exists public.users (
  phone text primary key,
  hash text not null,
  salt text not null,
  role text not null,
  identity text,
  large_font integer not null default 0,
  nickname text,
  city text,
  created_at timestamptz not null,
  last_login_at timestamptz not null
);

create table if not exists public.sessions (
  token text primary key,
  phone text not null,
  expires_at timestamptz not null
);

create table if not exists public.groups (
  id text primary key,
  name text not null,
  leader_phone text not null,
  created_at timestamptz not null,
  members_json jsonb not null
);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.groups enable row level security;
