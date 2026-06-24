// Minimal demo: transfer records to 7 circles and route by recordCategory (MAIL | DOSSIER)
const circles = ['مكتب السيد المدير','المتابعة','التخطيط والمتابعة','الدراسات','ديوان الشؤون الفنية','القانونية','الديوان العام'];
// sample records
let records = [
  { id:1, type:'MAIL', title:'بريد وارد - طلب معلومات' },
  { id:2, type:'MAIL', title:'بريد صادر - رد مورد' },
  { id:3, type:'DOSSIER', title:'أضبارة مشروع تطوير' },
  { id:4, type:'MAIL', title:'بلاغ استقبال وشكاوى' },
  { id:5, type:'DOSSIER', title:'أضبارة دراسات بيئية' }
];
// Data structure: circleName -> { mail: [], dossier: [] }
const store = {};
circles.forEach(c => store[c] = { mail: [], dossier: [] });

// DOM
const recordsEl = document.getElementById('records');
const circlesEl = document.getElementById('circles');
const circleTitle = document.getElementById('circle-title');
const mailListEl = document.getElementById('mail-list');
const dossierListEl = document.getElementById('dossier-list');
const tabMail = document.getElementById('tab-mail');
const tabDossier = document.getElementById('tab-dossier');
let activeCircle = null;

function renderRecords(){
  recordsEl.innerHTML = '';
  records.forEach(r => {
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<div><strong>${r.title}</strong><div style="font-size:12px;color:#475569">نوع: ${r.type}</div></div>`;
    const wrap = document.createElement('div');
    const sel = document.createElement('select');
    circles.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='تحويل';
    btn.addEventListener('click',()=> doTransfer(r, sel.value));
    wrap.appendChild(sel); wrap.appendChild(btn); card.appendChild(wrap); recordsEl.appendChild(card);
  });
}

function renderCircles(){
  circlesEl.innerHTML = '';
  circles.forEach(c => {
    const card = document.createElement('div'); card.className='card';
    const counts = store[c];
    const badge = `<span class="badge">${counts.mail.length}</span>`;
    card.innerHTML = `<div>${c}</div><div>${badge}</div>`;
    card.addEventListener('click',()=> openCircle(c));
    circlesEl.appendChild(card);
  });
}

function openCircle(name){
  activeCircle = name; circleTitle.textContent = `دائرة: ${name}`;
  tabMail.classList.add('active'); tabDossier.classList.remove('active');
  mailListEl.classList.remove('hidden'); dossierListEl.classList.add('hidden');
  renderCircleLists();
}

tabMail.addEventListener('click', ()=>{ tabMail.classList.add('active'); tabDossier.classList.remove('active'); mailListEl.classList.remove('hidden'); dossierListEl.classList.add('hidden'); renderCircleLists(); });
tabDossier.addEventListener('click', ()=>{ tabDossier.classList.add('active'); tabMail.classList.remove('active'); dossierListEl.classList.remove('hidden'); mailListEl.classList.add('hidden'); renderCircleLists(); });

function renderCircleLists(){
  if(!activeCircle) return;
  const data = store[activeCircle];
  mailListEl.innerHTML = '';
  dossierListEl.innerHTML = '';
  data.mail.forEach(it=>{ const el=document.createElement('div'); el.className='card'; el.textContent = `${it.title} (id:${it.id})`; mailListEl.appendChild(el); });
  data.dossier.forEach(it=>{ const el=document.createElement('div'); el.className='card'; el.textContent = `${it.title} (id:${it.id})`; dossierListEl.appendChild(el); });
}

function doTransfer(record, circleName){
  // Do not duplicate: if record exists anywhere in that circle lists, ignore
  const existing = store[circleName].mail.concat(store[circleName].dossier).find(x=>x.id===record.id);
  if(existing){ alert('السجل موجود بالفعل في الدائرة المستلمة'); return; }
  // Attach recordCategory and route accordingly
  const payload = { ...record, recordCategory: record.type === 'DOSSIER' ? 'DOSSIER' : 'MAIL' };
  if(payload.recordCategory === 'DOSSIER') store[circleName].dossier.unshift(payload);
  else store[circleName].mail.unshift(payload);
  // update UI
  renderCircles();
  if(activeCircle===circleName) renderCircleLists();
  alert(`تم تحويل السجل (${record.title}) إلى ${circleName} كـ ${payload.recordCategory}`);
}

// init
renderRecords(); renderCircles();
