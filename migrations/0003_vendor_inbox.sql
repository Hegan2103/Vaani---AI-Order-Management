alter table vaani_profiles add column if not exists vendor_id text not null default '';
create index if not exists vaani_tickets_vendor_idx on vaani_tickets (vendor_id);
