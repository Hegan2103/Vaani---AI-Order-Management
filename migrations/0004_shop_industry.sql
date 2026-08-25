alter table vaani_profiles add column if not exists industry text not null default '';
alter table vaani_profiles add column if not exists is_vendor boolean not null default false;
