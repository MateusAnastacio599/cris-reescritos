create table public.director_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'),
 is_operator boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.director_accounts enable row level security;
revoke all on public.director_accounts from anon,authenticated;
grant select on public.director_accounts to authenticated;
grant all on public.director_accounts to service_role;
create function cris_private.is_director_operator() returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.director_accounts a where a.user_id=(select auth.uid()) and a.is_operator);
$$;
revoke all on function cris_private.is_director_operator() from public,anon;
grant execute on function cris_private.is_director_operator() to authenticated;
create policy director_account_read on public.director_accounts for select to authenticated using(user_id=(select auth.uid()) or (select cris_private.is_director_operator()));
-- Adopt the already-confirmed, sole account without changing its password or UUID.
do $$ begin
 if (select count(*) from auth.users)<>1 then raise exception 'Expected exactly one existing account for adoption'; end if;
 insert into public.director_accounts(user_id,username,is_operator)
 select id,'mateus',true from auth.users where email_confirmed_at is not null;
 if not found then raise exception 'Existing account must be confirmed'; end if;
end $$;
create table cris_private.login_limits (
 bucket text primary key, attempts integer not null, expires_at timestamptz not null
);
alter table cris_private.login_limits enable row level security;
revoke all on cris_private.login_limits from public,anon,authenticated;
grant usage on schema cris_private to service_role;
grant all on cris_private.login_limits to service_role;
create function public.director_consume_login(p_ip text,p_user text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare ip_count integer; user_count integer; window_id text:=floor(extract(epoch from now())/60)::text;
begin
 if length(p_ip)<>64 or length(p_user)<>64 then return false; end if;
 delete from cris_private.login_limits where expires_at<now();
 insert into cris_private.login_limits as t(bucket,attempts,expires_at) values('ip:'||p_ip||':'||window_id,1,now()+interval '2 minutes')
 on conflict(bucket) do update set attempts=t.attempts+1 returning attempts into ip_count;
 insert into cris_private.login_limits as t(bucket,attempts,expires_at) values('user:'||p_user||':'||window_id,1,now()+interval '2 minutes')
 on conflict(bucket) do update set attempts=t.attempts+1 returning attempts into user_count;
 return ip_count<=30 and user_count<=10;
end $$;
revoke all on function public.director_consume_login(text,text) from public,anon,authenticated;
grant execute on function public.director_consume_login(text,text) to service_role;
