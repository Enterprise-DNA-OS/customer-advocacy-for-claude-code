#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';

const options = Object.fromEntries(['actor','advocate','request','assignment','story','name','email','company','industry','product','region','owner','status','capacity','cooldown','retention','evidence','kind','decision','until','restrictions','code','prospect','due','brief','title','body','action','outcome','type','notes','on','file','out','map','date-format'].map(k=>[k,{type:'string'}]));
Object.assign(options,{json:{type:'boolean'},'dry-run':{type:'boolean'},help:{type:'boolean'}});
export function argumentsOf(args){const {values,positionals}=parseArgs({args,options,allowPositionals:true});return {f:values,pos:positionals};}
const today=()=>new Date().toISOString().slice(0,10);
function need(f,k){const v=f[k]?.trim();if(!v)throw Error(`Required: --${k}`);return v;}
function choice(v,allowed,label){if(!allowed.includes(v))throw Error(`${label} must be ${allowed.join(', ')}`);return v;}
function integer(v,min,max,label){if(!/^\d+$/.test(String(v))||Number(v)<min||Number(v)>max)throw Error(`${label} must be an integer ${min}..${max}`);return Number(v);}
function date(v,label='date'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(`${label} must be a valid YYYY-MM-DD`);
 return v;
}
function email(v){v=v.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error('A valid email is required');return v;}
const domainTables=['advocates','permissions','requests','assignments','stories','activities','import_batches','audit_events'];
const lookupTables={advocates:'name',requests:'code',assignments:'id',stories:'title'};
export async function resolve(db,t,ref){
 if(!lookupTables[t]||!ref?.trim())throw Error(`A ${t} identifier is required`);
 const col=lookupTables[t];
 let rows=await db.query(`select * from ${t} where id::text=$1 or lower(${col}::text)=lower($1)`,[ref]);
 if(!rows.length) rows=await db.query(`select * from ${t} where starts_with(id::text,$1) or strpos(lower(${col}::text),lower($1))>0 order by ${col}`,[ref]);
 if(rows.length!==1){const e=Error(rows.length?`Ambiguous ${t}: ${rows.map(r=>`${r.id} ${r[col]}`).join('; ')}`:`No ${t} matches ${ref}`);e.candidates=rows.map(r=>({id:r.id,label:r[col]}));throw e;}
 return rows[0];
}
async function audit(db,actor,action,id,detail){await db.query('insert into audit_events(actor,action,record_id,detail) values($1,$2,$3,$4::jsonb)',[actor,action,id,JSON.stringify(detail)]);}
async function transaction(db,fn,rollback=false){await db.exec('BEGIN');try{const result=await fn();await db.exec(rollback?'ROLLBACK':'COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}

export async function candidates(db,request,exclude=null){
 const rows=await db.query(`select l.*,p.id as permission_id,p.decision,p.valid_until,p.restrictions,
 (select count(*) from assignments x where x.advocate_id=l.id and ($2::uuid is null or x.id<>$2) and
 (x.status in ('proposed','accepted') or (x.status='completed' and x.completed_on>current_date-30))) as current_load,
 current_date::text as as_of, greatest(current_date,$3::date)::text as needed_through
 from advocate_load l left join current_permissions p on p.advocate_id=l.id and p.kind=$1 order by l.name`,[request.kind,exclude,request.due_date]);
 return rows.map(a=>{
  const reasons=[];
  if(a.status!=='active')reasons.push('profile '+a.status);
  for(const k of ['industry','product','region'])if(request[k]&&a[k].toLowerCase()!==request[k].toLowerCase())reasons.push(k+' mismatch');
  if(!a.verified_on||a.verified_on<new Date(Date.parse(a.as_of)-90*86400000).toISOString().slice(0,10))reasons.push('profile review due');
  if(!a.retention_review||a.retention_review<a.needed_through)reasons.push('retention review due');
  if(a.decision!=='granted'||!a.valid_until||a.valid_until<a.needed_through)reasons.push('permission absent, revoked or expires too soon');
  if(Number(a.current_load)>=a.capacity)reasons.push('capacity full');
  if(a.last_completed && Date.parse(a.as_of)-Date.parse(a.last_completed)<a.cooldown_days*86400000)reasons.push('cooldown');
  return {id:a.id,name:a.name,company:a.company,owner:a.owner,eligible:!reasons.length,load:Number(a.current_load),capacity:a.capacity,permission_id:a.permission_id,valid_until:a.valid_until,restrictions:a.restrictions,reason:reasons.join('; ')||'Ready for a human decision'};
 });
}
async function eligible(db,r,a,exclude=null){const c=(await candidates(db,r,exclude)).find(x=>x.id===a.id);if(!c?.eligible)throw Error('Assignment blocked: '+(c?.reason||'no candidate'));return c;}

export const questions=[
 ['Which overdue requests still have no advocate?',"select code,prospect,owner,due_date from request_queue where status='open' and due_date<current_date and assignment_id is null order by due_date"],
 ['Which advocates have reached their agreed capacity?',"select name,company,load,capacity,owner from advocate_load where load>=capacity order by name"],
 ['Which open assignments lost valid permission or a current profile?',"select record,finding,owner from compliance_findings where rule='ASSIGNMENT_RECHECK'"],
 ['Which approved stories must be withheld today?',"select title,name,company,valid_until from story_library where status='approved' and not usable"],
 ['Which active advocates have gone quiet for a month?',"select name,company,last_activity,owner from advocate_load where status='active' and (last_activity is null or last_activity<current_date-30)"],
 ['Where do open requests lack any matching active profile?',"select r.code,r.industry,r.product,r.region,r.owner from requests r where r.status='open' and not exists(select 1 from advocates a where a.status='active' and lower(a.industry)=lower(r.industry) and lower(a.product)=lower(r.product) and (r.region='' or lower(a.region)=lower(r.region)))"],
 ['Which permissions expire in the next thirty days?',"select a.name,p.kind,p.valid_until,a.owner from current_permissions p join advocates a on a.id=p.advocate_id where p.decision='granted' and p.valid_until between current_date and current_date+30 order by p.valid_until"],
 ['Which imported advocates still await profile review?',"select name,company,external_id,owner from advocates where external_id is not null and verified_on is null"],
 ['Which owners carry the largest unfulfilled request queue?',"select owner,count(*) as open_requests,count(*) filter(where due_date<current_date) as overdue from requests where status='open' group by owner order by open_requests desc,owner"],
 ['Which companies supplied completed references in the last thirty days?',"select a.company,r.kind,count(*) as completed from assignments x join advocates a on a.id=x.advocate_id join requests r on r.id=x.request_id where x.status='completed' and x.completed_on>current_date-30 group by a.company,r.kind order by completed desc,a.company"]
];

const help=`Customer advocacy desk. Read docs/cli.md for examples.
Reads: advocates | advocate <name/id> | reference-desk | request <code/id>
       match-reference <request> | advocate-load | permission-review | story-library
       attention | compliance | dashboard | insights | activity
Writes (require --actor): add | review-advocate | permission | add-request | close-request
       propose | record-response | add-story | story-decision | log
Files: import influitive --file=<CSV> [--dry-run] --actor=<name>
       export --out=<new directory> | draft-reference <request> | draft-story <story>
       weekly-review [--out=<new file>]
All commands accept --json. Nothing sends or publishes.`;

export async function run(db,args){
 const {f,pos}=argumentsOf(args);const [cmd='help',ref]=pos;
 if(f.help||cmd==='help')return {help};
 const reads={
  advocates:'select id,name,company,industry,product,region,owner,status from advocates order by name',
  'reference-desk':"select code,prospect,kind,due_date,owner,status,advocate,assignment_status from request_queue order by due_date,code",
  'advocate-load':'select name,company,status,load,capacity,last_completed,last_activity from advocate_load order by name',
  'permission-review':'select a.name,p.kind,p.decision,p.valid_until,p.restrictions,p.evidence from current_permissions p join advocates a on a.id=p.advocate_id order by p.valid_until,a.name,p.kind',
  'story-library':'select id,title,name,company,status,usable,valid_until from story_library order by title',
  attention:'select record,reason,owner from attention order by reason,record',
  compliance:'select record,rule,finding,owner from compliance_findings order by rule,record',
  activity:'select action,actor,record_id,created_at from audit_events order by created_at desc,id',
  dashboard:`select (select count(*) from advocates) as advocates,(select count(*) from advocates where status='active') as active_advocates,
    (select count(*) from requests where status='open') as open_requests,(select count(*) from requests where status='open' and due_date<current_date) as overdue_requests,
    (select count(*) from story_library where usable) as usable_stories,(select count(*) from compliance_findings) as record_checks`
 };
 if(cmd in reads)return db.query(reads[cmd]);
 if(cmd==='advocate'){
  const a=await resolve(db,'advocates',ref);
  return {profile:a,permissions:await db.query('select * from permissions where advocate_id=$1 order by sequence',[a.id]),activities:await db.query('select * from activities where advocate_id=$1 order by event_date,id',[a.id]),assignments:await db.query('select x.*,r.code from assignments x join requests r on r.id=x.request_id where advocate_id=$1 order by x.created_at',[a.id])};
 }
 if(cmd==='request'){const r=await resolve(db,'requests',ref);return {request:r,assignments:await db.query('select x.*,a.name from assignments x join advocates a on a.id=x.advocate_id where request_id=$1 order by x.created_at',[r.id])};}
 if(cmd==='match-reference')return candidates(db,await resolve(db,'requests',ref));
 if(cmd==='insights'){const out=[];for(const [question,sql] of questions)out.push({question,rows:await db.query(sql)});return out;}
 if(cmd==='import'){if(ref!=='influitive')throw Error('Supported import: influitive');return importInfluitive(db,f);}
 if(cmd==='export')return exportAll(db,need(f,'out'));
 if(['weekly-review','draft-reference','draft-story'].includes(cmd))return draft(db,cmd,ref,f);

 const mutations=['add','review-advocate','permission','add-request','close-request','propose','record-response','add-story','story-decision','log'];
 if(!mutations.includes(cmd))throw Error(`Unknown command ${cmd}. Use help.`);
 const actor=need(f,'actor');
 if(f['dry-run'])throw Error('--dry-run is supported only for import');
 return transaction(db,async()=>{
  let result;
  if(cmd==='add'){
   const rows=await db.query(`insert into advocates(name,email,company,industry,product,region,owner,capacity,cooldown_days) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [need(f,'name'),email(need(f,'email')),need(f,'company'),need(f,'industry'),need(f,'product'),f.region||'',need(f,'owner'),integer(f.capacity||'2',1,100,'capacity'),integer(f.cooldown||'14',0,365,'cooldown')]);result=rows[0];
  }
  if(cmd==='review-advocate'){
   const a=await resolve(db,'advocates',need(f,'advocate'));const retention=date(need(f,'retention'),'retention');
   if(retention<today())throw Error('Retention review date must be today or later');
   const status=choice(need(f,'status'),['active','paused','archived'],'status');
   result=(await db.query(`update advocates set verified_on=current_date,verification_evidence=$2,retention_review=$3,status=$4,
    industry=$5,product=$6,region=$7,owner=$8,capacity=$9,cooldown_days=$10 where id=$1 returning *`,
    [a.id,need(f,'evidence'),retention,status,f.industry??a.industry,f.product??a.product,f.region??a.region,f.owner??a.owner,integer(f.capacity??String(a.capacity),1,100,'capacity'),integer(f.cooldown??String(a.cooldown_days),0,365,'cooldown')]))[0];
  }
  if(cmd==='permission'){
   const a=await resolve(db,'advocates',need(f,'advocate'));await db.query('select id from advocates where id=$1 for update',[a.id]);
   const decision=choice(need(f,'decision'),['granted','revoked'],'decision');const until=decision==='revoked'?today():date(need(f,'until'),'until');
   if(decision==='granted'&&until<today())throw Error('New permission must not already be expired');
   result=(await db.query('insert into permissions(advocate_id,kind,decision,valid_until,evidence,restrictions,actor) values($1,$2,$3,$4,$5,$6,$7) returning *',
    [a.id,choice(need(f,'kind'),['reference','story','speaker'],'kind'),decision,until,need(f,'evidence'),f.restrictions||'',actor]))[0];
  }
  if(cmd==='add-request'){
   result=(await db.query('insert into requests(code,prospect,industry,product,region,kind,due_date,owner,brief) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',
    [need(f,'code'),need(f,'prospect'),need(f,'industry'),need(f,'product'),f.region||'',choice(need(f,'kind'),['reference','story','speaker'],'kind'),date(need(f,'due'),'due'),need(f,'owner'),need(f,'brief')]))[0];
  }
  if(cmd==='close-request'){
   const r=await resolve(db,'requests',need(f,'request'));await db.query('select id from requests where id=$1 for update',[r.id]);
   const fresh=(await db.query('select * from requests where id=$1',[r.id]))[0];if(fresh.status!=='open')throw Error('Only open requests can be cancelled');
   const evidence=need(f,'evidence');await db.query("update assignments set status='cancelled',decision_evidence=$2 where request_id=$1 and status in ('proposed','accepted')",[r.id,evidence]);
   result=(await db.query("update requests set status='cancelled' where id=$1 returning *",[r.id]))[0];
  }
  if(cmd==='propose'){
   const r=await resolve(db,'requests',need(f,'request'));const a=await resolve(db,'advocates',need(f,'advocate'));
   await db.query('select id from requests where id=$1 for update',[r.id]);await db.query('select id from advocates where id=$1 for update',[a.id]);
   const fresh=(await db.query('select * from requests where id=$1',[r.id]))[0];if(fresh.status!=='open')throw Error('Request is not open');
   const c=await eligible(db,fresh,a);
   result=(await db.query('insert into assignments(request_id,advocate_id,permission_id,decision_evidence) values($1,$2,$3,$4) returning *',[r.id,a.id,c.permission_id,need(f,'evidence')]))[0];
  }
  if(cmd==='record-response'){
   const x=await resolve(db,'assignments',need(f,'assignment'));
   await db.query('select id from requests where id=$1 for update',[x.request_id]);await db.query('select id from advocates where id=$1 for update',[x.advocate_id]);
   const fresh=(await db.query('select * from assignments where id=$1 for update',[x.id]))[0];
   const status=need(f,'status');const allowed={proposed:['accepted','declined','cancelled'],accepted:['completed','cancelled']};
   if(!allowed[fresh.status]?.includes(status))throw Error(`Cannot move ${fresh.status} to ${status}`);
   const evidence=need(f,'evidence');let permission=fresh.permission_id;
   if(['accepted','completed'].includes(status)){
    const r=(await db.query('select * from requests where id=$1',[x.request_id]))[0];if(r.status!=='open')throw Error('Request is not open');
    permission=(await eligible(db,r,{id:x.advocate_id},x.id)).permission_id;
   }
   const outcome=status==='completed'?need(f,'outcome'):null;
   result=(await db.query('update assignments set status=$2,decision_evidence=$3,permission_id=$4,completed_on=$5,outcome=$6 where id=$1 returning *',[x.id,status,evidence,permission,status==='completed'?today():null,outcome]))[0];
   if(status==='completed')await db.query("update requests set status='fulfilled' where id=$1",[x.request_id]);
  }
  if(cmd==='add-story'){
   const a=await resolve(db,'advocates',need(f,'advocate'));
   result=(await db.query('insert into stories(advocate_id,title,body,evidence) values($1,$2,$3,$4) returning *',[a.id,need(f,'title'),need(f,'body'),need(f,'evidence')]))[0];
  }
  if(cmd==='story-decision'){
   const s=await resolve(db,'stories',need(f,'story'));await db.query('select id from advocates where id=$1 for update',[s.advocate_id]);
   const action=choice(need(f,'action'),['approve','withdraw'],'action');const evidence=need(f,'evidence');
   if(action==='approve'){
    const a=(await db.query('select * from advocates where id=$1',[s.advocate_id]))[0];
    const ok=(await db.query(`select a.id from advocates a join current_permissions p on p.advocate_id=a.id and p.kind='story'
     where a.id=$1 and a.status='active' and a.verified_on>=current_date-90 and a.retention_review>=current_date and p.decision='granted' and p.valid_until>=current_date`,[a.id])).length;
    if(!ok)throw Error('Story approval blocked: current story permission and reviewed profile required');
   }
   result=(await db.query('update stories set status=$2,approved_by=$3,approval_evidence=$4 where id=$1 returning *',[s.id,action==='approve'?'approved':'withdrawn',actor,evidence]))[0];
  }
  if(cmd==='log'){
   const a=await resolve(db,'advocates',need(f,'advocate'));const on=date(f.on||today(),'on');if(on>today())throw Error('Activity cannot be in the future');
   result=(await db.query('insert into activities(advocate_id,event_date,event_type,notes,actor) values($1,$2,$3,$4,$5) returning *',[a.id,on,need(f,'type'),need(f,'notes'),actor]))[0];
  }
  await audit(db,actor,cmd,result.id,result);return result;
 });
}

function importDate(v,format){
 if(/^\d{4}-\d{2}-\d{2}(?:$|[ T])/.test(v))return date(v.slice(0,10),'Event Date');
 const m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|[ T])/);
 if(!m||!['dmy','mdy'].includes(format))throw Error('Event Date requires ISO dates or explicit --date-format=dmy|mdy');
 return date(`${m[3]}-${(format==='mdy'?m[1]:m[2]).padStart(2,'0')}-${(format==='mdy'?m[2]:m[1]).padStart(2,'0')}`,'Event Date');
}
export async function importInfluitive(db,f){
 const actor=need(f,'actor');const file=path.resolve(need(f,'file'));const original=fs.readFileSync(file,'utf8');const rows=parseCsv(original);
 if(!rows.length)throw Error('CSV has no activity rows');
 const mapping=f.map?JSON.parse(fs.readFileSync(f.map,'utf8')):{};
 if(!mapping||Array.isArray(mapping)||typeof mapping!=='object'||Object.values(mapping).some(v=>typeof v!=='string'))throw Error('Mapping must map standard header names to source header names');
 const headers=['Event ID','Event Date','Event Type','Related Object','Contact ID','Email','Name','Company','Contact Type','Salesforce ID','Points'];
 for(const h of headers)if(!Object.keys(rows[0]).some(k=>k.toLowerCase()===(mapping[h]||h).toLowerCase()))throw Error(`Missing column: ${h}`);
 const get=(r,k)=>pick(r,mapping[k]||k).trim();const seen=new Set();
 const parsed=rows.map((raw,i)=>{
  const row={raw,event:get(raw,'Event ID'),contact:get(raw,'Contact ID'),name:get(raw,'Name'),company:get(raw,'Company'),email:email(get(raw,'Email')),type:get(raw,'Event Type'),related:get(raw,'Related Object'),on:importDate(get(raw,'Event Date'),f['date-format'])};
  if(!row.event||!row.contact||!row.name||!row.type||!row.company)throw Error(`Row ${i+2}: identifiers, name, company and event type are required`);
  if(row.on>today())throw Error(`Row ${i+2}: activity date is in the future`);
  const points=get(raw,'Points');if(points&&!/^-?\d+(?:\.\d+)?$/.test(points))throw Error(`Row ${i+2}: Points must be a number`);row.points=points||'0';
  if(seen.has(row.event))throw Error(`Duplicate Event ID ${row.event} in file`);seen.add(row.event);return row;
 });
 const sha=createHash('sha256').update(original).digest('hex');
 return transaction(db,async()=>{
  // Serialise imports while preserving rollback on both database adapters.
  await db.exec('LOCK TABLE import_batches IN SHARE ROW EXCLUSIVE MODE');
  const prior=await db.query('select id,row_count from import_batches where sha256=$1',[sha]);
  if(prior.length)return {batch_id:prior[0].id,imported:0,skipped:parsed.length,dry_run:!!f['dry-run'],message:'Identical file already imported'};
  const batch=(await db.query('insert into import_batches(sha256,filename,original_csv,row_count,actor) values($1,$2,$3,$4,$5) returning id',[sha,path.basename(file),original,parsed.length,actor]))[0];
  let imported=0,skipped=0;
  for(const row of parsed){
   const existing=await db.query('select * from activities where external_id=$1',[row.event]);
   if(existing.length){
    const same=JSON.stringify(Object.entries(existing[0].raw_source).sort())===JSON.stringify(Object.entries(row.raw).sort());
    if(!same)throw Error(`Event ${row.event} changed. Reconcile source history before importing.`);skipped++;continue;
   }
   let [a]=await db.query('select * from advocates where external_id=$1',[row.contact]);
   if(a && (a.email!==row.email||a.name!==row.name||a.company!==row.company))throw Error(`Contact ${row.contact} changed. Reconcile the profile before importing.`);
   if(!a)a=(await db.query('insert into advocates(external_id,name,email,company) values($1,$2,$3,$4) returning *',[row.contact,row.name,row.email,row.company]))[0];
   await db.query('insert into activities(advocate_id,external_id,event_date,event_type,related_object,points,raw_source,batch_id,actor) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)',[a.id,row.event,row.on,row.type,row.related,row.points,JSON.stringify(row.raw),batch.id,actor]);imported++;
  }
  await audit(db,actor,'import-influitive',batch.id,{sha256:sha,imported,skipped});
  return {batch_id:batch.id,imported,skipped,dry_run:!!f['dry-run'],message:'Imported profiles stay paused. Verify history, capacity and permissions before use.'};
 },!!f['dry-run']);
}

async function exportAll(db,dir){
 dir=path.resolve(dir);if(fs.existsSync(dir))throw Error('Export destination must be a new directory');
 const data={format:'customer-advocacy-v1',exported_at:new Date().toISOString(),records:{}};
 await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{for(const t of domainTables)data.records[t]=await db.query(`select * from ${t} order by id`);}finally{await db.exec('ROLLBACK');}
 fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'advocacy.json');fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return {file,counts:Object.fromEntries(Object.entries(data.records).map(([k,v])=>[k,v.length]))};
}
async function draft(db,cmd,ref,f){
 let text;
 await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
 if(cmd==='weekly-review')text='# Draft weekly advocacy review\n\n'+(await Promise.all(['dashboard','attention','compliance'].map(async c=>'## '+c+'\n\n'+format(await run(db,[c]))))).join('\n\n');
 if(cmd==='draft-reference'){
  const r=await resolve(db,'requests',ref);const matches=await candidates(db,r);
  const x=await db.query("select x.id,x.advocate_id,a.name,x.status from assignments x join advocates a on a.id=x.advocate_id where request_id=$1 and x.status in ('proposed','accepted')",[r.id]);
  const checks=x.length?await candidates(db,r,x[0].id):matches;
  text=`# Draft internal reference brief: ${r.code}\n\nProspect: ${r.prospect}\nOwner: ${r.owner}\nDue: ${r.due_date}\nPurpose: ${r.brief}\n\n${format(x)}\n\nCurrent checks:\n${format(checks)}\n\nInternal only. Confirm the audience, restrictions and the advocate's acceptance before any disclosure. Nothing was sent.`;
 }
 if(cmd==='draft-story'){
  const s=await resolve(db,'stories',ref);const [v]=await db.query('select * from story_library where id=$1',[s.id]);
  if(!v.usable)throw Error('Story draft blocked: permission, profile and wording approval must be current');
  text=`# Draft story: ${s.title}\n\n${s.body}\n\nAdvocate: ${v.name}, ${v.company}\nPermission through: ${v.valid_until}\nRestrictions: ${v.restrictions}\nSource: ${s.evidence}\n\nInternal draft only. Recheck permission and exact wording before publication.`;
 }
 }finally{await db.exec('ROLLBACK');}
 const file=path.resolve(f.out||path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts',`${cmd}-${randomUUID()}.md`));
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,text+'\n',{flag:'wx',mode:0o600});return {file};
}
export function format(value){
 if(Array.isArray(value)){
  if(!value.length)return '(none)';
  if(value[0]?.question)return value.map(x=>x.question+'\n'+format(x.rows)).join('\n\n');
  return table(value,Object.keys(value[0]).map(key=>({key,label:key,format:v=>typeof v==='object'&&v!==null?JSON.stringify(v):v})));
 }
 if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}: ${typeof v==='object'&&v!==null?'\n'+format(Array.isArray(v)?v:[v]):v}`).join('\n');
 return String(value);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;const args=process.argv.slice(2);
 try{db=await getDb();const result=await run(db,args);console.log(args.includes('--json')?JSON.stringify(result,null,2):format(result));}
 catch(e){console.error(args.includes('--json')?JSON.stringify({error:e.message,candidates:e.candidates}):e.message);process.exitCode=1;}
 finally{if(db)await db.close();}
}
