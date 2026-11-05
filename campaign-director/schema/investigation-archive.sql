-- Case archive. Published board versions and live sessions keep their own tables.
create table public.case_investigations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '',
  position integer not null default 0,
  published boolean not null default false,
  board_id uuid,
  unique (id, campaign_id),
  foreign key (board_id, campaign_id) references public.investigation_boards(id, campaign_id) on delete set null (board_id)
);
create table public.case_documents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  investigation_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 100000),
  position integer not null default 0,
  published boolean not null default false,
  unique (id, campaign_id),
  foreign key (investigation_id, campaign_id) references public.case_investigations(id, campaign_id) on delete cascade
);
create table public.case_attachments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  document_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 100000),
  object_path text unique,
  mime text,
  position integer not null default 0,
  published boolean not null default false,
  unique (id, campaign_id),
  check (object_path is null or object_path = campaign_id::text || '/' || id::text),
  foreign key (document_id, campaign_id) references public.case_documents(id, campaign_id) on delete cascade
);
create table public.case_evidence_pins (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  board_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid,
  attachment_id uuid,
  layout jsonb not null default '{}' check (jsonb_typeof(layout) = 'object' and octet_length(layout::text) <= 64000),
  check (num_nonnulls(document_id, attachment_id) = 1),
  unique (board_id, user_id, document_id),
  unique (board_id, user_id, attachment_id),
  foreign key (board_id, campaign_id) references public.investigation_boards(id, campaign_id) on delete cascade,
  foreign key (document_id, campaign_id) references public.case_documents(id, campaign_id) on delete cascade,
  foreign key (attachment_id, campaign_id) references public.case_attachments(id, campaign_id) on delete cascade
);
create index case_investigations_campaign_order on public.case_investigations(campaign_id, position);
create index case_documents_investigation_order on public.case_documents(investigation_id, position);
create index case_attachments_document_order on public.case_attachments(document_id, position);
create index case_pins_document on public.case_evidence_pins(document_id) where document_id is not null;
create index case_pins_attachment on public.case_evidence_pins(attachment_id) where attachment_id is not null;

alter table public.case_investigations enable row level security;
alter table public.case_documents enable row level security;
alter table public.case_attachments enable row level security;
alter table public.case_evidence_pins enable row level security;

revoke all on public.case_investigations, public.case_documents, public.case_attachments, public.case_evidence_pins from anon, authenticated;
grant select, insert, delete on public.case_investigations, public.case_documents, public.case_attachments, public.case_evidence_pins to authenticated;
grant update(title,description,position,published,board_id) on public.case_investigations to authenticated;
grant update(title,body,position,published,investigation_id) on public.case_documents to authenticated;
grant update(title,body,position,published,object_path,mime) on public.case_attachments to authenticated;
grant update(layout) on public.case_evidence_pins to authenticated;

create policy case_investigations_read on public.case_investigations for select to authenticated using (
  cris_private.can_access_campaign(campaign_id, true)
  or (published and cris_private.can_access_campaign(campaign_id))
);
create policy case_documents_read on public.case_documents for select to authenticated using (
  cris_private.can_access_campaign(campaign_id, true)
  or (case_documents.published and cris_private.can_access_campaign(case_documents.campaign_id)
    and exists (select 1 from public.case_investigations i
      where i.id = case_documents.investigation_id
      and i.campaign_id = case_documents.campaign_id and i.published))
);
create policy case_attachments_read on public.case_attachments for select to authenticated using (
  cris_private.can_access_campaign(campaign_id, true)
  or (case_attachments.published and cris_private.can_access_campaign(case_attachments.campaign_id)
    and exists (select 1 from public.case_documents d
      join public.case_investigations i on i.id = d.investigation_id and i.campaign_id = d.campaign_id
      where d.id = case_attachments.document_id and d.campaign_id = case_attachments.campaign_id
      and d.published and i.published))
);
create policy case_investigations_manage on public.case_investigations for all to authenticated
  using (cris_private.can_access_campaign(campaign_id, true)) with check (cris_private.can_access_campaign(campaign_id, true));
create policy case_documents_manage on public.case_documents for all to authenticated
  using (cris_private.can_access_campaign(campaign_id, true)) with check (cris_private.can_access_campaign(campaign_id, true));
create policy case_attachments_manage on public.case_attachments for all to authenticated
  using (cris_private.can_access_campaign(campaign_id, true)) with check (cris_private.can_access_campaign(campaign_id, true));

-- Selecting an existing pin rechecks both the source and the board publication.
create policy case_pins_read on public.case_evidence_pins for select to authenticated using (
  user_id = (select auth.uid())
  and exists (select 1 from public.investigation_board_publications b where b.id = case_evidence_pins.board_id and b.campaign_id = case_evidence_pins.campaign_id)
  and (exists (select 1 from public.case_documents d where d.id = case_evidence_pins.document_id and d.campaign_id = case_evidence_pins.campaign_id)
    or exists (select 1 from public.case_attachments a where a.id = case_evidence_pins.attachment_id and a.campaign_id = case_evidence_pins.campaign_id))
);
create policy case_pins_create on public.case_evidence_pins for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.investigation_board_publications b where b.id = case_evidence_pins.board_id and b.campaign_id = case_evidence_pins.campaign_id)
  and (exists (select 1 from public.case_documents d where d.id = case_evidence_pins.document_id and d.campaign_id = case_evidence_pins.campaign_id)
    or exists (select 1 from public.case_attachments a where a.id = case_evidence_pins.attachment_id and a.campaign_id = case_evidence_pins.campaign_id))
);
create policy case_pins_edit on public.case_evidence_pins for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy case_pins_remove on public.case_evidence_pins for delete to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cris-case-evidence', 'cris-case-evidence', false, 26214400,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf','audio/mpeg','audio/ogg','audio/wav','text/plain','application/octet-stream']);
create policy case_files_read on storage.objects for select to authenticated using (
  storage.objects.bucket_id = 'cris-case-evidence' and exists (
    select 1 from public.case_attachments a
    join public.case_documents d on d.id = a.document_id and d.campaign_id = a.campaign_id
    join public.case_investigations i on i.id = d.investigation_id and i.campaign_id = d.campaign_id
    where a.object_path = storage.objects.name
      and (cris_private.can_access_campaign(a.campaign_id, true)
        or (a.published and d.published and i.published and cris_private.can_access_campaign(a.campaign_id)))
  )
);
create policy case_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'cris-case-evidence' and exists (select 1 from public.case_attachments a
    where a.object_path = storage.objects.name and cris_private.can_access_campaign(a.campaign_id, true))
);
create policy case_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'cris-case-evidence' and exists (select 1 from public.case_attachments a
    where a.object_path = storage.objects.name and cris_private.can_access_campaign(a.campaign_id, true))
);
