begin;
select set_config('cris_test.owner',gen_random_uuid()::text,true),set_config('cris_test.player',gen_random_uuid()::text,true),set_config('cris_test.gm',gen_random_uuid()::text,true),set_config('cris_test.outsider',gen_random_uuid()::text,true),set_config('cris_test.a',gen_random_uuid()::text,true),set_config('cris_test.b',gen_random_uuid()::text,true),set_config('cris_test.page',gen_random_uuid()::text,true);
insert into auth.users(id) select current_setting('cris_test.'||x)::uuid from unnest(array['owner','player','gm','outsider']) x;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('cris_test.owner'),true);
insert into public.campaigns(id,owner_id,title) values(current_setting('cris_test.a')::uuid,auth.uid(),'CRIS permission test A'),(current_setting('cris_test.b')::uuid,auth.uid(),'CRIS permission test B');
insert into public.campaign_members(campaign_id,user_id,role) values(current_setting('cris_test.a')::uuid,current_setting('cris_test.player')::uuid,'player'),(current_setting('cris_test.a')::uuid,current_setting('cris_test.gm')::uuid,'gm');
insert into public.director_pages(id,campaign_id,title,blocks) values(current_setting('cris_test.page')::uuid,current_setting('cris_test.a')::uuid,'GM secret','[{"type":"paragraph","text":"preserve me"}]');
insert into public.director_cues(campaign_id,title,actions) values(current_setting('cris_test.a')::uuid,'Fade','[{"type":"music","loop":true,"fadeIn":3}]');
insert into public.director_backups(campaign_id,migration_key,schema_version,snapshot) values(current_setting('cris_test.a')::uuid,'test-local-v3',3,'{"test":true}');
do $$ begin
 if (select count(*) from public.director_pages)<>1 then raise exception 'Owner cannot read page'; end if;
 update public.director_pages set title='GM secret updated' where id=current_setting('cris_test.page')::uuid;
 if not found then raise exception 'Owner cannot update'; end if;
 begin
 update public.campaigns set owner_id=current_setting('cris_test.player')::uuid where id=current_setting('cris_test.a')::uuid;
 raise exception 'Owner reassignment allowed'; exception when insufficient_privilege then null; end;
 begin
 insert into public.director_scenes(campaign_id,title,page_id) values(current_setting('cris_test.b')::uuid,'Wrong campaign',current_setting('cris_test.page')::uuid);
 raise exception 'Cross campaign page reference allowed'; exception when foreign_key_violation then null; end;
 begin
 insert into public.media_assets(campaign_id,title,kind,source_type,object_path) values(current_setting('cris_test.a')::uuid,'Invalid','sfx','file',current_setting('cris_test.a')||'/file.mp3');
 raise exception 'Null bucket allowed'; exception when check_violation then null; end;
 insert into public.media_assets(campaign_id,title,kind,source_type,bucket_id,object_path) values(current_setting('cris_test.a')::uuid,'Valid audio','sfx','file','cris-audio',current_setting('cris_test.a')||'/file.mp3');
 begin
 insert into public.media_assets(campaign_id,title,kind,source_type,bucket_id,object_path) values(current_setting('cris_test.a')::uuid,'Wrong path','sfx','file','cris-audio',current_setting('cris_test.b')||'/wrong.mp3');
 raise exception 'Cross campaign storage path allowed'; exception when check_violation then null; end;
 begin
 update public.director_backups set snapshot='{}'; raise exception 'Backup mutation allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cris_test.player'),true);
do $$ begin
 if (select count(*) from public.campaigns)<>1 then raise exception 'Player campaign visibility incorrect'; end if;
 if (select count(*) from public.campaign_members)<>1 then raise exception 'Player sees other memberships'; end if;
 if exists(select 1 from public.director_pages) or exists(select 1 from public.director_cues) or exists(select 1 from public.media_assets) or exists(select 1 from public.director_backups) then raise exception 'GM secrets leaked to player'; end if;
 update public.director_pages set title='Hacked'; if found then raise exception 'Player updated GM page'; end if;
 update public.campaign_members set role='gm' where user_id=auth.uid(); if found then raise exception 'Player self promotion'; end if;
 begin
 insert into public.director_pages(campaign_id,title) values(current_setting('cris_test.a')::uuid,'Unauthorized'); raise exception 'Player created GM page'; exception when insufficient_privilege then null; end;
 if cris_private.can_access_campaign(current_setting('cris_test.a')::uuid,true) then raise exception 'Player received GM file access'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cris_test.gm'),true);
do $$ begin
 if (select count(*) from public.director_pages)<>1 then raise exception 'Co-GM cannot read'; end if;
 update public.director_pages set title='Co-GM updated'; if not found then raise exception 'Co-GM cannot edit'; end if;
 update public.campaign_members set role='gm' where user_id=current_setting('cris_test.player')::uuid; if found then raise exception 'Co-GM escalated member'; end if;
 if not cris_private.can_access_campaign(current_setting('cris_test.a')::uuid,true) then raise exception 'Co-GM storage access failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cris_test.outsider'),true);
do $$ begin
 if exists(select 1 from public.campaigns) or exists(select 1 from public.campaign_members) or exists(select 1 from public.director_pages) or exists(select 1 from public.director_backups) then raise exception 'Outsider data leak'; end if;
 begin
 insert into public.campaign_members(campaign_id,user_id,role) values(current_setting('cris_test.a')::uuid,auth.uid(),'gm'); raise exception 'Outsider joined campaign'; exception when insufficient_privilege then null; end;
 if cris_private.can_access_campaign(current_setting('cris_test.a')::uuid,true) then raise exception 'Outsider GM file access'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.campaigns; raise exception 'Anonymous access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'RLS missing'; end if;
 if exists(select 1 from storage.buckets where id in ('cris-audio','cris-documents','cris-images') and public) then raise exception 'Bucket public'; end if;
 if (select count(*) from pg_policies where schemaname='storage' and policyname like 'cris_files_%')<>4 then raise exception 'Storage policies missing'; end if;
end $$;
rollback;
select 'PASS: owner, co-GM, player, outsider, anonymous, cross-campaign constraints, immutable backup, private buckets; all test fixtures rolled back' as result;
