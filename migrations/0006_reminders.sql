create table if not exists vaani_reminders (
  id text primary key,
  owner_ten text not null,
  contact_ten text not null,
  payload jsonb not null
);
create index if not exists vaani_reminders_owner_idx on vaani_reminders (owner_ten);
create index if not exists vaani_reminders_contact_idx on vaani_reminders (contact_ten);
