-- Prepared props stay private until the player elects to pin the published source.
create table public.case_evidence_preparations (
 campaign_id uuid not null,
 board_id uuid not null,
 attachment_id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 source_ids text[] not null check(cardinality(source_ids) between 1 and 32),
 updated_at timestamptz not null default now(),
 primary key(board_id,attachment_id),
 foreign key(board_id,campaign_id) references public.investigation_boards(id,campaign_id) on delete cascade,
 foreign key(attachment_id,campaign_id) references public.case_attachments(id,campaign_id) on delete cascade
);
create index case_preparations_attachment on public.case_evidence_preparations(attachment_id);
create index case_preparations_campaign on public.case_evidence_preparations(campaign_id);
alter table public.case_evidence_preparations enable row level security;
revoke all on public.case_evidence_preparations from public,anon,authenticated;
grant select,insert,update,delete on public.case_evidence_preparations to authenticated;
create policy case_preparations_manage on public.case_evidence_preparations for all to authenticated
 using(cris_private.can_access_campaign(campaign_id,true)) with check(cris_private.can_access_campaign(campaign_id,true));
create policy case_preparations_read on public.case_evidence_preparations for select to authenticated using (
 exists(select 1 from public.case_evidence_pins p where p.board_id=case_evidence_preparations.board_id and p.attachment_id=case_evidence_preparations.attachment_id and p.campaign_id=case_evidence_preparations.campaign_id and p.user_id=(select auth.uid()))
);
create policy case_preparation_images on storage.objects for select to authenticated using (
 storage.objects.bucket_id='cris-images' and exists (
  select 1 from public.case_evidence_preparations prep
  join public.case_evidence_pins pin on pin.board_id=prep.board_id and pin.attachment_id=prep.attachment_id and pin.campaign_id=prep.campaign_id
  join public.investigation_board_publications board on board.id=prep.board_id and board.campaign_id=prep.campaign_id
  join public.case_attachments attachment on attachment.id=prep.attachment_id and attachment.campaign_id=prep.campaign_id
  join public.case_documents document on document.id=attachment.document_id and document.campaign_id=attachment.campaign_id
  join public.case_investigations investigation on investigation.id=document.investigation_id and investigation.campaign_id=document.campaign_id,
  lateral jsonb_each(coalesce(prep.payload->'imgs','{}')) asset
  where pin.user_id=(select auth.uid())
  and cris_private.can_access_campaign(prep.campaign_id)
  and attachment.published and document.published and investigation.published
  and split_part(storage.objects.name,'/',1)=prep.campaign_id::text
  and asset.value->>'bucket'='cris-images' and asset.value->>'path'=storage.objects.name
 )
);
create or replace function cris_private.withdraw_removed_preparations()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.case_evidence_preparations p where p.board_id=new.id and p.campaign_id=new.campaign_id
 and exists(select 1 from unnest(p.source_ids) source_id where not exists(select 1 from jsonb_array_elements(coalesce(new.payload->'state'->'items','[]')) item where item->>'id'=source_id));
 return new;
end $$;
revoke all on function cris_private.withdraw_removed_preparations() from public,anon,authenticated;
create trigger withdraw_removed_preparations after update of payload on public.investigation_boards for each row execute function cris_private.withdraw_removed_preparations();
