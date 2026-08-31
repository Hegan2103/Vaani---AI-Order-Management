create table if not exists vaani_push (
  endpoint text primary key,
  phone text not null,
  p256dh text not null,
  auth text not null
);
create index if not exists vaani_push_phone_idx on vaani_push (phone);
