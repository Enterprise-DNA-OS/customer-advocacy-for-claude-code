create table advocates (
 id uuid primary key default gen_random_uuid(), external_id text unique,
 name text not null check (length(trim(name)) > 0), email text not null,
 company text not null, industry text not null default '', product text not null default '',
 region text not null default '', owner text not null default 'Unassigned',
 status text not null default 'paused' check (status in ('active','paused','archived')),
 capacity integer not null default 2 check (capacity between 1 and 100),
 cooldown_days integer not null default 14 check (cooldown_days between 0 and 365),
 verified_on date, verification_evidence text, retention_review date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index advocates_email on advocates(lower(email));
create table permissions (
 id uuid primary key default gen_random_uuid(), advocate_id uuid not null references advocates(id),
 kind text not null check (kind in ('reference','story','speaker')),
 decision text not null check (decision in ('granted','revoked')),
 valid_until date not null, evidence text not null check (length(trim(evidence)) > 0),
 restrictions text not null default '', actor text not null check (length(trim(actor)) > 0),
 sequence bigint generated always as identity unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table requests (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 prospect text not null, industry text not null, product text not null, region text not null default '',
 kind text not null check (kind in ('reference','story','speaker')),
 due_date date not null, owner text not null, brief text not null,
 status text not null default 'open' check (status in ('open','fulfilled','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table assignments (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references requests(id),
 advocate_id uuid not null references advocates(id), permission_id uuid not null references permissions(id),
 status text not null default 'proposed' check (status in ('proposed','accepted','completed','declined','cancelled')),
 decision_evidence text not null, completed_on date, outcome text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((status='completed') = (completed_on is not null))
);
create unique index one_live_assignment on assignments(request_id) where status in ('proposed','accepted','completed');
create index advocate_workload on assignments(advocate_id,status,completed_on);
create table stories (
 id uuid primary key default gen_random_uuid(), advocate_id uuid not null references advocates(id),
 title text not null, body text not null, evidence text not null,
 status text not null default 'draft' check (status in ('draft','approved','withdrawn')),
 approved_by text, approval_evidence text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (status <> 'approved' or (length(trim(approved_by))>0 and length(trim(approval_evidence))>0))
);
create table import_batches (
 id uuid primary key default gen_random_uuid(), sha256 text not null unique, filename text not null,
 original_csv text not null, row_count integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table activities (
 id uuid primary key default gen_random_uuid(), advocate_id uuid not null references advocates(id),
 external_id text unique, event_date date not null, event_type text not null,
 related_object text not null default '', notes text not null default '',
 points numeric not null default 0, raw_source jsonb, batch_id uuid references import_batches(id),
 actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table audit_events (
 id uuid primary key default gen_random_uuid(), action text not null, record_id uuid,
 actor text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['advocates','permissions','requests','assignments','stories','import_batches','activities','audit_events'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated_at()', t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop;
end $$;

create view current_permissions as
 select distinct on (advocate_id,kind) * from permissions order by advocate_id,kind,sequence desc;

create view advocate_load as
 select a.id,a.name,a.company,a.industry,a.product,a.region,a.owner,a.status,a.capacity,a.cooldown_days,
 a.verified_on,a.retention_review,
 (select count(*) from assignments x where x.advocate_id=a.id and
  (x.status in ('proposed','accepted') or (x.status='completed' and x.completed_on>current_date-30))) as load,
 (select max(completed_on) from assignments x where x.advocate_id=a.id and x.status='completed') as last_completed,
 (select max(event_date) from activities x where x.advocate_id=a.id) as last_activity
 from advocates a;

create view request_queue as
 select r.id,r.code,r.prospect,r.kind,r.industry,r.product,r.region,r.due_date,r.owner,r.status,
 a.name as advocate,x.status as assignment_status,x.id as assignment_id
 from requests r left join assignments x on x.request_id=r.id and x.status in ('proposed','accepted','completed')
 left join advocates a on a.id=x.advocate_id;

create view story_library as
 select s.id,s.advocate_id,s.title,a.name,a.company,s.body,s.status,p.valid_until,p.restrictions,
 (s.status='approved' and a.status='active' and a.verified_on>=current_date-90
 and a.retention_review>=current_date and p.decision='granted' and p.valid_until>=current_date) is true as usable
 from stories s join advocates a on a.id=s.advocate_id
 left join current_permissions p on p.advocate_id=a.id and p.kind='story';

create view compliance_findings as
 select a.id as record_id,a.name as record,'PROFILE_REVIEW' as rule,'Check accuracy before use; 90 days is local policy' as finding,a.owner
 from advocates a where a.status<>'archived' and (verified_on is null or verified_on<current_date-90 or nullif(trim(verification_evidence),'') is null)
 union all
 select id,name,'RETENTION_REVIEW','Review purpose and retention; no automatic deletion',owner
 from advocates where retention_review is null or retention_review<current_date
 union all
 select a.id,a.name,'PERMISSION_REVIEW',p.kind || ': ' || p.decision || ', expires ' || p.valid_until::text,a.owner
 from current_permissions p join advocates a on a.id=p.advocate_id
 where a.status<>'archived' and (p.decision='revoked' or p.valid_until<current_date)
 union all
 select s.id,s.title,'STORY_WITHHELD','Approved story is not currently cleared for use',a.owner
 from story_library s join advocates a on a.id=s.advocate_id where s.status='approved' and not s.usable
 union all
 select x.id,r.code,'ASSIGNMENT_RECHECK','Open assignment no longer meets current permission or profile rules',r.owner
 from assignments x join requests r on r.id=x.request_id join advocates a on a.id=x.advocate_id
 left join current_permissions p on p.advocate_id=a.id and p.kind=r.kind
 where x.status in ('proposed','accepted') and (a.status<>'active' or a.verified_on is null or a.verified_on<current_date-90
 or a.retention_review is null or a.retention_review<greatest(r.due_date,current_date)
 or p.id is null or p.decision<>'granted' or p.valid_until<greatest(r.due_date,current_date));

create view attention as
 select r.id as record_id,r.code as record,'OVERDUE_REQUEST' as reason,r.owner from requests r
 where r.status='open' and r.due_date<current_date
 union all
 select id,name,'CAPACITY_FULL',owner from advocate_load where status='active' and load>=capacity
 union all
 select id,name,'QUIET_ADVOCATE',owner from advocate_load
 where status='active' and (last_activity is null or last_activity<current_date-30)
 union all
 select record_id,record,rule,owner from compliance_findings;

revoke all on current_permissions,advocate_load,request_queue,story_library,compliance_findings,attention from public;
