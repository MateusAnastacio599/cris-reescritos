-- CRIS Director: additive backend foundation; no frontend changes.
create schema if not exists cris_private;
revoke all on schema cris_private from public, anon;
grant usage on schema cris_private to authenticated;
create table public.campaigns (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 200),
 settings jsonb not null default '{}'::jsonb check(jsonb_typeof(settings)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index campaigns_owner_idx on public.campaigns(owner_id);
create table public.campaign_members (
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('gm','player')),
 created_at timestamptz not null default now(), primary key(campaign_id,user_id)
);
create index campaign_members_user_idx on public.campaign_members(user_id,campaign_id);
-- Private lookup bypasses membership RLS to avoid recursive policies.
create function cris_private.can_access_campaign(target uuid, require_gm boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from public.campaigns c where c.id=target and (
 c.owner_id=(select auth.uid()) or exists (
 select 1 from public.campaign_members m where m.campaign_id=c.id
 and m.user_id=(select auth.uid()) and (not require_gm or m.role='gm'))));
$$;
revoke all on function cris_private.can_access_campaign(uuid,boolean) from public,anon;
grant execute on function cris_private.can_access_campaign(uuid,boolean) to authenticated;
create function cris_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end; $$;
revoke all on function cris_private.touch_updated_at() from public,anon,authenticated;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
revoke all on public.campaigns,public.campaign_members from anon,authenticated;
grant select,insert,delete on public.campaigns to authenticated;
grant update(title,settings) on public.campaigns to authenticated;
grant select,insert,delete on public.campaign_members to authenticated;
grant update(role) on public.campaign_members to authenticated;
create policy campaigns_read on public.campaigns for select to authenticated using(cris_private.can_access_campaign(id));
create policy campaigns_create on public.campaigns for insert to authenticated with check(owner_id=(select auth.uid()));
create policy campaigns_edit on public.campaigns for update to authenticated using(cris_private.can_access_campaign(id,true)) with check(cris_private.can_access_campaign(id,true));
create policy campaigns_delete on public.campaigns for delete to authenticated using(owner_id=(select auth.uid()));
create policy members_read on public.campaign_members for select to authenticated using(user_id=(select auth.uid()) or cris_private.can_access_campaign(campaign_id,true));
create policy members_create on public.campaign_members for insert to authenticated with check(exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid())));
create policy members_edit on public.campaign_members for update to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid()))) with check(exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid())));
create policy members_delete on public.campaign_members for delete to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid())));
create trigger campaigns_touch before update on public.campaigns for each row execute function cris_private.touch_updated_at();

create table public.director_pages (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 legacy_id text,
 title text not null, blocks jsonb not null default '[]'::jsonb check(jsonb_typeof(blocks)='array'), settings jsonb not null default '{}'::jsonb, revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(campaign_id,id), unique(campaign_id,legacy_id)
);
create index director_pages_campaign_idx on public.director_pages(campaign_id);
alter table public.director_pages enable row level security;
revoke all on public.director_pages from anon,authenticated;
grant select,insert,delete on public.director_pages to authenticated;
grant update(title,blocks,settings,revision) on public.director_pages to authenticated;
create policy director_pages_read on public.director_pages for select to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create policy director_pages_create on public.director_pages for insert to authenticated with check(cris_private.can_access_campaign(campaign_id,true));
create policy director_pages_edit on public.director_pages for update to authenticated using(cris_private.can_access_campaign(campaign_id,true)) with check(cris_private.can_access_campaign(campaign_id,true));
create policy director_pages_delete on public.director_pages for delete to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create trigger director_pages_touch before update on public.director_pages for each row execute function cris_private.touch_updated_at();

create table public.director_scenes (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 legacy_id text,
 title text not null, page_id uuid, config jsonb not null default '{}'::jsonb, foreign key(campaign_id,page_id) references public.director_pages(campaign_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(campaign_id,id), unique(campaign_id,legacy_id)
);
create index director_scenes_campaign_idx on public.director_scenes(campaign_id);
alter table public.director_scenes enable row level security;
revoke all on public.director_scenes from anon,authenticated;
grant select,insert,delete on public.director_scenes to authenticated;
grant update(title,page_id,config) on public.director_scenes to authenticated;
create policy director_scenes_read on public.director_scenes for select to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create policy director_scenes_create on public.director_scenes for insert to authenticated with check(cris_private.can_access_campaign(campaign_id,true));
create policy director_scenes_edit on public.director_scenes for update to authenticated using(cris_private.can_access_campaign(campaign_id,true)) with check(cris_private.can_access_campaign(campaign_id,true));
create policy director_scenes_delete on public.director_scenes for delete to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create trigger director_scenes_touch before update on public.director_scenes for each row execute function cris_private.touch_updated_at();
create index director_scenes_page_idx on public.director_scenes(campaign_id,page_id);

create table public.media_assets (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 legacy_id text,
 title text not null,
 kind text not null check(kind in ('music','sfx','ambience','document','image')),
 source_type text not null check(source_type in ('file','youtube','external')),
 bucket_id text, object_path text, source_url text, youtube_id text,
 settings jsonb not null default '{}'::jsonb,
 check((source_type='file' and bucket_id is not null and bucket_id in ('cris-audio','cris-documents','cris-images') and object_path is not null and split_part(object_path,'/',1)=campaign_id::text and source_url is null and youtube_id is null)
 or (source_type='youtube' and youtube_id ~ '^[A-Za-z0-9_-]{11}$' and youtube_id is not null and bucket_id is null and object_path is null)
 or (source_type='external' and source_url like 'https://%' and source_url is not null and bucket_id is null and object_path is null)),
 unique(bucket_id,object_path),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(campaign_id,id), unique(campaign_id,legacy_id)
);
create index media_assets_campaign_idx on public.media_assets(campaign_id);
alter table public.media_assets enable row level security;
revoke all on public.media_assets from anon,authenticated;
grant select,insert,delete on public.media_assets to authenticated;
grant update(title,kind,source_type,bucket_id,object_path,source_url,youtube_id,settings) on public.media_assets to authenticated;
create policy media_assets_read on public.media_assets for select to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create policy media_assets_create on public.media_assets for insert to authenticated with check(cris_private.can_access_campaign(campaign_id,true));
create policy media_assets_edit on public.media_assets for update to authenticated using(cris_private.can_access_campaign(campaign_id,true)) with check(cris_private.can_access_campaign(campaign_id,true));
create policy media_assets_delete on public.media_assets for delete to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create trigger media_assets_touch before update on public.media_assets for each row execute function cris_private.touch_updated_at();

create table public.audio_playlists (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 legacy_id text,
 title text not null, items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array'), settings jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(campaign_id,id), unique(campaign_id,legacy_id)
);
create index audio_playlists_campaign_idx on public.audio_playlists(campaign_id);
alter table public.audio_playlists enable row level security;
revoke all on public.audio_playlists from anon,authenticated;
grant select,insert,delete on public.audio_playlists to authenticated;
grant update(title,items,settings) on public.audio_playlists to authenticated;
create policy audio_playlists_read on public.audio_playlists for select to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create policy audio_playlists_create on public.audio_playlists for insert to authenticated with check(cris_private.can_access_campaign(campaign_id,true));
create policy audio_playlists_edit on public.audio_playlists for update to authenticated using(cris_private.can_access_campaign(campaign_id,true)) with check(cris_private.can_access_campaign(campaign_id,true));
create policy audio_playlists_delete on public.audio_playlists for delete to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create trigger audio_playlists_touch before update on public.audio_playlists for each row execute function cris_private.touch_updated_at();

create table public.ambience_presets (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 legacy_id text,
 title text not null, layers jsonb not null default '[]'::jsonb check(jsonb_typeof(layers)='array'), settings jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(campaign_id,id), unique(campaign_id,legacy_id)
);
create index ambience_presets_campaign_idx on public.ambience_presets(campaign_id);
alter table public.ambience_presets enable row level security;
revoke all on public.ambience_presets from anon,authenticated;
grant select,insert,delete on public.ambience_presets to authenticated;
grant update(title,layers,settings) on public.ambience_presets to authenticated;
create policy ambience_presets_read on public.ambience_presets for select to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create policy ambience_presets_create on public.ambience_presets for insert to authenticated with check(cris_private.can_access_campaign(campaign_id,true));
create policy ambience_presets_edit on public.ambience_presets for update to authenticated using(cris_private.can_access_campaign(campaign_id,true)) with check(cris_private.can_access_campaign(campaign_id,true));
create policy ambience_presets_delete on public.ambience_presets for delete to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create trigger ambience_presets_touch before update on public.ambience_presets for each row execute function cris_private.touch_updated_at();

create table public.director_cues (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 legacy_id text,
 title text not null, actions jsonb not null default '[]'::jsonb check(jsonb_typeof(actions)='array'), settings jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(campaign_id,id), unique(campaign_id,legacy_id)
);
create index director_cues_campaign_idx on public.director_cues(campaign_id);
alter table public.director_cues enable row level security;
revoke all on public.director_cues from anon,authenticated;
grant select,insert,delete on public.director_cues to authenticated;
grant update(title,actions,settings) on public.director_cues to authenticated;
create policy director_cues_read on public.director_cues for select to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create policy director_cues_create on public.director_cues for insert to authenticated with check(cris_private.can_access_campaign(campaign_id,true));
create policy director_cues_edit on public.director_cues for update to authenticated using(cris_private.can_access_campaign(campaign_id,true)) with check(cris_private.can_access_campaign(campaign_id,true));
create policy director_cues_delete on public.director_cues for delete to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create trigger director_cues_touch before update on public.director_cues for each row execute function cris_private.touch_updated_at();

create table public.director_backups (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 migration_key text not null,
 schema_version integer not null,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 created_at timestamptz not null default now(), unique(campaign_id,migration_key)
);
alter table public.director_backups enable row level security;
revoke all on public.director_backups from anon,authenticated;
grant select,insert on public.director_backups to authenticated;
create policy backups_read on public.director_backups for select to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create policy backups_create on public.director_backups for insert to authenticated with check(cris_private.can_access_campaign(campaign_id,true));
-- Private files. The first folder is always the campaign UUID.
insert into storage.buckets(id,name,public) values
 ('cris-audio','cris-audio',false),('cris-documents','cris-documents',false),('cris-images','cris-images',false);
create policy cris_files_select on storage.objects for select to authenticated using(bucket_id in ('cris-audio','cris-documents','cris-images') and exists(select 1 from public.campaigns c where c.id::text=split_part(name,'/',1) and cris_private.can_access_campaign(c.id,true))) ;
create policy cris_files_insert on storage.objects for insert to authenticated  with check(bucket_id in ('cris-audio','cris-documents','cris-images') and exists(select 1 from public.campaigns c where c.id::text=split_part(name,'/',1) and cris_private.can_access_campaign(c.id,true)));
create policy cris_files_update on storage.objects for update to authenticated using(bucket_id in ('cris-audio','cris-documents','cris-images') and exists(select 1 from public.campaigns c where c.id::text=split_part(name,'/',1) and cris_private.can_access_campaign(c.id,true))) with check(bucket_id in ('cris-audio','cris-documents','cris-images') and exists(select 1 from public.campaigns c where c.id::text=split_part(name,'/',1) and cris_private.can_access_campaign(c.id,true)));
create policy cris_files_delete on storage.objects for delete to authenticated using(bucket_id in ('cris-audio','cris-documents','cris-images') and exists(select 1 from public.campaigns c where c.id::text=split_part(name,'/',1) and cris_private.can_access_campaign(c.id,true))) ;
