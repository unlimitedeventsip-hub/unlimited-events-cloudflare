/* Cloudflare Pages Function: saves the lead in Supabase first, then emails via Resend.
 * API credentials are read ONLY from Cloudflare encrypted secrets.
 */
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const ALLOWED_EVENTS=new Set(['corporate','company-day','private','birthday','concert','other']);
const ALLOWED_GUESTS=new Set(['Sub 30','30–100','100–300','300–1000','Peste 1000']);
const ALLOWED_BUDGETS=new Set(['Sub 5.000 lei','5.000–15.000 lei','15.000–50.000 lei','50.000+ lei']);
const ALLOWED_EXTRAS=new Set(['Organizare completă','Foto & video','Entertainment','Producție','Catering / bar','Transport']);
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS})}
function str(v,max){return typeof v==='string'?v.trim().slice(0,max+1):''}
function clean(v,max){const s=str(v,max);return s.length<=max?s:null}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function validate(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const eventType=clean(body.eventType,32),description=clean(body.description,2500),city=clean(body.city,100);
  const fullName=clean(body.fullName,120),email=clean(body.email,200),phone=clean(body.phone,24);
  const date=body.date===null||body.date===''||body.date===undefined?null:clean(body.date,10);
  const guests=body.guests===null||body.guests===''||body.guests===undefined?null:clean(body.guests,32);
  const budget=body.budget===null||body.budget===''||body.budget===undefined?null:clean(body.budget,40);
  const extras=body.extras;
  if(!ALLOWED_EVENTS.has(eventType)||!description||description.length<12||!city||city.length<2||!fullName||fullName.length<2)return null;
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return null;
  if(!phone||phone.replace(/\D/g,'').length<8||phone.replace(/\D/g,'').length>15||!/^[+\d\s().-]+$/.test(phone))return null;
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(new Date(`${date}T00:00:00Z`).getTime())))return null;
  if(guests&&!ALLOWED_GUESTS.has(guests))return null;
  if(budget&&!ALLOWED_BUDGETS.has(budget))return null;
  if(!Array.isArray(extras)||extras.length>6||extras.some(x=>!ALLOWED_EXTRAS.has(x)))return null;
  if(body.consent!==true)return null;
  return {event_type:eventType,description,city,event_date:date,guests,budget,services:[...new Set(extras)],full_name:fullName,email,phone,consent_version:'2026-11',consented_at:new Date().toISOString(),source_path:clean(body.sourcePath,150)||'/'};
}
async function verifyTurnstile(token,secret,ip){
  if(!secret)return true;
  if(!token||typeof token!=='string'||token.length>2500)return false;
  const form=new URLSearchParams({secret,response:token});if(ip)form.append('remoteip',ip);
  try{const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});const data=await r.json();return data.success===true}catch{return false}
}
async function insertSupabase(url,key,lead){
  const r=await fetch(`${url.replace(/\/$/,'')}/rest/v1/event_leads?select=id`,{
    method:'POST',headers:{'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(lead)});
  if(!r.ok)throw new Error(`Supabase insert failed: HTTP ${r.status}`);
  const rows=await r.json();if(!Array.isArray(rows)||typeof rows[0]?.id!=='string')throw new Error('Missing inserted lead id');
  return rows[0].id;
}
async function updateEmailStatus(url,key,id,status){
  const r=await fetch(`${url.replace(/\/$/,'')}/rest/v1/event_leads?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{'apikey':key,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({email_status:status})});return r.ok;
}
async function sendEmail(env,lead,id){
  const from=env.EMAIL_FROM,apiKey=env.RESEND_API_KEY,to=env.EMAIL_TO||'unlimited.events.ip@gmail.com';
  if(!from||!apiKey)return false;
  const labels={corporate:'Corporate Party','company-day':'Company Day',private:'Private Party',birthday:'Birthday',concert:'Concert / Show',other:'Altă idee'};
  const fields=[['Eveniment',labels[lead.event_type]],['Nume',lead.full_name],['Email',lead.email],['Telefon',lead.phone],['Oraș',lead.city],['Dată',lead.event_date||'De stabilit'],['Invitați',lead.guests||'De stabilit'],['Buget',lead.budget||'De discutat'],['Servicii',lead.services.join(', ')||'De stabilit'],['Mesaj',lead.description]];
  const html=`<h1>Nouă cerere Unlimited Events</h1><p><b>Referință:</b> ${escapeHtml(id)}</p><table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse">${fields.map(([a,b])=>`<tr><th align="left">${escapeHtml(a)}</th><td style="white-space:pre-wrap">${escapeHtml(b)}</td></tr>`).join('')}</table><p>Cererea a fost salvată și în Supabase.</p>`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],reply_to:lead.email,subject:`Cerere nouă: ${labels[lead.event_type]} — ${lead.full_name}`,html})});
  return r.ok;
}
export async function onRequestPost({request,env}){
  if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)return reply({ok:false,message:'Formularul nu este încă activat pe server.'},503);
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return reply({ok:false,message:'Formatul cererii nu este acceptat.'},415);
  const origin=request.headers.get('Origin'),ownOrigin=new URL(request.url).origin;
  if(origin&&origin!==ownOrigin)return reply({ok:false,message:'Origine neacceptată.'},403);
  const claimedSize=Number(request.headers.get('Content-Length')||0);if(claimedSize>16000)return reply({ok:false,message:'Cererea este prea mare.'},413);
  let raw,body;try{raw=await request.text();if(raw.length>16000)return reply({ok:false,message:'Cererea este prea mare.'},413);body=JSON.parse(raw)}catch{return reply({ok:false,message:'Date invalide.'},400)}
  if(body.website)return reply({ok:false,message:'Cerere invalidă.'},400);
  const lead=validate(body);if(!lead)return reply({ok:false,message:'Completează corect câmpurile obligatorii.'},422);
  const checked=await verifyTurnstile(body.turnstileToken,env.TURNSTILE_SECRET_KEY,request.headers.get('CF-Connecting-IP'));
  if(!checked)return reply({ok:false,message:'Verificarea anti-spam nu a reușit. Reîncearcă.'},403);
  let id;
  try{id=await insertSupabase(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,lead)}
  catch(e){console.error('Supabase lead insert error',String(e));return reply({ok:false,message:'Nu am putut salva cererea. Reîncearcă.'},502)}
  let emailSent=false;
  try{emailSent=await sendEmail(env,lead,id)}catch(e){console.error('Resend notification error',String(e))}
  try{await updateEmailStatus(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,id,emailSent?'sent':env.RESEND_API_KEY?'failed':'not_configured')}
  catch(e){console.error('Email status update error',String(e))}
  return reply({ok:true,id,emailSent},201);
}
