-- Saving a draft can withdraw already-published material, never reveal new items.
create or replace function cris_private.withdraw_archived_board_items()
returns trigger language plpgsql security definer set search_path='' as $$
declare released jsonb; next_payload jsonb; visible_ids jsonb; keep_items jsonb; keep_pins jsonb; keep_strings jsonb; keep_imgs jsonb;
begin
 select payload into released from public.investigation_board_publications where id=new.id and campaign_id=new.campaign_id for update;
 if released is null then return new; end if;
 with recursive items as (select value item from jsonb_array_elements(coalesce(new.payload->'state'->'items','[]'))),
 blocked(id) as (
  select item->>'id' from items where item->>'gm'='true' or item->>'hand'='true' or item->>'kind'='ativador'
  union
  select i.item->>'id' from items i join blocked b on b.id in (i.item->>'parent',i.item->>'in',i.item->>'box',i.item->>'inside')
 ) select coalesce(jsonb_agg(item->>'id'),'[]') into visible_ids from items where not exists(select 1 from blocked where id=item->>'id');
 select coalesce(jsonb_agg(value),'[]') into keep_items from jsonb_array_elements(coalesce(released->'state'->'items','[]')) where visible_ids ? (value->>'id');
 select coalesce(jsonb_agg(value),'[]') into keep_pins from jsonb_array_elements(coalesce(released->'state'->'pins','[]')) p
 where (not (value ? 'item') or value->>'item' is null or value->>'item'=''
    or exists(select 1 from jsonb_array_elements(keep_items) i where i->>'id'=p.value->>'item'))
 and exists(select 1 from jsonb_array_elements(coalesce(new.payload->'state'->'pins','[]')) n where n->>'id'=p.value->>'id');
 select coalesce(jsonb_agg(value),'[]') into keep_strings from jsonb_array_elements(coalesce(released->'state'->'strings','[]')) s
 where exists(select 1 from jsonb_array_elements(keep_pins) p where p->>'id'=s.value->>'a')
 and exists(select 1 from jsonb_array_elements(keep_pins) p where p->>'id'=s.value->>'b')
 and exists(select 1 from jsonb_array_elements(coalesce(new.payload->'state'->'strings','[]')) n where n->>'id'=s.value->>'id');
 select coalesce(jsonb_object_agg(key,value),'{}') into keep_imgs from jsonb_each(coalesce(released->'imgs','{}')) a
 where exists(select 1 from jsonb_array_elements(keep_items) i where a.key in (i->>'imgId',i->>'audioId'));
 next_payload=jsonb_set(jsonb_set(jsonb_set(jsonb_set(released,'{state,items}',keep_items),'{state,pins}',keep_pins),'{state,strings}',keep_strings),'{imgs}',keep_imgs);
 if next_payload is distinct from released then
  update public.investigation_board_publications set payload=next_payload,revision=greatest(revision+1,new.revision),updated_at=now() where id=new.id and campaign_id=new.campaign_id;
 end if;
 return new;
end $$;
revoke all on function cris_private.withdraw_archived_board_items() from public,anon,authenticated;
create trigger withdraw_archived_board_items after update of payload on public.investigation_boards for each row execute function cris_private.withdraw_archived_board_items();
-- Repair only stale removals in existing publications; this cannot publish additions.
update public.investigation_boards set payload=payload;
