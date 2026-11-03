-- Durable campaign inbox. Sending is restricted to the authenticated Edge Function.
create table public.operation_notices (
 id uuid primary key,
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 audience text not null check(audience in ('self','campaign')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<30000),
 created_at timestamptz not null default now()
);
create index operation_notices_campaign_created on public.operation_notices(campaign_id,created_at desc);
create index operation_notices_author_created on public.operation_notices(created_by,created_at desc);
alter table public.operation_notices enable row level security;
revoke all on public.operation_notices from public,anon,authenticated;
grant select on public.operation_notices to authenticated;
grant all on public.operation_notices to service_role;
create policy notices_read on public.operation_notices for select to authenticated using (
 cris_private.can_access_campaign(campaign_id) and (audience='campaign' or created_by=(select auth.uid()))
);
create table public.notice_reads (
 notice_id uuid not null references public.operation_notices(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(notice_id,user_id)
);
create index notice_reads_user on public.notice_reads(user_id,notice_id);
alter table public.notice_reads enable row level security;
revoke all on public.notice_reads from public,anon,authenticated;
grant select,insert on public.notice_reads to authenticated;
grant update(read_at) on public.notice_reads to authenticated;
grant all on public.notice_reads to service_role;
create policy reads_select on public.notice_reads for select to authenticated using(user_id=(select auth.uid()));
create policy reads_insert on public.notice_reads for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.operation_notices n where n.id=notice_id));
create policy reads_update on public.notice_reads for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.operation_notices n where n.id=notice_id));
-- Push endpoints and private application keys never go to other users or public clients.
create table public.cris_push_config (id boolean primary key default true check(id), public_key text not null, private_key text not null);
alter table public.cris_push_config enable row level security;
revoke all on public.cris_push_config from public,anon,authenticated;
grant select on public.cris_push_config to service_role;
create table public.cris_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 subscription jsonb not null,
 app_base text not null,
 updated_at timestamptz not null default now()
);
create index push_subscriptions_user on public.cris_push_subscriptions(user_id);
alter table public.cris_push_subscriptions enable row level security;
revoke all on public.cris_push_subscriptions from public,anon,authenticated;
grant all on public.cris_push_subscriptions to service_role;
create table public.notice_push_deliveries (
 notice_id uuid not null references public.operation_notices(id) on delete cascade,
 subscription_id uuid not null references public.cris_push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 updated_at timestamptz not null default now(),
 primary key(notice_id,subscription_id)
);
create index push_deliveries_subscription on public.notice_push_deliveries(subscription_id);
alter table public.notice_push_deliveries enable row level security;
revoke all on public.notice_push_deliveries from public,anon,authenticated;
grant all on public.notice_push_deliveries to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cris-notice-images','cris-notice-images',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy notice_image_upload on storage.objects for insert to authenticated with check(bucket_id='cris-notice-images' and exists(select 1 from public.campaigns c where c.id::text=split_part(name,'/',1) and cris_private.can_access_campaign(c.id,true)));
create policy notice_image_read on storage.objects for select to authenticated using(bucket_id='cris-notice-images' and (exists(select 1 from public.campaigns c where c.id::text=split_part(name,'/',1) and cris_private.can_access_campaign(c.id,true)) or exists(select 1 from public.operation_notices n where n.payload->>'imagePath'=objects.name)));
-- Realtime is an enhancement; clients also refresh after reconnect and periodically.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='operation_notices') then
 alter publication supabase_realtime add table public.operation_notices;
 end if;
end $$;
