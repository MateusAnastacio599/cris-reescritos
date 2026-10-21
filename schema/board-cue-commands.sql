-- Fila privada do mestre: o quadro é o único escritor do seu próprio snapshot.
create table public.board_cue_commands (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 item_id text not null check (length(item_id) between 1 and 180),
 action text not null check (action in ('reveal','hide')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 applied_at timestamptz,
 error text check (length(error)<=500)
);
create index board_cue_commands_pending on public.board_cue_commands(campaign_id,created_at,id) where applied_at is null;
alter table public.board_cue_commands enable row level security;
revoke all on public.board_cue_commands from anon,authenticated;
grant select,insert on public.board_cue_commands to authenticated;
grant update(applied_at,error) on public.board_cue_commands to authenticated;
create policy board_commands_read on public.board_cue_commands for select to authenticated using (cris_private.can_access_campaign(campaign_id,true));
create policy board_commands_insert on public.board_cue_commands for insert to authenticated with check (created_by=(select auth.uid()) and cris_private.can_access_campaign(campaign_id,true));
create policy board_commands_ack on public.board_cue_commands for update to authenticated using (cris_private.can_access_campaign(campaign_id,true)) with check (cris_private.can_access_campaign(campaign_id,true));
