-- Independent drafts and released versions. Live board_snapshots stays unchanged.
create table public.investigation_boards (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 120),
 description text not null default '' check (length(description)<=2000),
 payload jsonb not null default '{"state":{"items":[],"pins":[],"strings":[]},"imgs":{}}'::jsonb check (jsonb_typeof(payload)='object'),
 revision integer not null default 1 check (revision>0),
 updated_at timestamptz not null default now(),
 unique(id,campaign_id)
);
create index investigation_boards_campaign_updated on public.investigation_boards(campaign_id,updated_at desc);
alter table public.investigation_boards enable row level security;
revoke all on public.investigation_boards from anon,authenticated;
grant select,insert,delete on public.investigation_boards to authenticated;
grant update(title,description,payload,revision,updated_at) on public.investigation_boards to authenticated;
create policy investigation_draft_read on public.investigation_boards for select to authenticated using (cris_private.can_access_campaign(campaign_id,true));
create policy investigation_draft_insert on public.investigation_boards for insert to authenticated with check (cris_private.can_access_campaign(campaign_id,true));
create policy investigation_draft_update on public.investigation_boards for update to authenticated using (cris_private.can_access_campaign(campaign_id,true)) with check (cris_private.can_access_campaign(campaign_id,true));
create policy investigation_draft_delete on public.investigation_boards for delete to authenticated using (cris_private.can_access_campaign(campaign_id,true));
create table public.investigation_board_publications (
 id uuid primary key,
 campaign_id uuid not null,
 title text not null check (length(trim(title)) between 1 and 120),
 description text not null default '' check (length(description)<=2000),
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 revision integer not null check (revision>0),
 updated_at timestamptz not null default now(),
 foreign key (id,campaign_id) references public.investigation_boards(id,campaign_id) on delete cascade
);
create index investigation_publications_campaign_updated on public.investigation_board_publications(campaign_id,updated_at desc);
alter table public.investigation_board_publications enable row level security;
revoke all on public.investigation_board_publications from anon,authenticated;
grant select,insert,delete on public.investigation_board_publications to authenticated;
grant update(title,description,payload,revision,updated_at) on public.investigation_board_publications to authenticated;
create policy investigation_publication_read on public.investigation_board_publications for select to authenticated using (cris_private.can_access_campaign(campaign_id));
create policy investigation_publication_insert on public.investigation_board_publications for insert to authenticated with check (cris_private.can_access_campaign(campaign_id,true));
create policy investigation_publication_update on public.investigation_board_publications for update to authenticated using (cris_private.can_access_campaign(campaign_id,true)) with check (cris_private.can_access_campaign(campaign_id,true));
create policy investigation_publication_delete on public.investigation_board_publications for delete to authenticated using (cris_private.can_access_campaign(campaign_id,true));
-- Allow only exact private assets referenced by a released board. Hidden GM
-- images and draft contents remain protected by the existing master-only policies.
create policy investigation_released_images on storage.objects for select to authenticated using (
 bucket_id='cris-images' and exists (
  select 1 from public.investigation_board_publications b,
   lateral jsonb_each(coalesce(b.payload->'imgs','{}'::jsonb)) asset
  where cris_private.can_access_campaign(b.campaign_id)
   and split_part(objects.name,'/',1)=b.campaign_id::text
   and asset.value->>'bucket'='cris-images' and asset.value->>'path'=objects.name
 )
);
create index investigation_publications_parent_idx on public.investigation_board_publications(id,campaign_id);
