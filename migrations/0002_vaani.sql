create table if not exists vaani_otp (
  phone text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0
);

create table if not exists vaani_profiles (
  user_id text primary key,
  shop_name text not null default '',
  phone text not null default '',
  role text not null default 'customer'
);

create table if not exists vaani_tickets (
  id text primary key,
  user_id text not null,
  vendor_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists vaani_tickets_user_idx on vaani_tickets (user_id);
