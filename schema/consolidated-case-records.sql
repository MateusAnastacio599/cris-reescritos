-- Optional structured records. The original document body remains intact.
alter table public.case_documents add column records jsonb, add column records_revision integer not null default 0;
alter table public.case_attachments add column record_id uuid;
grant update (records) on public.case_documents to authenticated;
grant update (record_id) on public.case_attachments to authenticated;

create index case_attachments_record_lookup on public.case_attachments(document_id, record_id)
  where record_id is not null;

create function cris_private.check_case_records() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.records is not null then
    if jsonb_typeof(new.records) <> 'object'
      or coalesce(jsonb_typeof(new.records->'entries'), '') <> 'array' then
      raise exception 'Formato de registros inválido.' using errcode = '23514';
    end if;
    if jsonb_array_length(new.records->'entries') not between 1 and 50
      or octet_length(new.records::text) > 450000
      or exists (
        select 1 from jsonb_array_elements(new.records->'entries') entry
        where coalesce(entry->>'id', '') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
          or coalesce(btrim(entry->>'name'), '') = ''
      ) or exists (
        select 1 from jsonb_array_elements(new.records->'entries') entry
        group by entry->>'id' having count(*) > 1
      ) then
      raise exception 'Os registros precisam de nome e identificador único.' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from public.case_attachments a
    where a.document_id = new.id and a.record_id is not null
      and not coalesce((new.records->'entries') @> jsonb_build_array(jsonb_build_object('id', a.record_id)), false)
  ) then
    raise exception 'Mova os anexos vinculados antes de excluir o registro.' using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' and (new.records is distinct from old.records or new.body is distinct from old.body) then
    new.records_revision := old.records_revision + 1;
  end if;
  return new;
end;
$$;

create function cris_private.check_case_attachment_record() returns trigger
language plpgsql set search_path = '' as $$
declare
  valid boolean;
begin
  if new.record_id is null then return new; end if;
  select (d.records->'entries') @> jsonb_build_array(jsonb_build_object('id', new.record_id)) into valid
    from public.case_documents d
    where d.id = new.document_id and d.campaign_id = new.campaign_id
    for share;
  if valid is distinct from true then
    raise exception 'O registro selecionado não pertence a este documento.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger check_case_records before insert or update of records, body on public.case_documents
  for each row execute function cris_private.check_case_records();
create trigger check_case_attachment_record before insert or update of record_id on public.case_attachments
  for each row execute function cris_private.check_case_attachment_record();
