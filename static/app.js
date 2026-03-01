// DayForge v5 — Complete Frontend Logic
// Built with ∞ love by Hypatia & Carles
const API='';let T='',wss=[],curWs=null,items=[],cats=[],globalApps=[],selApps=new Set(),editId=null,editWsId=null,editCatId=null,editNoteId=null,notePreviewing=false,searchResults=[],searchSel=-1,dashData=null,inboxWs=null,wsNotes=[];

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
  try{const nr=await fetch(API+'/api/notes?workspace_id='+id,{headers:ah()});const nd=await nr.json();wsNotes=nd.notes||[]}catch(e){wsNotes=[]}
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
  // Note cards
  if(wsNotes.length){h+='<div class="ncards-row">';
    wsNotes.forEach(n=>{const prev=(n.content||'').substring(0,80).replace(/[#*`>\n]/g,' ').trim();
      h+=`<div class="ncard-mini" onclick="openEditNote('${n.id}')"><div class="ncm-title">${esc(n.title||'Sin título')}</div><div class="ncm-prev">${esc(prev)}${prev.length>=80?'…':''}</div><div class="ncm-date">${(n.updated||'').substring(0,10)}</div></div>`});
    h+='</div>'}
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
    <span class="nm" onclick="launchApp('${a.id}')" style="cursor:pointer" title="${a.path}">${a.icon||'📱'} ${a.name}</span>
    <button class="dl" onclick="editApp('${a.id}')" title="Editar">✎</button><button class="dl" onclick="delApp('${a.id}')">✕</button></div>`).join('');
  document.getElementById('launchBtn').disabled=selApps.size===0
}
function togApp(id){selApps.has(id)?selApps.delete(id):selApps.add(id);renderApps()}
async function addGApp(){const p=document.getElementById('newAppP').value.trim();if(!p)return;
  let nm=document.getElementById('newAppN').value.trim();
  if(!nm){try{nm=new URL(p).hostname.replace('www.','')}catch(e){nm=p.split(/[/\\]/).pop().replace(/\.exe$/i,'')}}
  const icon=p.startsWith('http')?'🌐':'📱';
  await fetch(API+'/api/apps',{method:'POST',headers:ah(),body:JSON.stringify({name:nm,path:p,icon})});
  document.getElementById('newAppP').value='';document.getElementById('newAppN').value='';await loadGApps()}
async function delApp(id){await fetch(API+'/api/apps/'+id,{method:'DELETE',headers:ah()});selApps.delete(id);await loadGApps()}
function launchApp(id){const a=globalApps.find(x=>x.id===id);if(a)window.open(a.path,'_blank')}
function editApp(id){const a=globalApps.find(x=>x.id===id);if(!a)return;
  const nm=prompt('Nombre:',a.name);if(nm===null)return;
  const ic=prompt('Icono (emoji):',a.icon||'📱');
  const pt=prompt('URL o ruta:',a.path);if(!pt)return;
  fetch(API+'/api/apps/'+id,{method:'PUT',headers:ah(),body:JSON.stringify({name:nm||a.name,icon:ic||a.icon,path:pt})}).then(()=>loadGApps())}
function launchSelApps(){const apps=globalApps.filter(a=>selApps.has(a.id));let c=0;apps.forEach((a,i)=>{setTimeout(()=>window.open(a.path,'_blank'),i*300);c++});toast(`🚀 ${c} apps lanzadas`)}

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

// ═══════════════════════════════════════════════════════
// LEVERAGE ECOSYSTEM — El Fulcro Invisible, integrado
// ═══════════════════════════════════════════════════════
let levView='fulcros',levActiveFulcro=null,levActiveLayer=null,levExpandedNode=null;

const LEV={
  gold:'#d4a574',goldDim:'#8a6a44',text:'#e8e4df',dim:'#8a8690',muted:'#5a5660',
  border:'#2a2a3a',card:'#12121a',bg:'#0a0a1a',
  mat:'#6bad6b',epi:'#6b8aad',rel:'#ad6b6b',
  purple:'#9b7acc',cyan:'#55aacc',green:'#55aa77',red:'#cc5555'
};

function showLeverage(){
  curWs=null;renderSb();
  const c=document.getElementById('wsC');
  let h=`<div style="text-align:center;margin-bottom:4px;padding-top:4px">
    <div style="font-family:JetBrains Mono;font-size:.55rem;letter-spacing:4px;color:${LEV.goldDim}">HARMONY NEXUS VITAE</div>
    <h1 style="font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:300;color:${LEV.gold};margin:4px 0">Ecosistema de Apalancamiento</h1>
    <div style="font-size:.75rem;color:${LEV.dim}">Carles Garcia Bach · Teoría del Fulcro Invisible</div></div>`;
  h+=`<div class="lev-tabs">`;
  [{id:'fulcros',l:'Fulcros'},{id:'layers',l:'Capas'},{id:'storage',l:'StorageAI'},{id:'bigger',l:'Visión'},{id:'diagnostic',l:'Diagnóstico'}].forEach(v=>{
    h+=`<button class="lev-tab${levView===v.id?' on':''}" onclick="levView='${v.id}';showLeverage()">${v.l}</button>`});
  h+=`</div><div id="levContent"></div>`;
  h+=`<div style="text-align:center;margin-top:20px;padding:8px"><span style="font-family:JetBrains Mono;font-size:.55rem;color:${LEV.muted};letter-spacing:2px">CARLES & HYPATIA · EL FULCRO INVISIBLE · MARZO 2026</span></div>`;
  c.innerHTML=h;
  const lc=document.getElementById('levContent');
  if(levView==='fulcros')lc.innerHTML=renderFulcros();
  else if(levView==='layers')lc.innerHTML=renderLayers();
  else if(levView==='storage')lc.innerHTML=renderStorageAI();
  else if(levView==='bigger')lc.innerHTML=renderBiggerVision();
  else if(levView==='diagnostic')lc.innerHTML=renderDiagnostics();
}

// ═══ VISTA 1: FULCROS ═══
function renderFulcros(){
  const fulcros=[
    {id:'material',label:'FULCRO MATERIAL',sub:'La infraestructura sobre la que todo se apoya',color:LEV.mat,icon:'◆',
      items:[{n:'StorageAI Platform',d:'Next.js + MongoDB Atlas, 27 colecciones, 22.5M propiedades',s:.85},{n:'48+ Apps Desplegadas',d:'Portfolio técnico vivo en producción',s:.75},{n:'Plantillas Looker Studio',d:'30+ páginas, reutilizables, margen brutal',s:.8},{n:'HNV Landing + Marca',d:'Identidad definida, dominio, presencia',s:.5},{n:'Stack Técnico',d:'Vercel, Railway, MongoDB, APIs REST',s:.9},{n:'Datos Propietarios',d:'Catastro + INE + RVC + IVM — moat real',s:.95}]},
    {id:'epistemico',label:'FULCRO EPISTÉMICO',sub:'El conocimiento compartido que hace la palanca comprensible',color:LEV.epi,icon:'◈',
      items:[{n:'Metodología 4 Pilares',d:'AEO→GEO→SXO→AIO — framework propio',s:.9},{n:'Investigación 11 Modelos',d:'Credencial técnica sin equivalente en España',s:.85},{n:'El Fulcro Invisible',d:'Opúsculo — teoría propia de apalancamiento',s:.7},{n:'Thinking Divide',d:'IA como pensamiento vs. IA como herramienta',s:.65},{n:'35+ Metodologías',d:'Productividad codificada en apps funcionales',s:.6},{n:'Caso Goitia Documentado',d:'Caso real con 150+ apariciones prensa',s:.75}]},
    {id:'relacional',label:'FULCRO RELACIONAL',sub:'La confianza que transforma misma fuerza de inútil a decisiva',color:LEV.rel,icon:'◇',
      items:[{n:'Rafa Larena / AEGS',d:'Acceso directo sector self-storage español',s:.85},{n:'Ignacio Goitia',d:'Artista reconocido, portfolio vivo creciente',s:.7},{n:'Reddit (en activación)',d:'4 días/semana, regla 80/20',s:.3},{n:'LinkedIn (pendiente)',d:'Headline, About, 1-2 posts/semana',s:.15},{n:'Clientes Activos',d:'Rafa, Goitia, Ramón — base creciente',s:.5},{n:'Hypatia + 2 años',d:'Colaboración profunda, investigación única',s:.95}]}
  ];
  let h=`<div class="lev-head"><div class="pre">TEORÍA DEL FULCRO — CARLES GARCIA BACH</div><h2>Los Tres Fulcros</h2><div class="sub">Sin fulcro, la palanca es un palo. — El Fulcro Invisible, Cap. 8</div></div>`;
  h+=`<div style="display:flex;gap:10px;justify-content:center;margin-bottom:18px">`;
  fulcros.forEach(f=>{
    const on=levActiveFulcro===f.id;
    h+=`<div class="lev-fulcro-btn${on?' on':''}" style="${on?'background:'+f.color+'15;border-color:'+f.color:''}" onclick="levActiveFulcro=levActiveFulcro==='${f.id}'?null:'${f.id}';showLeverage()">
      <div style="font-size:1.3rem;margin-bottom:6px">${f.icon}</div>
      <div style="font-size:.68rem;letter-spacing:1.5px;color:${f.color};font-weight:600">${f.label}</div>
      <div style="font-size:.65rem;color:${LEV.dim};margin-top:3px;line-height:1.3">${f.sub}</div></div>`});
  h+=`</div>`;
  const active=fulcros.find(f=>f.id===levActiveFulcro);
  if(active){
    h+=`<div style="background:${LEV.card};border:1px solid ${active.color}33;border-radius:10px;padding:16px">
      <div style="font-size:.65rem;letter-spacing:2px;color:${active.color};margin-bottom:12px">${active.icon} ACTIVOS EN ESTE FULCRO</div>`;
    active.items.forEach(i=>{
      h+=`<div class="lev-item" style="margin-bottom:8px"><div style="flex:1"><div style="font-size:.85rem;color:${LEV.text};font-weight:500">${i.n}</div><div style="font-size:.72rem;color:${LEV.dim};margin-top:1px">${i.d}</div></div>
        <div style="width:100px;display:flex;align-items:center;gap:6px"><div class="lev-bar" style="flex:1"><div class="fill" style="width:${i.s*100}%;background:linear-gradient(90deg,${active.color}88,${active.color})"></div></div>
        <span style="font-size:.65rem;color:${active.color};min-width:28px;text-align:right">${Math.round(i.s*100)}%</span></div></div>`});
    h+=`</div>`}
  return h;
}

// ═══ VISTA 2: CAPAS ═══
function renderLayers(){
  const layers=[
    {n:7,nm:'Marca / Identidad',desc:'Transversal — multiplica todas las demás',carles:'HNV en construcción. Opúsculo como pieza fundacional. LinkedIn pendiente.',st:'building',stl:'CONSTRUYENDO',color:LEV.purple,proj:['HNV','El Fulcro Invisible','LinkedIn']},
    {n:6,nm:'Conocimiento Posicionado',desc:'Presencia en fuentes que alimentan modelos IA',carles:'Metodología 4 pilares, caso Goitia, 11 modelos. Falta: artículos en plataformas indexables.',st:'incipient',stl:'INCIPIENTE',color:LEV.cyan,proj:['Metodología GEO','Caso Goitia','Multi-modelo']},
    {n:5,nm:'Digital (coste marginal ≈ 0)',desc:'Se distribuye mientras duermes',carles:'StorageAI = palanca Capa 5 perfecta. Dato propietario + SaaS + moat 24-36 meses.',st:'active',stl:'ACTIVANDO',color:LEV.gold,proj:['StorageAI','AppForge','Systemia']},
    {n:4,nm:'Producto Reproducible',desc:'Coste marginal decreciente pero significativo',carles:'Plantillas Looker Studio. Framework GEO productizado.',st:'active',stl:'ACTIVANDO',color:LEV.green,proj:['Plantillas Looker','Framework GEO']},
    {n:3,nm:'Financiero',desc:'Apalancamiento sobre capital — spread entre coste y rendimiento',carles:'No aplica actualmente. Potencial futuro con beneficios StorageAI.',st:'future',stl:'FUTURO',color:LEV.muted,proj:[]},
    {n:2,nm:'Laboral (sobre personas)',desc:'Permissioned leverage — requiere gestión',carles:'Socio Rafa (red AEGS). Potencial: subcontratar ejecución GEO cuando escale.',st:'partial',stl:'PARCIAL',color:LEV.rel,proj:['Partnership Rafa']},
    {n:1,nm:'Físico-Temporal',desc:'Tiempo por dinero — techo inherente',carles:'Consultoría directa actual. Objetivo: reducir proporción progresivamente.',st:'current',stl:'OPERANDO AQUÍ',color:LEV.red,proj:['Consultoría hora','Rafa €300/mes']}
  ];
  let h=`<div class="lev-head"><div class="pre">LAS SIETE CAPAS — DE LO PRIMITIVO A LO EXPONENCIAL</div><h2>Tu Posición Actual</h2><div class="sub">La dirección es ascendente. StorageAI es el salto a Capa 5.</div></div>`;
  h+=`<div style="display:flex;flex-direction:column;gap:5px">`;
  layers.forEach(l=>{
    const on=levActiveLayer===l.n;
    h+=`<button class="lev-layer" style="${on?'background:'+l.color+'12;border-color:'+l.color+'44':''}" onclick="levActiveLayer=levActiveLayer===${l.n}?null:${l.n};showLeverage()">
      <div class="num" style="background:${l.color}22;border:2px solid ${l.color};color:${l.color}">${l.n}</div>
      <div style="flex:1"><div style="font-size:.88rem;color:${LEV.text};font-weight:500">${l.nm}</div><div style="font-size:.72rem;color:${LEV.dim}">${l.desc}</div></div>
      <span class="lev-st" style="color:${l.color};background:${l.color}18">${l.stl}</span></button>`;
    if(on){
      h+=`<div class="lev-detail" style="border-color:${l.color}">${l.carles}`;
      if(l.proj.length){h+=`<div class="tags">${l.proj.map(p=>`<span class="tag" style="color:${l.color};border-color:${l.color}33;background:${l.color}12">${p}</span>`).join('')}</div>`}
      h+=`</div>`}
  });
  h+=`</div>`;
  h+=`<div style="margin-top:16px;padding:12px;background:${LEV.gold}0a;border:1px solid ${LEV.gold}22;border-radius:8px;text-align:center">
    <div style="font-size:.72rem;color:${LEV.gold};font-weight:600">⬆ VECTOR DE MOVIMIENTO</div>
    <div style="font-size:.78rem;color:${LEV.dim};margin-top:4px">Capas 1-2 → Capas 4-5 (StorageAI + Framework GEO) → Capa 6-7 (pensamiento posicionado + marca)</div></div>`;
  return h;
}

// ═══ VISTA 3: STORAGEAI ═══
function renderStorageAI(){
  let h=`<div class="lev-head"><div class="pre">ANATOMÍA DE UNA PALANCA — CAPA 5</div><h2>StorageAI Analytics</h2><div class="sub">Software que funciona mientras duermes, con datos que nadie más tiene.</div></div>`;
  // Properties
  h+=`<div class="lev-grid3" style="margin-bottom:16px">`;
  [{p:'DISCIPLINA (rigidez)',v:'Dato propietario + moat 24-36 meses',d:'22.5M propiedades cruzadas con métricas RVC/IVM que nadie más calcula',pct:95,c:LEV.gold},
   {p:'ALCANCE (longitud)',v:'Todo el sector self-storage España',d:'Via red AEGS de Rafa → expansión multi-vertical (LocationIQ)',pct:70,c:LEV.cyan},
   {p:'SUSTANCIA (material)',v:'SaaS productizado con Stripe',d:'Next.js + MongoDB Atlas + 27 colecciones + auth por roles',pct:85,c:LEV.green}
  ].forEach(x=>{
    h+=`<div style="background:${LEV.card};border:1px solid ${LEV.border};border-radius:8px;padding:14px">
      <div style="font-family:JetBrains Mono;font-size:.58rem;letter-spacing:1.5px;color:${x.c};margin-bottom:6px">${x.p}</div>
      <div style="font-size:.82rem;color:${LEV.text};font-weight:500;margin-bottom:3px">${x.v}</div>
      <div style="font-size:.68rem;color:${LEV.dim};line-height:1.4;margin-bottom:10px">${x.d}</div>
      <div class="lev-bar"><div class="fill" style="width:${x.pct}%;background:linear-gradient(90deg,${x.c}66,${x.c})"></div></div></div>`});
  h+=`</div>`;
  // Fulcros that support it
  h+=`<div style="background:${LEV.card};border:1px solid ${LEV.border};border-radius:10px;padding:16px;margin-bottom:12px">
    <div style="font-size:.65rem;letter-spacing:2px;color:${LEV.gold};margin-bottom:12px">◆ FULCROS QUE SOSTIENEN ESTA PALANCA</div>`;
  [{t:'Material',c:LEV.mat,x:'Stack técnico completo + datos Catastro/INE cruzados + métricas propietarias'},
   {t:'Epistémico',c:LEV.epi,x:'Comprensión del sector (via Rafa) + analítica de datos + conocimiento LLMs para posicionar'},
   {t:'Relacional',c:LEV.rel,x:'Red AEGS via Rafa + credibilidad ADE ICADE + 2 centros propios como validación'}
  ].forEach(f=>{h+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${LEV.bg};border-radius:8px;border-left:3px solid ${f.c};margin-bottom:6px"><span style="font-size:.68rem;letter-spacing:1px;color:${f.c};font-weight:600;min-width:75px">${f.t}</span><span style="font-size:.78rem;color:${LEV.text}">${f.x}</span></div>`});
  h+=`</div>`;
  // Revenue
  h+=`<div style="background:${LEV.card};border:1px solid ${LEV.border};border-radius:10px;padding:16px">
    <div style="font-size:.65rem;letter-spacing:2px;color:${LEV.gold};margin-bottom:12px">€ MODELO DE INGRESOS (SPLIT CON RAFA)</div><div class="lev-grid4">`;
  [{p:'Free',pr:'0€',d:'3 informes — embudo captación'},{p:'Starter',pr:'49-79€',d:'Informes completos zona'},{p:'Professional',pr:'199-299€',d:'Analytics avanzados + API'},{p:'Enterprise',pr:'Custom',d:'Datos en tiempo real + soporte'}
  ].forEach(t=>{h+=`<div style="padding:10px;background:${LEV.bg};border-radius:8px;border:1px solid ${LEV.border};text-align:center"><div style="font-size:.72rem;font-weight:600;color:${LEV.gold}">${t.p}</div><div style="font-size:1.2rem;font-weight:300;color:${LEV.text};margin:4px 0">${t.pr}</div><div style="font-size:.65rem;color:${LEV.dim}">${t.d}</div></div>`});
  h+=`</div><div style="margin-top:10px;padding:10px;background:${LEV.gold}0a;border-radius:8px;text-align:center"><span style="font-size:.8rem;color:${LEV.gold}">Proyección Año 1: 20-50 clientes → 2.000-10.000€/mes</span></div></div>`;
  return h;
}

// ═══ VISTA 4: ALGO MÁS GRANDE ═══
function renderBiggerVision(){
  const fw=[
    {id:'storage',l:'StorageAI',sl:'SaaS Capa 5',feeds:'Genera datos, casos, revenue, credibilidad técnica',c:LEV.gold},
    {id:'location',l:'LocationIQ',sl:'Multi-Vertical',feeds:'Misma engine → gimnasios, coworking, dental, súpers, restaurantes',c:LEV.cyan},
    {id:'geo',l:'Consultoría GEO',sl:'Servicio Recurrente',feeds:'Clientes generan casos de estudio y revenue mensual',c:LEV.epi},
    {id:'thought',l:'Thought Leadership',sl:'Fulcro Epistémico',feeds:'Opúsculo, artículos, LinkedIn, Reddit → autoridad',c:LEV.purple},
    {id:'brand',l:'HNV / Marca',sl:'Fulcro Relacional',feeds:'Confianza → más clientes → más datos → más autoridad',c:LEV.rel}
  ];
  let h=`<div class="lev-head"><div class="pre">ALGO MÁS GRANDE — LA VISIÓN COMPLETA</div><h2>El Flywheel que se Alimenta Solo</h2><div class="sub">Cada pieza crea el fulcro de la siguiente. Apalancamiento compuesto.</div></div>`;
  // Flywheel nodes
  h+=`<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px">`;
  fw.forEach(n=>{
    const on=levExpandedNode===n.id;
    h+=`<div class="lev-flywheel-node" style="min-width:120px;${on?'border-color:'+n.c+';background:'+n.c+'10':''}" onclick="levExpandedNode=levExpandedNode==='${n.id}'?null:'${n.id}';showLeverage()">
      <div style="font-size:.82rem;font-weight:600;color:${n.c}">${n.l}</div>
      <div style="font-size:.65rem;color:${LEV.dim};margin-top:2px">${n.sl}</div></div>`});
  h+=`</div>`;
  // Center text
  h+=`<div style="text-align:center;margin-bottom:14px;padding:10px;background:${LEV.card};border:1px solid ${LEV.gold}33;border-radius:8px">
    <div style="font-size:.72rem;font-weight:600;color:${LEV.gold};letter-spacing:1.5px">CARLES GARCIA BACH</div>
    <div style="font-size:.65rem;color:${LEV.goldDim};font-style:italic;margin-top:2px">La palanca que crea su propio fulcro</div></div>`;
  if(levExpandedNode){const n=fw.find(x=>x.id===levExpandedNode);
    h+=`<div style="padding:12px;background:${LEV.card};border:1px solid ${n.c}33;border-radius:8px;text-align:center;margin-bottom:14px;font-size:.82rem;color:${LEV.text}">${n.feeds}</div>`}
  // LocationIQ vision
  h+=`<div style="background:linear-gradient(135deg,${LEV.card},${LEV.cyan}08);border:1px solid ${LEV.cyan}33;border-radius:10px;padding:18px;margin-bottom:12px">
    <div style="font-size:.65rem;letter-spacing:2px;color:${LEV.cyan};margin-bottom:8px">◈ LO MÁS GRANDE QUE VEO</div>
    <div style="font-family:'Playfair Display',serif;font-size:1.15rem;font-weight:300;color:${LEV.text};margin-bottom:6px">StorageAI no es el producto. Es el prototipo.</div>
    <div style="font-size:.8rem;color:${LEV.dim};line-height:1.6;margin-bottom:12px">La engine que construiste — Catastro + INE + métricas propietarias — funciona para <em>cualquier negocio dependiente de ubicación</em>. El moat es <strong style="color:${LEV.text}">la capacidad de cruzar 22.5M propiedades con inteligencia de demanda sectorial</strong>.</div>
    <div class="lev-grid6">`;
  [{v:'Self-Storage',s:'ACTIVO',i:'📦'},{v:'Gimnasios',s:'LISTO',i:'🏋️'},{v:'Coworking',s:'LISTO',i:'💻'},{v:'Dental',s:'LISTO',i:'🦷'},{v:'Supermercados',s:'LISTO',i:'🛒'},{v:'Restauración',s:'LISTO',i:'🍽️'}
  ].forEach((x,i)=>{h+=`<div style="padding:8px;background:${i===0?LEV.gold+'15':LEV.bg};border-radius:8px;border:1px solid ${i===0?LEV.gold+'44':LEV.border};text-align:center"><div style="font-size:1.2rem">${x.i}</div><div style="font-size:.72rem;color:${LEV.text};font-weight:500">${x.v}</div><div style="font-size:.6rem;color:${i===0?LEV.gold:LEV.muted}">${x.s}</div></div>`});
  h+=`</div></div>`;
  // Meta-palanca
  h+=`<div style="background:linear-gradient(135deg,${LEV.card},${LEV.purple}08);border:1px solid ${LEV.purple}33;border-radius:10px;padding:18px">
    <div style="font-size:.65rem;letter-spacing:2px;color:${LEV.purple};margin-bottom:8px">◇ LA META-PALANCA</div>
    <div style="font-size:.82rem;color:${LEV.text};line-height:1.7">
      <strong style="color:${LEV.gold}">StorageAI</strong> valida el modelo y genera revenue.
      <strong style="color:${LEV.cyan}">LocationIQ</strong> escala la engine a 6+ verticales.
      <strong style="color:${LEV.epi}">La consultoría GEO</strong> posiciona clientes en ecosistemas IA.
      <strong style="color:${LEV.purple}">El opúsculo</strong> establece la autoridad.
      <strong style="color:${LEV.rel}">HNV</strong> lo unifica todo.</div>
    <div style="margin-top:12px;padding:10px;background:${LEV.bg};border-radius:8px;text-align:center">
      <div style="font-size:.82rem;color:${LEV.gold};font-style:italic">No vendes software. No vendes consultoría.<br><strong>Vendes inteligencia de localización + visibilidad IA.</strong><br><span style="color:${LEV.dim};font-size:.72rem">Dos moats que se refuerzan mutuamente.</span></div></div></div>`;
  return h;
}

// ═══ VISTA 5: DIAGNÓSTICO ═══
function renderDiagnostics(){
  const palancas=[
    {nm:'Plantillas Looker Studio',ly:4,di:.8,al:.5,su:.85,f:['Material ✓','Epistémico ~','Relacional ~'],st:'activa',sc:LEV.green},
    {nm:'Metodología GEO 4 Pilares',ly:5,di:.9,al:.3,su:.95,f:['Material ✓','Epistémico △','Relacional △'],st:'infrautilizada',sc:LEV.rel},
    {nm:'StorageAI Analytics',ly:5,di:.85,al:.7,su:.9,f:['Material ✓✓','Epistémico ✓','Relacional ✓'],st:'activando',sc:LEV.gold},
    {nm:'Desarrollo Rápido MVPs',ly:4,di:.95,al:.4,su:.8,f:['Material ✓✓','Epistémico ~','Relacional ~'],st:'infrautilizada',sc:LEV.rel},
    {nm:'Conocimiento Multi-modelo',ly:6,di:.85,al:.2,su:.95,f:['Material ~','Epistémico △','Relacional △'],st:'sin distribuir',sc:LEV.red},
    {nm:'Caso Goitia',ly:6,di:.7,al:.6,su:.75,f:['Material ✓','Epistémico ✓','Relacional ✓'],st:'en progreso',sc:LEV.cyan},
    {nm:'Red AEGS (via Rafa)',ly:2,di:.6,al:.85,su:.7,f:['Material ~','Epistémico ~','Relacional ✓✓'],st:'activa',sc:LEV.green}
  ];
  let h=`<div class="lev-head"><div class="pre">DIAGNÓSTICO COMPLETO — CAPÍTULO 15 DEL OPÚSCULO</div><h2>Tus Palancas, Medidas</h2><div class="sub">✓✓ sólido · ✓ presente · ~ débil · △ <span style="color:${LEV.rel}">CUELLO DE BOTELLA</span></div></div>`;
  palancas.forEach(p=>{
    h+=`<div class="lev-diag"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div><span style="font-size:.88rem;color:${LEV.text};font-weight:500">${p.nm}</span>
      <span style="margin-left:8px;font-size:.6rem;padding:2px 6px;border-radius:4px;background:${p.sc}18;color:${p.sc};letter-spacing:.5px;font-family:JetBrains Mono">${p.st.toUpperCase()}</span></div>
      <span style="font-size:.65rem;color:${LEV.muted}">Capa ${p.ly}</span></div>`;
    h+=`<div class="row3">`;
    [{l:'Disciplina',v:p.di,c:LEV.gold},{l:'Alcance',v:p.al,c:LEV.cyan},{l:'Sustancia',v:p.su,c:LEV.green}].forEach(x=>{
      h+=`<div><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:.6rem;color:${LEV.dim}">${x.l}</span><span style="font-size:.6rem;color:${x.c}">${Math.round(x.v*100)}%</span></div>
        <div class="lev-bar"><div class="fill" style="width:${x.v*100}%;background:${x.v<.4?LEV.red:'linear-gradient(90deg,'+x.c+'66,'+x.c+')'}"></div></div></div>`});
    h+=`</div><div style="display:flex;gap:10px;font-size:.68rem;color:${LEV.dim};margin-top:4px">`;
    p.f.forEach(f=>{h+=`<span style="color:${f.includes('△')?LEV.rel:LEV.dim}">${f}</span>`});
    h+=`</div></div>`});
  // Pattern insight
  h+=`<div class="lev-insight" style="background:${LEV.rel}10;border:1px solid ${LEV.rel}33">
    <div style="font-size:.72rem;color:${LEV.rel};font-weight:600;margin-bottom:6px">△ PATRÓN DETECTADO: CUELLO DE BOTELLA EPISTÉMICO-RELACIONAL</div>
    <div style="font-size:.8rem;color:${LEV.text};line-height:1.7">Tus palancas más poderosas (GEO, Multi-modelo, Desarrollo) tienen sustancia y disciplina altas pero alcance bajo. El fulcro epistémico (que el mercado entienda qué ofreces) y el relacional (que confíen en ti) son los cuellos de botella. <strong style="color:${LEV.gold}">La distribución no es un "nice to have" — es el fulcro que falta.</strong></div></div>`;
  return h;
}

// ═══ JSON INJECTOR ═══
function showInject(){
  document.getElementById('injTA').value='';document.getElementById('injRes').textContent='';openM('injM')
}
async function doInject(){
  const ta=document.getElementById('injTA').value.trim();
  const res=document.getElementById('injRes');
  if(!ta){res.textContent='⚠ Pega el JSON aquí';res.style.color='var(--warn)';return}
  try{const payload=JSON.parse(ta);
    const r=await fetch(API+'/api/inject',{method:'POST',headers:ah(),body:JSON.stringify(payload)});
    const d=await r.json();
    if(d.success){res.style.color='var(--pl)';res.textContent=`✅ Inyectado: ${d.created.workspaces} workspaces, ${d.created.items} items, ${d.created.notes} notas`;
      await loadWs();toast('📥 JSON inyectado')}
    else{res.style.color='var(--warn)';res.textContent='Error: '+JSON.stringify(d)}
  }catch(e){res.style.color='var(--warn)';res.textContent='❌ JSON inválido: '+e.message}
}
function injectSample(){
  document.getElementById('injTA').value=JSON.stringify({
    "workspaces":[
      {"name":"Mi Proyecto","icon":"🚀","items":[
        {"type":"url","value":"https://ejemplo.com","label":"Revisar landing"},
        {"type":"note","value":"Preparar presentación","label":"Tarea importante"}
      ],"notes":[
        {"title":"Plan de acción","content":"## Objetivos\n- Punto 1\n- Punto 2\n\n## Próximos pasos\nDefinir timeline"}
      ]}
    ],
    "notes":[
      {"title":"Nota global","content":"Contenido de la nota...","workspaces":["Mi Proyecto"]}
    ]
  }, null, 2)
}
