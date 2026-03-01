// DayForge v5 — Complete Frontend Logic
// Built with ∞ love by Hypatia & Carles
const API='';let T='',wss=[],curWs=null,items=[],cats=[],globalApps=[],selApps=new Set(),editId=null,editWsId=null,editCatId=null,editNoteId=null,notePreviewing=false,searchResults=[],searchSel=-1,dashData=null,inboxWs=null;

// ═══ AUTH ═══
async function doLogin(){
  const u=document.getElementById('loginUser').value,p=document.getElementById('loginPass').value;
  try{const r=await fetch(API+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
  if(!r.ok)throw 0;const d=await r.json();T=d.token;localStorage.setItem('df_token',T);showApp()}catch(e){document.getElementById('loginErr').textContent='Error de acceso'}
}
function doLogout(){T='';localStorage.removeItem('df_token');location.reload()}
async function checkAuth(){T=localStorage.getItem('df_token')||'';if(!T)return;
  try{const r=await fetch(API+'/api/auth/verify',{headers:ah()});if(r.ok)showApp();else T=''}catch(e){T=''}}
function ah(){return{'Authorization':'Bearer '+T,'Content-Type':'application/json'}}
function showApp(){document.getElementById('loginScreen').style.display='none';document.getElementById('appScreen').style.display='block';loadAll()}

// ═══ LOAD ALL ═══
async function loadAll(){await loadWs();loadGApps();loadHyp();checkInbox();updateChatWsList()}

// ═══ WORKSPACES ═══
async function loadWs(){
  try{const r=await fetch(API+'/api/workspaces',{headers:ah()});const d=await r.json();wss=d.workspaces||[];renderSb()}catch(e){console.error(e)}
}
function renderSb(){
  const el=document.getElementById('sbW');
  const active=wss.filter(w=>w.status!=='archived');
  const forged=active.filter(w=>w.status==='forged');
  const rest=active.filter(w=>w.status!=='forged');
  let h='';
  forged.forEach(w=>{h+=wsItem(w,true)});
  rest.forEach(w=>{h+=wsItem(w,false)});
  el.innerHTML=h;
  // Load insights for each
  active.forEach(w=>loadInsight(w.id));
}
function wsItem(w,isForged){
  const on=curWs&&curWs.id===w.id?'on':'';
  const fr=isForged?'<span class="fr">🔥</span>':'';
  const ct=w.pending_count||0;
  return `<div class="sw ${on}" onclick="selWs('${w.id}')" oncontextmenu="event.preventDefault();openEditWs('${w.id}')">
    <span class="ic">${w.icon||'📁'}</span><span class="nm">${w.name}</span>${ct?`<span class="ct">${ct}</span>`:''}${fr}
    <div class="hint" id="hint-${w.id}">...</div></div>`;
}
async function loadInsight(wid){
  try{const r=await fetch(API+'/api/hypatia/insight/'+wid,{headers:ah()});const d=await r.json();
    const el=document.getElementById('hint-'+wid);if(el)el.textContent=d.insight||''}catch(e){}}

async function selWs(id){
  curWs=wss.find(w=>w.id===id)||null;renderSb();
  if(!curWs)return;
  await loadItems();await loadCats();renderWs()
}
async function loadItems(){
  if(!curWs)return;
  try{const r=await fetch(API+'/api/items/'+curWs.id,{headers:ah()});const d=await r.json();items=d.items||[]}catch(e){items=[]}
}
async function loadCats(){
  if(!curWs)return;
  try{const r=await fetch(API+'/api/categories/'+curWs.id,{headers:ah()});const d=await r.json();cats=d.categories||[]}catch(e){cats=[]}
}

// ═══ RENDER WORKSPACE ═══
function renderWs(){
  const c=document.getElementById('wsC');const w=curWs;if(!w){c.innerHTML='';return}
  const pending=items.filter(i=>i.status==='pending');
  const done=items.filter(i=>i.status==='done');
  const perm=items.filter(i=>i.permanent);
  const catMap={};cats.forEach(ct=>catMap[ct.id]=ct.name);
  // Status buttons
  const sts=['active','forged','archived'];
  const stL={'active':'Activo','forged':'🔥 Forjado','archived':'📦'};
  let stH=sts.map(s=>`<button class="wb${w.status===s?' fon':''}" onclick="setWsSt('${s}')">${stL[s]}</button>`).join('');
  // Focus mode
  stH+=`<button class="wb" onclick="toggleFocus()" id="focusBtn">🎯 Focus</button>`;
  stH+=`<button class="wb" onclick="showWsNotes()">📝 Notas (${w.note_count||0})</button>`;

  let h=`<div class="wh"><div class="wh-l"><span class="ic">${w.icon}</span><h2>${w.name}</h2></div><div class="wh-r">${stH}</div></div>`;
  // Categories bar
  h+=`<div class="cb"><span class="cp on" onclick="filterCat('')">Todos <span class="n">${pending.length}</span></span>`;
  cats.forEach(ct=>{const n=pending.filter(i=>i.category===ct.id).length;
    h+=`<span class="cp" onclick="filterCat('${ct.id}')" ondblclick="openEditCat('${ct.id}')">${ct.name} <span class="n">${n}</span></span>`});
  h+=`<span class="cp" onclick="openNewCat()">+</span></div>`;
  // Add item row
  h+=`<div class="ar"><select id="addT"><option value="url">🌐</option><option value="file">📄</option><option value="note">📝</option></select>
    <input type="text" id="addV" placeholder="URL, archivo o nota..." onkeydown="if(event.key==='Enter')addItem()">
    <select id="addCat"><option value="">Sin cat</option>${cats.map(ct=>`<option value="${ct.id}">${ct.name}</option>`).join('')}</select>
    <button onclick="addItem()">Añadir</button></div>`;
  // Pending items
  if(pending.length){h+='<div class="il">Pendientes ('+pending.length+')</div>';
    pending.sort((a,b)=>(a.order||0)-(b.order||0)).forEach(i=>{h+=renderItem(i,catMap)})}
  // Done items
  if(done.length){h+=`<div class="il" style="display:flex;align-items:center;justify-content:space-between">Completados (${done.length})<button class="ab" onclick="clearDone()">Limpiar</button></div>`;
    done.forEach(i=>{h+=renderItem(i,catMap,true)})}
  // Forge button
  if(w.status==='forged'){h+=`<div class="fgs"><button class="fg" onclick="doForge()">🔨 FORJAR</button><div class="fc">${pending.filter(i=>i.type==='url').length} URLs • ${pending.filter(i=>i.type==='file').length} archivos</div></div>`}
  c.innerHTML=h;
  // Permanents in sidebar
  const pinEl=document.getElementById('pinSec');const sbP=document.getElementById('sbP');
  if(perm.length||curWs){pinEl.style.display='block';
    sbP.innerHTML=perm.map(i=>`<div class="sp"><span style="font-size:.8rem">${i.type==='url'?'🌐':'📄'}</span><a href="${i.value}" target="_blank" title="${i.value}">${i.label||i.value}</a><div class="ax"><button class="xb" onclick="editItem('${i.id}')">✎</button></div></div>`).join('')}
  else{pinEl.style.display='none'}
}
function renderItem(i,catMap,isDone){
  const dn=isDone?'dn':'';const ck=isDone?'on':'';
  const tp={'url':'🌐','file':'📄','note':'📝'}[i.type]||'📄';
  const catTag=catMap[i.category]?`<span class="cat-tag">${catMap[i.category]}</span>`:'';
  const noteTag=i.notes?`<span class="nt" title="${i.notes}">📝 ${i.notes.substring(0,20)}</span>`:'';
  const pin=i.permanent?'📌 ':'';
  const launch=i.type==='url'&&!isDone?`<button class="lnch" onclick="event.stopPropagation();window.open('${i.value}','_blank')" title="Abrir">▶</button>`:'';
  return `<div class="it ${dn}"><div class="ik ${ck}" onclick="togItem('${i.id}','${isDone?'pending':'done'}')">✓</div>
    <span class="tp">${tp}</span><span class="lb" onclick="editItem('${i.id}')">${pin}${i.label||i.value}</span>
    <span class="vl" title="${i.value}">${i.value.replace('https://','').substring(0,40)}</span>${catTag}${noteTag}
    <div class="ia">${launch}<button class="ab" onclick="editItem('${i.id}')">✎</button><button class="ab dl" onclick="delItem('${i.id}')">✕</button></div></div>`;
}

// ═══ ITEM OPERATIONS ═══
async function addItem(){
  const t=document.getElementById('addT').value,v=document.getElementById('addV').value.trim(),cat=document.getElementById('addCat').value;
  if(!v)return;
  await fetch(API+'/api/items',{method:'POST',headers:ah(),body:JSON.stringify({workspace_id:curWs.id,type:t,value:v,category:cat})});
  document.getElementById('addV').value='';await loadItems();renderWs();celebrate()
}
async function togItem(id,st){
  await fetch(API+'/api/items/'+id,{method:'PUT',headers:ah(),body:JSON.stringify({status:st})});
  if(st==='done')celebrate();await loadItems();renderWs()
}
async function delItem(id){await fetch(API+'/api/items/'+id,{method:'DELETE',headers:ah()});await loadItems();renderWs()}
async function clearDone(){await fetch(API+'/api/items/'+curWs.id+'/clear-done',{method:'POST',headers:ah()});await loadItems();renderWs()}
function editItem(id){
  const i=items.find(x=>x.id===id);if(!i)return;editId=id;
  document.getElementById('eT').value=i.type;document.getElementById('eV').value=i.value;document.getElementById('eL').value=i.label||'';
  document.getElementById('eN').value=i.notes||'';document.getElementById('eP').checked=!!i.permanent;
  // Populate category select
  const cs=document.getElementById('eC');cs.innerHTML='<option value="">Sin categoría</option>'+cats.map(c=>`<option value="${c.id}"${c.id===i.category?' selected':''}>${c.name}</option>`).join('');
  // Populate workspace move select
  const ws=document.getElementById('eW');ws.innerHTML=wss.filter(w=>w.status!=='archived').map(w=>`<option value="${w.id}"${w.id===curWs.id?' selected':''}>${w.icon} ${w.name}</option>`).join('');
  openM('eiM')
}
async function saveEdit(){
  const d={type:document.getElementById('eT').value,value:document.getElementById('eV').value,label:document.getElementById('eL').value,
    notes:document.getElementById('eN').value,permanent:document.getElementById('eP').checked,category:document.getElementById('eC').value,
    workspace_id:document.getElementById('eW').value};
  await fetch(API+'/api/items/'+editId,{method:'PUT',headers:ah(),body:JSON.stringify(d)});
  closeM('eiM');await loadItems();renderWs()
}
function filterCat(cid){
  document.querySelectorAll('.cp').forEach(e=>e.classList.remove('on'));event.target.closest('.cp').classList.add('on');
  const pending=items.filter(i=>i.status==='pending'&&(!cid||i.category===cid));
  // Simple re-render of items only
  selWs(curWs.id)
}

// ═══ WORKSPACE CRUD ═══
function openNewWs(){editWsId=null;document.getElementById('wsMT').textContent='Nuevo Workspace';document.getElementById('wsN').value='';document.getElementById('wsIC').value='';document.getElementById('wsDel').style.display='none';renderEmojis();openM('wsM')}
function openEditWs(id){const w=wss.find(x=>x.id===id);if(!w)return;editWsId=id;document.getElementById('wsMT').textContent='Editar Workspace';document.getElementById('wsN').value=w.name;document.getElementById('wsIC').value=w.icon;document.getElementById('wsDel').style.display='inline-block';renderEmojis(w.icon);openM('wsM')}
function renderEmojis(sel){const ems=['📁','📊','🎯','🚀','💡','📝','🔬','🎨','💜','🌟','📌','🔥','⚡','🌍','📚','🎵','✨','💰','🏠','🎮','🔧','🧬','☕','🎭'];
  document.getElementById('emjP').innerHTML=ems.map(e=>`<div class="ep${e===sel?' sel':''}" onclick="document.getElementById('wsIC').value='${e}';document.querySelectorAll('.ep').forEach(x=>x.classList.remove('sel'));this.classList.add('sel')">${e}</div>`).join('')}
async function saveWs(){const n=document.getElementById('wsN').value.trim(),ic=document.getElementById('wsIC').value||'📁';if(!n)return;
  if(editWsId){await fetch(API+'/api/workspaces/'+editWsId,{method:'PUT',headers:ah(),body:JSON.stringify({name:n,icon:ic})})}
  else{await fetch(API+'/api/workspaces',{method:'POST',headers:ah(),body:JSON.stringify({name:n,icon:ic})})}
  closeM('wsM');await loadWs()}
async function deleteWs(){if(!editWsId||!confirm('¿Eliminar workspace?'))return;await fetch(API+'/api/workspaces/'+editWsId,{method:'DELETE',headers:ah()});closeM('wsM');curWs=null;document.getElementById('wsC').innerHTML='';await loadWs()}
async function setWsSt(s){if(!curWs)return;await fetch(API+'/api/workspaces/'+curWs.id,{method:'PUT',headers:ah(),body:JSON.stringify({status:s})});await loadWs();curWs=wss.find(w=>w.id===curWs.id);renderWs()}

// ═══ CATEGORIES ═══
function openNewCat(){editCatId=null;document.getElementById('catMT').textContent='Nueva Categoría';document.getElementById('catN').value='';document.getElementById('catD').value='';document.getElementById('catDel').style.display='none';openM('catM')}
function openEditCat(id){const c=cats.find(x=>x.id===id);if(!c)return;editCatId=id;document.getElementById('catMT').textContent='Editar Categoría';document.getElementById('catN').value=c.name;document.getElementById('catD').value=c.description||'';document.getElementById('catDel').style.display='inline-block';openM('catM')}
async function saveCat(){const n=document.getElementById('catN').value.trim();if(!n)return;
  if(editCatId){await fetch(API+'/api/categories/'+editCatId,{method:'PUT',headers:ah(),body:JSON.stringify({name:n,description:document.getElementById('catD').value})})}
  else{await fetch(API+'/api/categories',{method:'POST',headers:ah(),body:JSON.stringify({workspace_id:curWs.id,name:n,description:document.getElementById('catD').value})})}
  closeM('catM');await loadCats();renderWs()}
async function deleteCat(){if(!editCatId||!confirm('¿Eliminar?'))return;await fetch(API+'/api/categories/'+editCatId,{method:'DELETE',headers:ah()});closeM('catM');await loadCats();renderWs()}

// ═══ FORGE ═══
async function doForge(){
  try{const r=await fetch(API+'/api/sessions/forge',{method:'POST',headers:ah()});const d=await r.json();const its=d.items_to_launch||[];
    const urls=its.filter(i=>i.type==='url'&&i.status==='pending');
    if(!urls.length){toast('No hay URLs para forjar');return}
    let opened=0;for(const u of urls){setTimeout(()=>window.open(u.value,'_blank'),opened*300);opened++}
    toast(`🔨 ¡${opened} URLs forjadas!`)}catch(e){toast('Error al forjar','err')}
}

// ═══ GLOBAL APPS ═══
async function loadGApps(){
  try{const r=await fetch(API+'/api/apps',{headers:ah()});const d=await r.json();globalApps=d.apps||[];renderApps()}catch(e){globalApps=[]}
}
function renderApps(){
  const el=document.getElementById('sbA');
  el.innerHTML=globalApps.map(a=>`<div class="sa"><div class="ack${selApps.has(a.id)?' on':''}" onclick="togApp('${a.id}')">✓</div>
    <span class="nm">${a.icon||'📱'} ${a.name}</span><button class="dl" onclick="delApp('${a.id}')">✕</button></div>`).join('');
  document.getElementById('launchBtn').disabled=selApps.size===0
}
function togApp(id){selApps.has(id)?selApps.delete(id):selApps.add(id);renderApps()}
async function addGApp(){const p=document.getElementById('newAppP').value.trim();if(!p)return;
  const nm=p.split(/[/\\]/).pop().replace(/\.exe$/i,'');
  await fetch(API+'/api/apps',{method:'POST',headers:ah(),body:JSON.stringify({name:nm,path:p,icon:'📱'})});
  document.getElementById('newAppP').value='';await loadGApps()}
async function delApp(id){await fetch(API+'/api/apps/'+id,{method:'DELETE',headers:ah()});selApps.delete(id);await loadGApps()}
function launchSelApps(){const apps=globalApps.filter(a=>selApps.has(a.id));apps.forEach(a=>{try{window.open(a.path)}catch(e){}});toast(`🚀 ${apps.length} apps`)}

// ═══ PERMANENTS ═══
function addPerm(){if(!curWs)return;const v=prompt('URL o ruta permanente:');if(!v)return;
  fetch(API+'/api/items',{method:'POST',headers:ah(),body:JSON.stringify({workspace_id:curWs.id,type:'url',value:v,permanent:true})}).then(()=>{loadItems().then(()=>renderWs())})}

// ═══ DASHBOARD ═══
async function showDash(){
  curWs=null;renderSb();
  try{const r=await fetch(API+'/api/dashboard',{headers:ah()});dashData=await r.json()}catch(e){dashData={total_pending:0,total_done:0,total_notes:0,total_apps:0,workspaces:[]}}
  const d=dashData;
  let h=`<div class="dash"><div class="dash-stats">
    <div class="ds"><div class="num">${d.total_pending}</div><div class="lbl">Pendientes</div></div>
    <div class="ds"><div class="num">${d.total_done}</div><div class="lbl">Completados</div></div>
    <div class="ds"><div class="num">${d.total_notes}</div><div class="lbl">Notas</div></div>
    <div class="ds"><div class="num">${d.workspaces?.length||0}</div><div class="lbl">Workspaces</div></div></div>`;
  h+='<div class="dash-grid">';
  (d.workspaces||[]).forEach(w=>{
    const total=w.pending+w.done;const pct=total?Math.round(w.done/total*100):0;
    const stCls=w.status==='forged'?'forged':'active';
    h+=`<div class="dwc" onclick="selWs('${w.id}')"><div class="top"><span class="ic">${w.icon}</span><span class="nm">${w.name}</span><span class="st ${stCls}">${w.status}</span></div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="meta"><span>📋 ${w.pending} pend</span><span>✅ ${w.done}</span><span>📝 ${w.notes}</span>${w.days_inactive>3?`<span style="color:var(--o)">⚠ ${w.days_inactive}d`:'</span>'}</div>
      <div class="insight" id="di-${w.id}"></div></div>`});
  h+='</div></div>';
  document.getElementById('wsC').innerHTML=h;
  // Load insights for dashboard cards
  (d.workspaces||[]).forEach(async w=>{
    try{const r=await fetch(API+'/api/hypatia/insight/'+w.id,{headers:ah()});const dd=await r.json();
      const el=document.getElementById('di-'+w.id);if(el)el.textContent=dd.insight||''}catch(e){}})
}

// ═══ TIMELINE ═══
async function showTimeline(){
  curWs=null;renderSb();
  try{const r=await fetch(API+'/api/activity?limit=40',{headers:ah()});const d=await r.json();
    const acts=d.activities||[];
    let h='<h2 style="font-family:Playfair Display,serif;margin-bottom:12px">🕐 Timeline</h2>';
    if(!acts.length){h+='<div class="emp"><p>Sin actividad registrada aún.</p></div>'}
    else{const grouped={};acts.forEach(a=>{const day=(a.created||'').substring(0,10);if(!grouped[day])grouped[day]=[];grouped[day].push(a)});
      Object.entries(grouped).forEach(([day,items])=>{
        h+=`<div style="font-family:JetBrains Mono;font-size:.68rem;color:var(--dim);margin:12px 0 4px;text-transform:uppercase;letter-spacing:1px">${day}</div>`;
        items.forEach(a=>{const dotCls={'item_done':'done','item_added':'add','forge':'forge'}[a.action]||'';
          const icons={'login':'🔑','ws_created':'📁','item_added':'➕','item_done':'✅','items_cleared':'🧹','forge':'🔨','note_created':'📝','ws_deleted':'🗑️','ws_status':'📌'}[a.action]||'•';
          h+=`<div class="tl-item"><div class="tl-dot ${dotCls}"></div><div class="tl-body"><div class="act">${icons} ${a.action.replace(/_/g,' ')}</div><div class="det">${a.detail||''}</div><div class="time">${(a.created||'').substring(11,19)}</div></div></div>`})})}
    document.getElementById('wsC').innerHTML=h}catch(e){document.getElementById('wsC').innerHTML='<p>Error cargando timeline</p>'}
}

// ═══ SEARCH (Ctrl+K) ═══
function openSearch(){document.getElementById('searchOv').classList.add('on');document.getElementById('searchIn').value='';document.getElementById('searchRes').innerHTML='<div class="search-hint">Escribe para buscar...</div>';document.getElementById('searchIn').focus();searchSel=-1}
function closeSearch(){document.getElementById('searchOv').classList.remove('on')}
async function doSearch(){
  const q=document.getElementById('searchIn').value.trim();
  if(q.length<2){document.getElementById('searchRes').innerHTML='<div class="search-hint">Escribe al menos 2 caracteres...</div>';return}
  try{const r=await fetch(API+'/api/search?q='+encodeURIComponent(q),{headers:ah()});const d=await r.json();searchResults=d.results||[];
    if(!searchResults.length){document.getElementById('searchRes').innerHTML='<div class="search-hint">Sin resultados para "'+q+'"</div>';return}
    document.getElementById('searchRes').innerHTML=searchResults.map((r,i)=>
      `<div class="sr${i===searchSel?' sel':''}" onclick="searchGo(${i})"><span class="sri">${r.icon}</span><div class="srt"><div class="t">${r.title}</div><div class="s">${r.sub||''}</div></div><span class="srty">${r.type}</span></div>`).join('')
  }catch(e){}}
function searchNav(e){
  if(e.key==='Escape'){closeSearch();return}
  if(e.key==='ArrowDown'){e.preventDefault();searchSel=Math.min(searchSel+1,searchResults.length-1);doSearch()}
  if(e.key==='ArrowUp'){e.preventDefault();searchSel=Math.max(searchSel-1,0);doSearch()}
  if(e.key==='Enter'&&searchSel>=0){searchGo(searchSel)}
}
function searchGo(i){
  const r=searchResults[i];if(!r)return;closeSearch();
  if(r.type==='workspace')selWs(r.id);
  else if(r.type==='item'&&r.workspace_id)selWs(r.workspace_id);
  else if(r.type==='note')openEditNote(r.id)
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openSearch()}if(e.key==='Escape')closeSearch()});

// ═══ INBOX ═══
async function checkInbox(){
  const iws=wss.find(w=>w.name==='📥 Inbox');inboxWs=iws;
  const badge=document.getElementById('ibBadge');
  if(!iws){badge.style.display='none';return}
  try{const r=await fetch(API+'/api/items/'+iws.id,{headers:ah()});const d=await r.json();const pending=(d.items||[]).filter(i=>i.status==='pending');
    if(pending.length){badge.textContent=pending.length;badge.style.display='flex'}else{badge.style.display='none'}}catch(e){}
}
async function showInbox(){
  if(!inboxWs)return openM('ibM');
  const r=await fetch(API+'/api/items/'+inboxWs.id,{headers:ah()});const d=await r.json();const its=(d.items||[]).filter(i=>i.status==='pending');
  if(!its.length){document.getElementById('ibItems').style.display='none';document.getElementById('ibEmpty').style.display='block';openM('ibM');return}
  document.getElementById('ibEmpty').style.display='none';document.getElementById('ibItems').style.display='block';
  const opts=wss.filter(w=>w.status!=='archived'&&w.name!=='📥 Inbox').map(w=>`<option value="${w.id}">${w.icon} ${w.name}</option>`).join('');
  document.getElementById('ibItems').innerHTML=its.map(i=>`<div class="inb"><div class="inf"><div class="lbl">${i.label||i.value}</div><div class="url">${i.value}</div></div>
    <select id="ib-${i.id}">${opts}</select><button class="cfy" onclick="classifyInbox('${i.id}')">→</button><button class="trsh" onclick="delInbox('${i.id}')">✕</button></div>`).join('');
  openM('ibM')
}
async function classifyInbox(id){const wid=document.getElementById('ib-'+id).value;if(!wid)return;
  await fetch(API+'/api/items/'+id,{method:'PUT',headers:ah(),body:JSON.stringify({workspace_id:wid})});showInbox();checkInbox()}
async function delInbox(id){await fetch(API+'/api/items/'+id,{method:'DELETE',headers:ah()});showInbox();checkInbox()}

// ═══ HYPATIA ═══
async function loadHyp(){
  document.getElementById('hypMsg').textContent='Observando...';
  try{const r=await fetch(API+'/api/hypatia/observe',{method:'POST',headers:ah(),body:JSON.stringify({context:'general'})});
    const d=await r.json();document.getElementById('hypMsg').textContent=d.message||'💜';
    document.getElementById('agDot').className=d.message?'ddot':'ddot off';document.getElementById('agLbl').textContent='Hypatia v5'}catch(e){document.getElementById('hypMsg').textContent='💜';document.getElementById('agDot').className='ddot off'}
}
async function celebrate(){
  try{const r=await fetch(API+'/api/hypatia/celebrate',{headers:ah()});const d=await r.json();toast(d.message||'✨','hyp')}catch(e){}
}

// ═══ CHAT ═══
function togChat(){const p=document.getElementById('chatP');p.classList.toggle('open');if(p.classList.contains('open'))loadCHist()}
function updateChatWsList(){const s=document.getElementById('chatWs');s.innerHTML='<option value="general">General</option>'+wss.filter(w=>w.status!=='archived').map(w=>`<option value="${w.id}">${w.icon} ${w.name}</option>`).join('')}
async function loadCHist(){
  const wid=document.getElementById('chatWs').value||'general';
  try{const r=await fetch(API+'/api/hypatia/chat-history/'+wid,{headers:ah()});const d=await r.json();
    const el=document.getElementById('chatB');el.innerHTML=(d.history||[]).map(h=>`<div class="cm u"><div class="w">Tú</div><div class="bbl">${esc(h.user)}</div></div><div class="cm h"><div class="w">Hypatia</div><div class="bbl">${esc(h.hypatia)}</div></div>`).join('');
    el.scrollTop=el.scrollHeight}catch(e){}}
async function sendChat(){
  const inp=document.getElementById('chatIn'),msg=inp.value.trim();if(!msg)return;
  const wid=document.getElementById('chatWs').value||'general';inp.value='';
  const b=document.getElementById('chatB');b.innerHTML+=`<div class="cm u"><div class="w">Tú</div><div class="bbl">${esc(msg)}</div></div>`;b.scrollTop=b.scrollHeight;
  document.getElementById('chatT').style.display='block';
  try{const r=await fetch(API+'/api/hypatia/chat',{method:'POST',headers:ah(),body:JSON.stringify({workspace_id:wid,message:msg})});const d=await r.json();
    b.innerHTML+=`<div class="cm h"><div class="w">Hypatia</div><div class="bbl">${esc(d.reply)}</div></div>`;b.scrollTop=b.scrollHeight}catch(e){b.innerHTML+=`<div class="cm h"><div class="bbl">Error 💜</div></div>`}
  document.getElementById('chatT').style.display='none'
}

// ═══ NOTES ═══
function showNotesList(){loadNotesList();openM('nlM')}
function showWsNotes(){if(!curWs)return;loadNotesList(curWs.id);openM('nlM')}
async function loadNotesList(wsFilter){
  const s=document.getElementById('nlWsF');s.innerHTML='<option value="">Todos</option>'+wss.filter(w=>w.status!=='archived').map(w=>`<option value="${w.id}"${wsFilter===w.id?' selected':''}>${w.icon} ${w.name}</option>`).join('');
  await loadNotes()
}
async function loadNotes(){
  const wf=document.getElementById('nlWsF').value;let url=API+'/api/notes';if(wf)url+='?workspace_id='+wf;
  try{const r=await fetch(url,{headers:ah()});const d=await r.json();
    const notes=d.notes||[];const g=document.getElementById('nlGrid');
    if(!notes.length){g.innerHTML='<div style="text-align:center;padding:20px;color:var(--dim)">Sin notas.</div>';return}
    g.innerHTML=notes.map(n=>{
      const wsNames=(n.workspace_ids||[]).map(id=>{const w=wss.find(x=>x.id===id);return w?w.icon+' '+w.name:''}).filter(Boolean).join(', ');
      return `<div class="ncard" onclick="openEditNote('${n.id}')"><div class="ntitle">${esc(n.title||'Sin título')}</div><div class="nprev">${esc((n.content||'').substring(0,100))}</div>
        <div class="nmeta">${wsNames?'<span>'+wsNames+'</span>':''}<span>${(n.updated||'').substring(0,10)}</span></div>
        <button class="ndel" onclick="event.stopPropagation();deleteNoteId='${n.id}';deleteNote()">✕</button></div>`}).join('')
  }catch(e){}}
function openNewNote(){editNoteId=null;document.getElementById('neMT').textContent='Nueva Nota';document.getElementById('neTitle').value='';document.getElementById('neBody').value='';document.getElementById('neBody').style.display='';document.getElementById('nePreviewBox').style.display='none';notePreviewing=false;document.getElementById('neDel').style.display='none';popNeMeta();openM('neM')}
async function openEditNote(id){
  try{const r=await fetch(API+'/api/notes/'+id,{headers:ah()});const d=await r.json();const n=d.note;if(!n)return;
    editNoteId=id;document.getElementById('neMT').textContent='Editar Nota';document.getElementById('neTitle').value=n.title||'';document.getElementById('neBody').value=n.content||'';
    document.getElementById('neBody').style.display='';document.getElementById('nePreviewBox').style.display='none';notePreviewing=false;document.getElementById('neDel').style.display='inline-block';
    popNeMeta(n.workspace_ids||[],n.category_ids||[]);openM('neM')}catch(e){}}
function popNeMeta(selWs=[],selCats=[]){
  document.getElementById('neWs').innerHTML=wss.filter(w=>w.status!=='archived').map(w=>`<option value="${w.id}"${selWs.includes(w.id)?' selected':''}>${w.icon} ${w.name}</option>`).join('');
  // All categories from all workspaces
  const allCats=[];wss.forEach(async w=>{try{const r=await fetch(API+'/api/categories/'+w.id,{headers:ah()});const d=await r.json();(d.categories||[]).forEach(c=>{if(!allCats.find(x=>x.id===c.id))allCats.push(c)});
    document.getElementById('neCat').innerHTML=allCats.map(c=>`<option value="${c.id}"${selCats.includes(c.id)?' selected':''}>${c.name}</option>`).join('')}catch(e){}})
}
async function saveNote(){const title=document.getElementById('neTitle').value.trim();if(!title){toast('Título requerido','err');return}
  const ws=Array.from(document.getElementById('neWs').selectedOptions).map(o=>o.value);
  const cs=Array.from(document.getElementById('neCat').selectedOptions).map(o=>o.value);
  const body={title,content:document.getElementById('neBody').value,workspace_ids:ws,category_ids:cs};
  if(editNoteId){await fetch(API+'/api/notes/'+editNoteId,{method:'PUT',headers:ah(),body:JSON.stringify(body)})}
  else{await fetch(API+'/api/notes',{method:'POST',headers:ah(),body:JSON.stringify(body)})}
  closeM('neM');loadNotes();toast('Nota guardada 📝')}
let deleteNoteId=null;
async function deleteNote(){const id=editNoteId||deleteNoteId;if(!id||!confirm('¿Eliminar nota?'))return;
  await fetch(API+'/api/notes/'+id,{method:'DELETE',headers:ah()});closeM('neM');loadNotes();deleteNoteId=null}
function closeNoteEd(){closeM('neM')}
// Markdown toolbar
function neFmt(pre,suf){const t=document.getElementById('neBody');const s=t.selectionStart,e=t.selectionEnd,txt=t.value;
  t.value=txt.substring(0,s)+pre+txt.substring(s,e)+suf+txt.substring(e);t.focus();t.selectionStart=s+pre.length;t.selectionEnd=e+pre.length}
function neIns(prefix){const t=document.getElementById('neBody');const s=t.selectionStart,txt=t.value;
  const ls=txt.lastIndexOf('\n',s-1)+1;t.value=txt.substring(0,ls)+prefix+txt.substring(ls);t.focus();t.selectionStart=t.selectionEnd=s+prefix.length}
function nePreview(){
  notePreviewing=!notePreviewing;const ed=document.getElementById('neBody'),pv=document.getElementById('nePreviewBox');
  if(notePreviewing){pv.innerHTML=mdToHtml(ed.value);ed.style.display='none';pv.style.display='block'}
  else{ed.style.display='';pv.style.display='none'}}
function mdToHtml(md){return md.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1 style="font-family:Playfair Display,serif;font-size:1.5rem;margin:12px 0 8px">$1</h1>')
  .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/~~(.+?)~~/g,'<del>$1</del>').replace(/`(.+?)`/g,'<code style="background:rgba(108,92,231,.15);padding:1px 4px;border-radius:3px;font-family:JetBrains Mono">$1</code>')
  .replace(/^- \[x\] (.+)$/gm,'<div>☑ <s style="opacity:.5">$1</s></div>').replace(/^- \[ \] (.+)$/gm,'<div>☐ $1</div>')
  .replace(/^> (.+)$/gm,'<blockquote style="border-left:3px solid var(--pl);padding-left:10px;color:var(--dim);margin:4px 0">$1</blockquote>')
  .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid var(--brd);margin:8px 0">').replace(/^- (.+)$/gm,'<div>• $1</div>').replace(/^\d+\. (.+)$/gm,'<div style="margin-left:12px">$1</div>')
  .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank" style="color:var(--pl)">$1</a>').replace(/\n/g,'<br>')}

// ═══ FOCUS MODE ═══
function toggleFocus(){document.getElementById('content').classList.toggle('focus-mode');
  const btn=document.getElementById('focusBtn');btn.classList.toggle('fon')}

// ═══ BOOKMARKLET ═══
function showBm(){const u=location.origin;document.getElementById('bmL').href=`javascript:void(fetch('${u}/api/quick-add',{method:'POST',headers:{'Authorization':'Bearer ${T}','Content-Type':'application/json'},body:JSON.stringify({workspace_id:'inbox',type:'url',value:location.href,label:document.title})}).then(()=>alert('📎 DayForge!')).catch(()=>alert('Error')))`;openM('bmM')}

// ═══ UTILS ═══
function openM(id){document.getElementById(id).classList.add('on')}
function closeM(id){document.getElementById(id).classList.remove('on')}
function toast(msg,cls=''){const t=document.getElementById('toast');t.textContent=msg;t.className='toast show'+(cls?' '+cls:'');setTimeout(()=>t.className='toast',2500)}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
// Init
checkAuth();
