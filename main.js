
import './style.css';
const $ = s => document.querySelector(s);
const bn = n => new Intl.NumberFormat('bn-BD').format(Number(n||0));
let token=localStorage.getItem('ikhlas-token')||'', me=JSON.parse(localStorage.getItem('ikhlas-user')||'null');
let books=[], weekly=0, dhikrIndex=0, counts=JSON.parse(localStorage.getItem('ikhlas-tasbih')||'[0,0,0,0]');
const dhikrs=[
 {ar:'سُبْحَانَ اللَّهِ',bn:'সুবহানাল্লাহ',target:33},
 {ar:'الْحَمْدُ لِلَّهِ',bn:'আলহামদুলিল্লাহ',target:33},
 {ar:'اللَّهُ أَكْبَرُ',bn:'আল্লাহু আকবার',target:33},
 {ar:'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',bn:'লা হাওলা ওয়ালা কুয়াতা ইল্লা বিল্লাহ',target:1}
];
let toastTimer;
const toast=msg=>{ $('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);};
async function api(path,opts={}) {
 const headers={...(opts.headers||{})}; if(token) headers.Authorization=`Bearer ${token}`;
 const res=await fetch(path,{...opts,headers});
 const data=await res.json().catch(()=>({error:'সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি।'}));
 if(!res.ok) throw new Error(data.error||`Request failed (${res.status})`);
 return data;
}
function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.nav-link').forEach(v=>v.classList.toggle('active',v.dataset.view===id));$('#nav').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});if(id==='competition')refreshCompetition();if(id==='library')loadBooks();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
$('#menuBtn').onclick=()=>$('#nav').classList.toggle('open');

// Persistent light/dark appearance preference.
const savedTheme=localStorage.getItem('ikhlas-theme')||'light';
function applyTheme(theme){
 const dark=theme==='dark';
 document.documentElement.dataset.theme=dark?'dark':'light';
 $('#themeBtn').textContent=dark?'☀ লাইট':'☾ ডার্ক';
 $('#themeBtn').setAttribute('aria-label',dark?'লাইট থিম চালু করুন':'ডার্ক থিম চালু করুন');
 localStorage.setItem('ikhlas-theme',dark?'dark':'light');
}
applyTheme(savedTheme);
$('#themeBtn').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');

function renderTasbih(){
 const d=dhikrs[dhikrIndex],c=counts[dhikrIndex]||0;
 $('#dhikrName').textContent=d.ar;$('#dhikrBn').textContent=d.bn;$('#counter').textContent=bn(c);$('#target').textContent=bn(d.target);
 $('#tasbihProgress').textContent=`${bn(counts.reduce((a,b)=>a+b,0))} / ۱۰۰`;
 $('#counterRing').style.setProperty('--progress',`${Math.min(100,c/d.target*100)}%`);
 $('#dhikrChecklist').innerHTML=dhikrs.map((x,i)=>`<button class="dhikr-row ${i===dhikrIndex?'selected':''}" data-dhikr="${i}"><span class="check">${counts[i]>=x.target?'✓':'۞'}</span><span><b>${x.bn}</b><small>${bn(counts[i])} / ${bn(x.target)} বার</small></span><span class="row-arrow">›</span></button>`).join('');
 document.querySelectorAll('[data-dhikr]').forEach(b=>b.onclick=()=>{dhikrIndex=+b.dataset.dhikr;renderTasbih();});
}
function saveCounts(){localStorage.setItem('ikhlas-tasbih',JSON.stringify(counts));renderTasbih();}
$('#countBtn').onclick=()=>{counts[dhikrIndex]=Math.min(counts[dhikrIndex]+1,dhikrs[dhikrIndex].target);saveCounts();if(counts[dhikrIndex]===dhikrs[dhikrIndex].target)toast('আলহামদুলিল্লাহ! এই জিকিরের লক্ষ্য পূর্ণ হয়েছে।');};
$('#resetDhikr').onclick=()=>{counts[dhikrIndex]=0;saveCounts();};
$('#nextDhikr').onclick=()=>{dhikrIndex=(dhikrIndex+1)%dhikrs.length;renderTasbih();};renderTasbih();

function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function loadBooks(){try{books=(await api('/api/books')).books||[];renderBooks();}catch(e){$('#libraryGrid').innerHTML=`<div class="empty-state">${escapeHtml(e.message)}</div>`;}}
function renderBooks(){
 const q=($('#bookSearch').value||'').toLowerCase(),cat=$('#bookCategory').value;
 const list=books.filter(b=>(cat==='all'||b.category===cat)&&(`${b.title} ${b.author||''}`).toLowerCase().includes(q));
 $('#libraryGrid').innerHTML=list.length?list.map(b=>`<article class="book-card"><div class="book-cover"><span>﷽</span><small>${({novel:'ইসলামিক উপন্যাস',book:'ইসলামিক বই',hadith:'হাদিসগ্রন্থ'})[b.category]||'ইসলামিক বই'}</small></div><div class="book-info"><b>${escapeHtml(b.title)}</b><small>${escapeHtml(b.author||'লেখক উল্লেখ নেই')}</small><button class="read-btn" data-book="${b.id}">পড়ুন ↗</button></div></article>`).join(''):'<div class="empty-state">এখনো কোনো বই পাওয়া যায়নি।</div>';
 document.querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>openBook(b.dataset.book));
}
$('#bookSearch').oninput=renderBooks;$('#bookCategory').onchange=renderBooks;
async function openBook(id){const b=books.find(x=>x.id===id);if(!b)return;$('#readerTitle').textContent=b.title;$('#pdfFrame').src=`/api/book?id=${encodeURIComponent(id)}${token?'&session='+encodeURIComponent(token):''}`;$('#readerDialog').showModal();}
$('#closeReader').onclick=()=>{$('#readerDialog').close();$('#pdfFrame').src='about:blank';};

function setMe(user,newToken){me=user;token=newToken;localStorage.setItem('ikhlas-user',JSON.stringify(user));localStorage.setItem('ikhlas-token',token);$('#authBtn').textContent=user?.displayName||user?.username||'লগইন';$('#adminUpload').classList.toggle('hidden',user?.role!=='admin');$('#durudLoginHint').textContent=user?'আপনার দরুদ গণনা Netlify-তে সংরক্ষিত হবে।':'দরুদ প্রতিযোগিতায় অংশ নিতে লগইন করুন।';$('#profileForm [name=displayName]').value=user?.displayName||'';$('#profileForm').classList.toggle('hidden',!user);}
if(me){$('#authBtn').textContent=me.displayName||me.username;$('#adminUpload').classList.toggle('hidden',me.role!=='admin');$('#durudLoginHint').textContent='আপনার দরুদ গণনা Netlify-তে সংরক্ষিত হবে।';$('#profileForm [name=displayName]').value=me.displayName||'';}else $('#profileForm').classList.add('hidden');
$('#authBtn').onclick=()=>{if(me){if(confirm('লগআউট করতে চান?')){setMe(null,'');localStorage.removeItem('ikhlas-user');localStorage.removeItem('ikhlas-token');toast('লগআউট হয়েছে।');refreshCompetition();}}else $('#authDialog').showModal();};
let authMode='login';
$('#loginMode').onclick=()=>{authMode='login';$('#loginMode').classList.add('active');$('#registerMode').classList.remove('active');$('#displayNameInput').hidden=true;$('#authMessage').textContent='';};
$('#registerMode').onclick=()=>{authMode='register';$('#registerMode').classList.add('active');$('#loginMode').classList.remove('active');$('#displayNameInput').hidden=false;$('#authMessage').textContent='';};
$('#authForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);$('#authMessage').textContent='অপেক্ষা করুন...';try{const r=await api(authMode==='register'?'/api/register':'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:fd.get('username'),password:fd.get('password'),displayName:fd.get('displayName')})});setMe(r.user,r.token);$('#authMessage').textContent='সফলভাবে লগইন হয়েছে।';$('#profileForm').classList.remove('hidden');setTimeout(()=>$('#authDialog').close(),500);refreshCompetition();if(location.pathname.replace(/\/$/,'')==='/admin')routeAdmin();}catch(err){$('#authMessage').textContent=err.message;}};

$('#cleanDurudBtn').onclick=async()=>{
 if(me?.role!=="admin"){toast("শুধু অ্যাডমিন এই কাজ করতে পারবেন।");return;}
 if(!confirm("সতর্কতা: সবার প্রতিযোগিতার দরুদ গণনা স্থায়ীভাবে মুছে যাবে। সদস্য ও বই অক্ষত থাকবে। চালিয়ে যাবেন?"))return;
 const btn=$('#cleanDurudBtn'),status=$('#cleanDurudStatus');btn.disabled=true;status.textContent="ডেটা পরিষ্কার হচ্ছে...";
 try{const r=await api('/api/cleanup-durud',{method:'POST'});status.textContent=r.message||"ডেটা পরিষ্কার হয়েছে।";toast(status.textContent);await refreshCompetition();}
 catch(err){status.textContent=err.message;toast(err.message);}
 finally{btn.disabled=false;}
};

async function chunkedPdfUpload(form, statusEl){
 const fd=new FormData(form),file=fd.get('file'),title=String(fd.get('title')||'').trim();
 if(me?.role!=='admin')throw new Error('শুধু অ্যাডমিন বই আপলোড করতে পারবেন।');
 if(!title)throw new Error('বইয়ের নাম লিখুন।');
 if(!(file instanceof File)||file.size===0)throw new Error('আগে একটি PDF ফাইল নির্বাচন করুন।');
 if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error('শুধুমাত্র PDF ফাইল আপলোড করুন।');
 if(file.size>12*1024*1024)throw new Error('PDF ফাইলটি ১২ MB-এর মধ্যে রাখুন।');
 const init=await api('/api/admin/upload-init',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,author:String(fd.get('author')||''),category:String(fd.get('category')||'book'),size:file.size})});
 for(let i=0;i<init.totalChunks;i++){
  const begin=i*init.chunkSize,end=Math.min(file.size,begin+init.chunkSize),part=file.slice(begin,end);
  statusEl.textContent=`PDF আপলোড হচ্ছে... ${Math.round(end/file.size*100)}%`;
  await api(`/api/admin/upload-chunk/${init.uploadId}/${i}`,{method:'PUT',body:part});
 }
 statusEl.textContent='ফাইল সংরক্ষণ করা হচ্ছে...';
 await api(`/api/admin/upload-complete/${init.uploadId}`,{method:'POST'});
 form.reset();statusEl.textContent='বই সফলভাবে আপলোড হয়েছে।';
}
$('#uploadForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button[type=submit]');if(btn)btn.disabled=true;try{await chunkedPdfUpload(form,$('#cleanDurudStatus'));toast('বই আপলোড হয়েছে।');await loadBooks();}catch(err){toast(err.message||'PDF আপলোড করা যায়নি।');}finally{if(btn)btn.disabled=false;}};
$('#adminUploadForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button[type=submit]'),status=$('#adminUploadStatus');if(btn)btn.disabled=true;try{await chunkedPdfUpload(form,status);toast('বই আপলোড হয়েছে।');await loadAdminDashboard();await loadBooks();}catch(err){status.textContent=err.message||'PDF আপলোড করা যায়নি।';toast(status.textContent);}finally{if(btn)btn.disabled=false;}};

$('#profileForm').onsubmit=async e=>{e.preventDefault();if(!me)return;const displayName=new FormData(e.currentTarget).get('displayName');try{const r=await api('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName})});me=r.user;localStorage.setItem('ikhlas-user',JSON.stringify(me));$('#authBtn').textContent=me.displayName||me.username;$('#profileMessage').textContent='নাম সংরক্ষিত হয়েছে।';refreshCompetition();}catch(err){$('#profileMessage').textContent=err.message;}};

async function refreshCompetition(){
 try{
  const r=await api('/api/leaderboard');const data=r.entries||[];
  $('#competitionSummary').innerHTML=`<div><small>সবার মোট দরুদ</small><strong>${bn(r.totalCount||0)}</strong></div><div><small>অংশগ্রহণকারী</small><strong>${bn(r.totalParticipants||0)}</strong></div>`;
  $('#leaderboard').innerHTML=data.length?data.map((x,i)=>`<div class="leader-row"><span class="rank">${i+1}</span><span class="leader-avatar">${escapeHtml((x.displayName||'م').slice(0,1))}</span><span class="leader-person"><b>${escapeHtml(x.displayName||'ইখলাস সদস্য')}</b><small>এই সপ্তাহে পাঠ করেছেন</small></span><strong>${bn(x.total)} <small>বার</small></strong></div>`).join(''):'<div class="empty-state">এই সপ্তাহে এখনো কোনো দরুদ গণনা নেই। আপনিই শুরু করুন!</div>';
  weekly=r.mine||0;$('#myDurud').textContent=bn(weekly);
 }catch(e){$('#leaderboard').innerHTML=`<div class="empty-state">${escapeHtml(e.message)}</div>`;$('#myDurud').textContent='০';}
}
async function addDurud(){if(!me){toast('প্রতিযোগিতায় অংশ নিতে আগে লগইন করুন।');$('#authDialog').showModal();return;}try{const r=await api('/api/durud',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:1,dhikr:'ibrahim'})});weekly=r.mine;$('#myDurud').textContent=bn(weekly);refreshCompetition();}catch(e){toast(e.message);}}
$('#durudPlus').onclick=addDurud;$('#durudMinus').onclick=()=>toast('ভুল গণনা সংশোধনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন।');
setInterval(()=>{if($('#competition').classList.contains('active'))refreshCompetition();},30000);

async function loadAdminDashboard(){
 if(me?.role!=='admin'){ $('#adminGate').classList.remove('hidden');$('#adminContent').classList.add('hidden');$('#adminGateMessage').textContent=me?'এই অ্যাকাউন্টটি অ্যাডমিন নয়।':'প্রবেশ করতে অ্যাডমিন লগইন করুন।';return; }
 $('#adminGate').classList.add('hidden');$('#adminContent').classList.remove('hidden');
 try{const r=await api('/api/admin/dashboard');const st=r.stats||{};
 $('#adminStats').innerHTML=`<div class="admin-stat"><small>মোট সদস্য</small><strong>${bn(st.members)}</strong></div><div class="admin-stat"><small>লাইব্রেরির বই</small><strong>${bn(st.books)}</strong></div><div class="admin-stat"><small>দরুদ রেকর্ড</small><strong>${bn(st.durudRecords)}</strong></div>`;
 $('#adminBooksRows').innerHTML=(r.books||[]).map(b=>`<tr><td>${escapeHtml(b.title)}</td><td>${escapeHtml(b.author||'—')}</td><td>${({novel:'উপন্যাস',book:'ইসলামিক বই',hadith:'হাদিস'})[b.category]||'বই'}</td><td><button class="danger-btn admin-delete-btn" data-delete-book="${b.id}" type="button">Delete</button></td></tr>`).join('')||'<tr><td colspan="4">কোনো বই নেই।</td></tr>';
 $('#adminMembersRows').innerHTML=(r.members||[]).map(m=>`<tr><td>${escapeHtml(m.displayName)}</td><td>${escapeHtml(m.username)}</td><td>${m.role==='admin'?'অ্যাডমিন':'সদস্য'}</td></tr>`).join('')||'<tr><td colspan="3">কোনো সদস্য নেই।</td></tr>';
 document.querySelectorAll('[data-delete-book]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.deleteBook;if(!confirm('এই বই ও PDF স্থায়ীভাবে মুছে ফেলবেন?'))return;btn.disabled=true;try{await api(`/api/admin/book/${id}`,{method:'DELETE'});toast('বই মুছে ফেলা হয়েছে।');await loadAdminDashboard();await loadBooks();}catch(err){toast(err.message);}finally{btn.disabled=false;}});
 }catch(e){$('#adminStats').innerHTML=`<div class="empty-state">${escapeHtml(e.message)}</div>`;}
}
function routeAdmin(){if(location.pathname.replace(/\/$/,'')==='/admin'){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('#adminView').classList.add('active');document.querySelectorAll('.nav-link').forEach(v=>v.classList.remove('active'));if(me?.role==='admin')loadAdminDashboard();else if(!me)$('#authDialog').showModal();else loadAdminDashboard();}}
$('#adminLoginBtn').onclick=()=>$('#authDialog').showModal();$('#adminHomeBtn').onclick=()=>{history.pushState({},'', '/');showView('home');};$('#adminRefreshBtn').onclick=loadAdminDashboard;
$('#adminClearDurudBtn').onclick=async()=>{if(me?.role!=='admin')return toast('শুধু অ্যাডমিন এই কাজ করতে পারবেন।');if(!confirm('সবার দরুদ প্রতিযোগিতার সব রেকর্ড মুছে যাবে। সদস্য ও বই অক্ষত থাকবে। নিশ্চিত?'))return;const b=$('#adminClearDurudBtn');b.disabled=true;try{const r=await api('/api/cleanup-durud',{method:'POST'});$('#adminClearDurudStatus').textContent=r.message;toast(r.message);await loadAdminDashboard();await refreshCompetition();}catch(e){toast(e.message);}finally{b.disabled=false;}};
window.addEventListener('popstate',()=>{if(location.pathname.replace(/\/$/,'')==='/admin')routeAdmin();else showView('home');});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
loadBooks();refreshCompetition();routeAdmin();
