-- Transactional role check. All synthetic rows are rolled back.
begin;
insert into auth.users(id) values
 ('da261070-2a24-4eae-8a51-000000000001'), ('da261070-2a24-4eae-8a51-000000000002'),
 ('da261070-2a24-4eae-8a51-000000000003');
insert into public.campaigns(id,owner_id,title) values
 ('da261070-2a24-4eae-8a51-000000000004','da261070-2a24-4eae-8a51-000000000001','Archive verification');
insert into public.campaign_members(campaign_id,user_id,role) values
 ('da261070-2a24-4eae-8a51-000000000004','da261070-2a24-4eae-8a51-000000000002','player'),
 ('da261070-2a24-4eae-8a51-000000000004','da261070-2a24-4eae-8a51-000000000003','player');
set local role authenticated;
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000001',true);
insert into public.investigation_boards(id,campaign_id,title) values
 ('da261070-2a24-4eae-8a51-000000000005','da261070-2a24-4eae-8a51-000000000004','Board');
insert into public.case_investigations(id,campaign_id,title,board_id) values
 ('da261070-2a24-4eae-8a51-000000000006','da261070-2a24-4eae-8a51-000000000004','Investigation','da261070-2a24-4eae-8a51-000000000005');
insert into public.case_documents(id,campaign_id,investigation_id,title,published) values
 ('da261070-2a24-4eae-8a51-000000000007','da261070-2a24-4eae-8a51-000000000004','da261070-2a24-4eae-8a51-000000000006','Document',true);
insert into public.case_attachments(id,campaign_id,document_id,title,published,object_path,mime) values
 ('da261070-2a24-4eae-8a51-000000000008','da261070-2a24-4eae-8a51-000000000004','da261070-2a24-4eae-8a51-000000000007','Photo',true,'da261070-2a24-4eae-8a51-000000000004/da261070-2a24-4eae-8a51-000000000008','image/png');
insert into storage.objects(bucket_id,name) values
 ('cris-case-evidence','da261070-2a24-4eae-8a51-000000000004/da261070-2a24-4eae-8a51-000000000008');
do $$ begin
 if not exists(select 1 from public.case_investigations where id='da261070-2a24-4eae-8a51-000000000006') then raise exception 'GM cannot see draft'; end if;
end $$;
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000002',true);
do $$ begin
 if exists(select 1 from public.case_documents where id='da261070-2a24-4eae-8a51-000000000007')
 or exists(select 1 from public.case_attachments where id='da261070-2a24-4eae-8a51-000000000008')
 or exists(select 1 from storage.objects where bucket_id='cris-case-evidence' and name='da261070-2a24-4eae-8a51-000000000004/da261070-2a24-4eae-8a51-000000000008')
 then raise exception 'Draft ancestor exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000001',true);
update public.case_investigations set published=true where id='da261070-2a24-4eae-8a51-000000000006';
insert into public.investigation_board_publications(id,campaign_id,title,payload,revision) values
 ('da261070-2a24-4eae-8a51-000000000005','da261070-2a24-4eae-8a51-000000000004','Board','{}',1);
insert into public.case_evidence_preparations(campaign_id,board_id,attachment_id,source_ids,payload) values
 ('da261070-2a24-4eae-8a51-000000000004','da261070-2a24-4eae-8a51-000000000005','da261070-2a24-4eae-8a51-000000000008',array['prepared'],
 '{"state":{"items":[{"id":"prepared","type":"img","imgId":"photo","gm":false,"backText":"Prepared reverse"}],"pins":[],"strings":[]},"imgs":{"photo":{"bucket":"cris-images","path":"da261070-2a24-4eae-8a51-000000000004/board/test"}}}');
insert into storage.objects(bucket_id,name) values('cris-images','da261070-2a24-4eae-8a51-000000000004/board/test');
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000002',true);
do $$ begin
 if exists(select 1 from public.case_evidence_preparations)
 or exists(select 1 from storage.objects where name='da261070-2a24-4eae-8a51-000000000004/board/test')
 then raise exception 'Preparation exposed before player pins the evidence';end if;
end $$;
do $$ begin
 if not exists(select 1 from storage.objects where bucket_id='cris-case-evidence' and name='da261070-2a24-4eae-8a51-000000000004/da261070-2a24-4eae-8a51-000000000008') then raise exception 'Published image unavailable'; end if;
end $$;
insert into public.case_evidence_pins(id,campaign_id,board_id,attachment_id) values
 ('da261070-2a24-4eae-8a51-000000000009','da261070-2a24-4eae-8a51-000000000004','da261070-2a24-4eae-8a51-000000000005','da261070-2a24-4eae-8a51-000000000008');
insert into public.case_evidence_progress_assets(pin_id,hash,payload) values
 ('da261070-2a24-4eae-8a51-000000000009',repeat('a',64),'data:image/png;base64,YQ==');
do $$ begin
 if not exists(select 1 from public.case_evidence_progress_assets where pin_id='da261070-2a24-4eae-8a51-000000000009') then raise exception 'Player cannot read own derived progress';end if;
end $$;
do $$ begin
 if not exists(select 1 from public.case_evidence_preparations where board_id='da261070-2a24-4eae-8a51-000000000005')
 or not exists(select 1 from storage.objects where name='da261070-2a24-4eae-8a51-000000000004/board/test')
 then raise exception 'Owner cannot retrieve elected preparation';end if;
end $$;
do $$ begin
 begin
 insert into public.case_evidence_pins(campaign_id,board_id,attachment_id) values
 ('da261070-2a24-4eae-8a51-000000000004','da261070-2a24-4eae-8a51-000000000005','da261070-2a24-4eae-8a51-000000000008');
 raise exception 'Duplicate allowed';
 exception when unique_violation then null; end;
 update public.case_evidence_pins set layout='{"pose":{"x":25,"scale":2}}' where id='da261070-2a24-4eae-8a51-000000000009';
 if not found then raise exception 'Owner cannot edit pin'; end if;
end $$;
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000003',true);
do $$ begin
 if exists(select 1 from public.case_evidence_pins where id='da261070-2a24-4eae-8a51-000000000009') then raise exception 'Another player can read the pin'; end if;
 if exists(select 1 from public.case_evidence_progress_assets where pin_id='da261070-2a24-4eae-8a51-000000000009') then raise exception 'Another player can read derived progress';end if;
 begin insert into public.case_evidence_progress_assets(pin_id,hash,payload) values('da261070-2a24-4eae-8a51-000000000009',repeat('b',64),'data:image/png;base64,Yg==');raise exception 'Another player can write derived progress';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.case_evidence_preparations where board_id='da261070-2a24-4eae-8a51-000000000005') or exists(select 1 from storage.objects where name='da261070-2a24-4eae-8a51-000000000004/board/test') then raise exception 'Preparation leaked to another player';end if;
 delete from public.case_evidence_pins where id='da261070-2a24-4eae-8a51-000000000009';
 if found then raise exception 'Another player can remove the pin'; end if;
end $$;
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000001',true);
update public.case_documents set published=false where id='da261070-2a24-4eae-8a51-000000000007';
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000002',true);
do $$ begin
 if exists(select 1 from public.case_evidence_pins where id='da261070-2a24-4eae-8a51-000000000009')
 or exists(select 1 from storage.objects where bucket_id='cris-case-evidence' and name='da261070-2a24-4eae-8a51-000000000004/da261070-2a24-4eae-8a51-000000000008')
 then raise exception 'Revoked document leaves evidence available'; end if;
 if exists(select 1 from public.case_evidence_progress_assets where pin_id='da261070-2a24-4eae-8a51-000000000009') then raise exception 'Revoked source leaves derived progress visible';end if;
end $$;
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000001',true);
update public.case_documents set published=true where id='da261070-2a24-4eae-8a51-000000000007';
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000002',true);
do $$ begin
 if (select layout->'pose'->>'x' from public.case_evidence_pins where id='da261070-2a24-4eae-8a51-000000000009') is distinct from '25'
 then raise exception 'Layout did not persist'; end if;
 delete from public.case_evidence_pins where id='da261070-2a24-4eae-8a51-000000000009';
 if not found then raise exception 'Owner cannot remove pin'; end if;
end $$;
select set_config('request.jwt.claim.sub','da261070-2a24-4eae-8a51-000000000001',true);
do $$ begin if exists(select 1 from public.case_evidence_progress_assets where pin_id='da261070-2a24-4eae-8a51-000000000009') then raise exception 'Deleting pin did not remove its progress';end if;end $$;
-- Saving removals withdraws only old items; a new visible item remains a draft.
update public.investigation_board_publications set payload='{"state":{"items":[{"id":"gone","imgId":"old"},{"id":"hide"},{"id":"child","parent":"hide"},{"id":"stay"}],"pins":[{"id":"p1","item":"gone"},{"id":"p2","item":"stay"}],"strings":[{"id":"s","a":"p1","b":"p2"}]},"imgs":{"old":{"bucket":"cris-images","path":"old"}}}' where id='da261070-2a24-4eae-8a51-000000000005';
update public.investigation_boards set payload='{"state":{"items":[{"id":"hide","gm":true},{"id":"child","parent":"hide"},{"id":"stay"},{"id":"new"}],"pins":[{"id":"p2","item":"stay"}],"strings":[]},"imgs":{}}',revision=revision+1 where id='da261070-2a24-4eae-8a51-000000000005';
do $$ declare p jsonb;begin
 select payload into p from public.investigation_board_publications where id='da261070-2a24-4eae-8a51-000000000005';
 if p->'state'->'items' <> '[{"id":"stay"}]'::jsonb or jsonb_array_length(p->'state'->'pins')<>1 or p->'state'->'strings'<>'[]' or p->'imgs'<>'{}' then raise exception 'Withdrawal kept stale clues or published new content';end if;
 if exists(select 1 from public.case_evidence_preparations where board_id='da261070-2a24-4eae-8a51-000000000005') then raise exception 'Removed master prop left stale preparation';end if;
end $$;
rollback;
select 'Private object progress, parent publication, cross-player isolation, cascade deletion and archive compatibility verified' as result;
