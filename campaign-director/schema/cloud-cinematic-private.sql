-- Review only. No bucket, rows, objects or original files are removed.
-- Existing cris-images stays private; metadata uses director_workspaces.media.
-- Restrictive guard ANDs with existing GM/released-board policies, so a player
-- cannot read this prefix through a board publication containing its path.
begin;
create policy director_cinematic_private_guard on storage.objects
 as restrictive for all to authenticated
 using (bucket_id <> 'cris-images' or split_part(name,'/',2) <> 'director-private'
  or exists(select 1 from public.director_workspaces w
    where w.owner_id=(select auth.uid()) and w.campaign_id::text=split_part(name,'/',1)
      and w.owner_id::text=split_part(name,'/',3)))
 with check (bucket_id <> 'cris-images' or split_part(name,'/',2) <> 'director-private'
  or exists(select 1 from public.director_workspaces w
    where w.owner_id=(select auth.uid()) and w.campaign_id::text=split_part(name,'/',1)
      and w.owner_id::text=split_part(name,'/',3)));
-- Immutable hash paths: insert a new hash rather than replacing bytes in place.
create policy director_cinematic_immutable on storage.objects
 as restrictive for update to authenticated
 using (bucket_id <> 'cris-images' or split_part(name,'/',2) <> 'director-private')
 with check (bucket_id <> 'cris-images' or split_part(name,'/',2) <> 'director-private');
commit;
