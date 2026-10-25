-- Run in a Supabase PostgreSQL project. All money is integer LKR cents.
begin;
create table public.workspaces(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),name text not null default 'OSKA DUE');
create table public.people(workspace_id uuid not null references public.workspaces(id),id text not null,name text not null,color text not null,primary key(workspace_id,id));
create table public.plans(workspace_id uuid not null references public.workspaces(id),id text not null,merchant text not null,primary key(workspace_id,id));
create table public.installments(workspace_id uuid not null,id text not null,plan_id text not null,due_date date not null,number integer not null check(number between 1 and 6),koko_paid boolean not null default false,primary key(workspace_id,id),foreign key(workspace_id,plan_id) references public.plans(workspace_id,id));
create table public.allocations(workspace_id uuid not null,id text not null,installment_id text not null,person_id text not null,cents bigint not null check(cents>0),primary key(workspace_id,id),foreign key(workspace_id,installment_id) references public.installments(workspace_id,id),foreign key(workspace_id,person_id) references public.people(workspace_id,id));
create table public.settlements(workspace_id uuid not null,id uuid not null default gen_random_uuid(),allocation_id text not null,cents bigint not null check(cents<>0),recorded_at timestamptz not null default now(),reverses uuid,primary key(workspace_id,id),foreign key(workspace_id,allocation_id) references public.allocations(workspace_id,id),foreign key(workspace_id,reverses) references public.settlements(workspace_id,id),unique(workspace_id,reverses));
create table public.imports(workspace_id uuid not null references public.workspaces(id),sha256 text not null,reviewed_at timestamptz not null default now(),primary key(workspace_id,sha256));
create function public.owns_workspace(w uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.workspaces where id=w and owner_id=auth.uid())$$;
alter table public.workspaces enable row level security;
create policy owner_workspace on public.workspaces for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
do $$declare t text;begin foreach t in array array['people','plans','installments','allocations','imports'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy owner_access on public.%I for all using(public.owns_workspace(workspace_id)) with check(public.owns_workspace(workspace_id))',t);end loop;end$$;
alter table public.settlements enable row level security;
create policy read_settlements on public.settlements for select using(public.owns_workspace(workspace_id));
create policy insert_settlements on public.settlements for insert with check(public.owns_workspace(workspace_id));
-- Ledger is append-only. Row locks serialize all changes for a single allocation.
create function public.guard_settlement() returns trigger language plpgsql set search_path=public as $$
declare ceiling bigint;current_paid bigint;original public.settlements;begin
 if TG_OP <> 'INSERT' then raise exception 'Ledger entries are immutable; record a reversal';end if;
 select cents into strict ceiling from public.allocations where workspace_id=NEW.workspace_id and id=NEW.allocation_id for update;
 select coalesce(sum(cents),0) into current_paid from public.settlements where workspace_id=NEW.workspace_id and allocation_id=NEW.allocation_id;
 if NEW.cents<0 then
 select * into strict original from public.settlements where workspace_id=NEW.workspace_id and id=NEW.reverses;
 if original.cents<=0 or original.allocation_id<>NEW.allocation_id or original.cents<>-NEW.cents then raise exception 'Invalid reversal';end if;
 elsif NEW.reverses is not null then raise exception 'Positive reversal forbidden';end if;
 if current_paid+NEW.cents<0 or current_paid+NEW.cents>ceiling then raise exception 'Settlement exceeds allocation';end if;
 return NEW;end$$;
create trigger settlement_guard before insert or update or delete on public.settlements for each row execute function public.guard_settlement();
-- Prevent reallocating an already settled purchase or reducing allocated balances.
create function public.protect_allocation() returns trigger language plpgsql set search_path=public as $$begin
 if exists(select 1 from public.settlements where workspace_id=OLD.workspace_id and allocation_id=OLD.id) then raise exception 'Allocation has settlement history';end if;
 if TG_OP='DELETE' then return OLD;end if;return NEW;end$$;
create trigger allocation_guard before update or delete on public.allocations for each row execute function public.protect_allocation();
create index installments_due on public.installments(workspace_id,due_date);
create index settlements_allocation on public.settlements(workspace_id,allocation_id);
commit;
