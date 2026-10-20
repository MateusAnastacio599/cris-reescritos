create table public.agent_profiles (
 user_id uuid primary key references public.director_accounts(user_id) on delete cascade,
 display_name text not null, clearance text not null default 'NÍVEL DE ACESSO: 04'
);
alter table public.agent_profiles enable row level security;
revoke all on public.agent_profiles from anon,authenticated;
grant select on public.agent_profiles to authenticated;
grant all on public.agent_profiles to service_role;
create policy agent_profiles_read on public.agent_profiles for select to authenticated using(user_id=(select auth.uid()) or (select cris_private.is_director_operator()));
create table public.director_workspaces (
 id uuid primary key,owner_id uuid not null references auth.users(id),campaign_id uuid not null references public.campaigns(id),
 payload jsonb not null,media jsonb not null default '{}',revision bigint not null default 1,updated_at timestamptz not null default now()
);
create index director_workspaces_owner_idx on public.director_workspaces(owner_id);
create index director_workspaces_campaign_idx on public.director_workspaces(campaign_id);
alter table public.director_workspaces enable row level security;
revoke all on public.director_workspaces from anon,authenticated;
grant select on public.director_workspaces to authenticated;
grant all on public.director_workspaces to service_role;
create policy director_workspace_read on public.director_workspaces for select to authenticated using(owner_id=(select auth.uid()));
create function public.save_director_workspace(p_id uuid,p_revision bigint,p_payload jsonb,p_media jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare next_rev bigint;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required';end if;
 if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_media)<>'object' then raise exception 'Invalid workspace';end if;
 update public.director_workspaces set payload=p_payload,media=p_media,revision=revision+1,updated_at=now() where id=p_id and owner_id=(select auth.uid()) and revision=p_revision returning revision into next_rev;
 if next_rev is null then raise exception 'CONFLICT: reload the cloud copy before saving';end if;
 return next_rev;
end $$;
revoke all on function public.save_director_workspace(uuid,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.save_director_workspace(uuid,bigint,jsonb,jsonb) to authenticated;
create table public.character_sheets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 campaign_id uuid not null references public.campaigns(id),payload jsonb not null,revision bigint not null default 1,updated_at timestamptz not null default now()
);
create index character_sheets_campaign_idx on public.character_sheets(campaign_id);
alter table public.character_sheets enable row level security;
revoke all on public.character_sheets from anon,authenticated;
grant select,insert,delete on public.character_sheets to authenticated;
grant update(payload,revision) on public.character_sheets to authenticated;
grant all on public.character_sheets to service_role;
create policy sheets_read on public.character_sheets for select to authenticated using(cris_private.can_access_campaign(campaign_id,true) or (user_id=(select auth.uid()) and cris_private.can_access_campaign(campaign_id)));
create policy sheets_insert on public.character_sheets for insert to authenticated with check(user_id=(select auth.uid()) and cris_private.can_access_campaign(campaign_id));
create policy sheets_update on public.character_sheets for update to authenticated using(user_id=(select auth.uid()) and cris_private.can_access_campaign(campaign_id)) with check(user_id=(select auth.uid()) and cris_private.can_access_campaign(campaign_id));
create policy sheets_delete on public.character_sheets for delete to authenticated using(user_id=(select auth.uid()) and cris_private.can_access_campaign(campaign_id));
create table public.board_snapshots (
 campaign_id uuid primary key references public.campaigns(id) on delete cascade,payload jsonb not null,revision bigint not null default 1,updated_at timestamptz not null default now()
);
alter table public.board_snapshots enable row level security;
revoke all on public.board_snapshots from anon,authenticated;
grant select,insert on public.board_snapshots to authenticated;
grant update(payload,revision) on public.board_snapshots to authenticated;
grant all on public.board_snapshots to service_role;
create policy board_read on public.board_snapshots for select to authenticated using(cris_private.can_access_campaign(campaign_id,true));
create policy board_insert on public.board_snapshots for insert to authenticated with check(cris_private.can_access_campaign(campaign_id,true));
create policy board_update on public.board_snapshots for update to authenticated using(cris_private.can_access_campaign(campaign_id,true)) with check(cris_private.can_access_campaign(campaign_id,true));
-- Applied correction: compare-and-save RPC runs under the caller's RLS permissions.
alter function public.save_director_workspace(uuid,bigint,jsonb,jsonb) security invoker;
grant update(payload,media,revision,updated_at) on public.director_workspaces to authenticated;
create policy workspace_owner_update on public.director_workspaces for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
