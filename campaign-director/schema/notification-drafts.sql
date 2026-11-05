create table public.operation_notice_drafts (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 created_by uuid not null default auth.uid() references auth.users(id),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object' and octet_length(payload::text)<30000),
 last_error text not null default '' check(length(last_error)<1000),
 updated_at timestamptz not null default now()
);
create index notice_drafts_owner_campaign on public.operation_notice_drafts(created_by,campaign_id,updated_at desc);
alter table public.operation_notice_drafts enable row level security;
revoke all on public.operation_notice_drafts from public,anon,authenticated;
grant select,insert,delete on public.operation_notice_drafts to authenticated;
grant update(payload,last_error,updated_at) on public.operation_notice_drafts to authenticated;
grant all on public.operation_notice_drafts to service_role;
create policy notice_drafts_read on public.operation_notice_drafts for select to authenticated using(created_by=(select auth.uid()) and cris_private.can_access_campaign(campaign_id,true));
create policy notice_drafts_insert on public.operation_notice_drafts for insert to authenticated with check(created_by=(select auth.uid()) and cris_private.can_access_campaign(campaign_id,true) and not exists(select 1 from public.operation_notices n where n.id=operation_notice_drafts.id));
create policy notice_drafts_edit on public.operation_notice_drafts for update to authenticated using(created_by=(select auth.uid()) and cris_private.can_access_campaign(campaign_id,true) and not exists(select 1 from public.operation_notices n where n.id=operation_notice_drafts.id)) with check(created_by=(select auth.uid()) and cris_private.can_access_campaign(campaign_id,true));
create policy notice_drafts_delete on public.operation_notice_drafts for delete to authenticated using(created_by=(select auth.uid()) and cris_private.can_access_campaign(campaign_id,true));
