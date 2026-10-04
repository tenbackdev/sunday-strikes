alter table public.profiles
  add column if not exists score_bucket_size integer not null default 20;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_score_bucket_size_check'
  ) then
    alter table public.profiles
      add constraint profiles_score_bucket_size_check check (score_bucket_size in (10, 20));
  end if;
end $$;
