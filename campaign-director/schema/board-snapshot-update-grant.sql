-- Existing GM-only RLS continues to control access. No DELETE or campaign reassignment privilege is needed.
grant update (payload, revision, updated_at) on public.board_snapshots to authenticated;
