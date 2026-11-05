-- Derived scratch/rubbing state is immutable and private to the owner of its pin.
-- Original attachments and all existing Storage grants/policies remain untouched.
create table public.case_evidence_progress_assets (
 pin_id uuid not null references public.case_evidence_pins(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 hash text not null check(hash~'^[a-f0-9]{64}$'),
 payload text not null check(octet_length(payload)<=4194304 and payload~'^data:(image/(png|jpeg|webp|gif)|audio/[A-Za-z0-9.+-]+);base64,'),
 primary key(pin_id,hash)
);
create index case_progress_assets_owner on public.case_evidence_progress_assets(user_id);
alter table public.case_evidence_progress_assets enable row level security;
revoke all on public.case_evidence_progress_assets from public,anon,authenticated;
grant select,insert,delete on public.case_evidence_progress_assets to authenticated;
create policy case_progress_assets_read on public.case_evidence_progress_assets for select to authenticated using (
 user_id=(select auth.uid()) and exists (
  select 1 from public.case_evidence_pins pin
  join public.investigation_board_publications board on board.id=pin.board_id and board.campaign_id=pin.campaign_id
  where pin.id=case_evidence_progress_assets.pin_id and pin.user_id=(select auth.uid()) and cris_private.can_access_campaign(pin.campaign_id)
 )
);
create policy case_progress_assets_insert on public.case_evidence_progress_assets for insert to authenticated with check (
 user_id=(select auth.uid()) and exists (
  select 1 from public.case_evidence_pins pin
  join public.investigation_board_publications board on board.id=pin.board_id and board.campaign_id=pin.campaign_id
  where pin.id=case_evidence_progress_assets.pin_id and pin.user_id=(select auth.uid()) and cris_private.can_access_campaign(pin.campaign_id)
 )
);
create policy case_progress_assets_delete on public.case_evidence_progress_assets for delete to authenticated using (user_id=(select auth.uid()));
