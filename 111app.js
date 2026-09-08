const state={students:[],pdfDoc:null,loadingPdf:null,pdfJs:null,previewing:new Set()};
const $=id=>document.getElementById(id);
const normalize=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeName=s=>String(s||'student').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,60)||'student';

async function loadData(){
  const r=await fetch('students.json',{cache:'no-cache'});
  if(!r.ok)throw Error('data');
  state.students=await r.json();
}
function matches(s,nq){
  const name=normalize(s.name),cls=normalize(s.classRoll),adm=normalize(s.admissionRoll),reg=normalize(s.registrationNo);
  return name.includes(nq)||cls.includes(nq)||adm.includes(nq)||reg.includes(nq)||(nq.length===3&&cls.endsWith(nq));
}

function render(query=''){
  const q=query.trim();
  if(!q){
    $('status').textContent='';
    $('results').innerHTML='<div class="empty">সার্চ বক্সে নাম, রোল বা Admission Roll লিখুন।</div>';
    return;
  }
  const nq=normalize(q),hits=state.students.filter(s=>matches(s,nq));
  $('status').textContent=hits.length?`${hits.length} জন পাওয়া গেছে — প্রতিটির কার্ড নিচে Preview করুন`:'কোনো matching student পাওয়া যায়নি।';
  if(!hits.length){
    $('results').innerHTML='<div class="empty">এই নামে/রোলে কোনো Registration Card পাওয়া যায়নি।</div>';
    return;
  }
  $('results').innerHTML=hits.map((s,i)=>`<article class="result"><div class="preview-wrap"><div class="corner-mark" title="এই কার্ডটি দেখুন">✓</div><div class="preview" id="preview-${i}"><div class="preview-loading">কার্ড Preview হচ্ছে…</div></div><button class="zoom" data-index="${i}" type="button">🔍 বড় করে দেখুন</button></div><div class="identity"><div class="name">${esc(s.name)}</div><div class="meta"><span>পিতা: ${esc(s.father||'—')}</span><span>Class Roll: ${esc(s.classRoll||'—')}</span><span>Admission Roll: ${esc(s.admissionRoll)}</span><span>Registration No: ${esc(s.registrationNo)}</span></div><span class="tag ${s.inStudentList?'':'outside'}">${s.inStudentList?'Student List-এ আছে':'Student List-এর বাইরে · Card-এ আছে'} · Page ${s.page}</span><button class="download" data-index="${i}" type="button">PDF Download</button><div class="image-downloads"><button class="card-image-download" data-index="${i}" data-type="jpg" type="button">🖼️ JPG Download</button><button class="card-image-download" data-index="${i}" data-type="png" type="button">🖼️ PNG Download</button></div></div></article>`).join('');

  hits.forEach((s,i)=>renderPreview(s,i));
  [...$('results').querySelectorAll('.download')].forEach(b=>b.onclick=()=>downloadCard(hits[+b.dataset.index],b));
  [...$('results').querySelectorAll('.zoom')].forEach(b=>b.onclick=()=>openZoom(hits[+b.dataset.index]));
  [...$('results').querySelectorAll('.card-image-download')].forEach(b=>b.onclick=()=>downloadCardImage(hits[+b.dataset.index],b.dataset.type,b));
}

async function ensurePdf(){
  if(state.pdfDoc)return state.pdfDoc;
  if(!state.loadingPdf){
    state.loadingPdf=(async()=>{
      const r=await fetch('registration-cards.pdf',{cache:'no-cache'});
      if(!r.ok)throw Error('pdf');
      const bytes=await r.arrayBuffer();
      state.pdfDoc=await PDFLib.PDFDocument.load(bytes);
      return state.pdfDoc;
    })();
  }
  return state.loadingPdf;
}

async function ensurePdfJs(){
  if(state.pdfJs)return state.pdfJs;
  state.pdfJs=(async()=>{
    if(!window.pdfjsLib){
      await new Promise((resolve,reject)=>{
        const sc=document.createElement('script');
        sc.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        sc.onload=resolve;
        sc.onerror=reject;
        document.head.appendChild(sc);
      });
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const r=await fetch('registration-cards.pdf',{cache:'no-cache'});
    if(!r.ok)throw Error('pdf');
    return await window.pdfjsLib.getDocument({data:new Uint8Array(await r.arrayBuffer())}).promise;
  })();
  return state.pdfJs;
}

async function renderPreview(s,i){
  const box=$(`preview-${i}`);
  if(!box)return;
  try{
    const pdf=await ensurePdfJs(),page=await pdf.getPage(s.page);
    const base=page.getViewport({scale:1});
    const width=Math.min(360,box.clientWidth||320);
    const scale=width/base.width;
    const vp=page.getViewport({scale});
    const canvas=document.createElement('canvas');
    canvas.width=Math.floor(vp.width);canvas.height=Math.floor(vp.height);
    canvas.className='pdf-canvas';
    box.innerHTML='';box.appendChild(canvas);
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  }catch(e){
    box.innerHTML='<div class="preview-loading">Preview লোড করা যায়নি। Download বাটন ব্যবহার করুন।</div>';
    console.error(e);
  }
}

function openZoom(s){
  const cards=[...document.querySelectorAll('.result')];
  const target=cards.find(card=>card.querySelector('.name')?.textContent?.trim()===s.name);
  if(!target)return;
  const canvas=target.querySelector('.preview .pdf-canvas');
  if(!canvas)return;
  const z=Math.min(3,Math.max(1,parseFloat(canvas.dataset.zoom||'1')+.5));
  canvas.dataset.zoom=String(z);
  canvas.style.transformOrigin='top center';
  canvas.style.transform=`scale(${z})`;
  target.querySelector('.preview').scrollIntoView({behavior:'smooth',block:'center'});
}

/* Android/Messenger-friendly download:
   1) create a real Blob
   2) create an object URL
   3) use a user-gesture anchor click
   4) keep the URL alive long enough for WebView download interception
   5) if the WebView refuses downloads, open the same Blob URL in a new tab/window
      so the image/PDF remains accessible for Save/Download from the viewer.
*/
async function triggerBlobDownload(blob,filename){
  const url=URL.createObjectURL(blob);
  let clicked=false;
  try{
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    a.setAttribute('download',filename);
    a.rel='noopener';
    a.style.position='fixed';a.style.left='-9999px';a.style.width='1px';a.style.height='1px';
    document.body.appendChild(a);
    a.click();
    clicked=true;
    a.remove();

    /* Messenger/Android WebView may ignore <a download> for blob URLs.
       Do not revoke immediately; the WebView needs time to consume it. */
    setTimeout(()=>{
      try{
        if(document.visibilityState==='visible'){
          const opened=window.open(url,'_blank','noopener,noreferrer');
          if(!opened) {
            const fallback=document.createElement('a');
            fallback.href=url;fallback.target='_blank';fallback.rel='noopener';
            fallback.style.display='none';
            document.body.appendChild(fallback);fallback.click();fallback.remove();
          }
        }
      }catch(_){}
    },1200);

    setTimeout(()=>URL.revokeObjectURL(url),30000);
    return clicked;
  }catch(e){
    try{window.open(url,'_blank','noopener,noreferrer');}catch(_){}
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    return false;
  }
}

async function downloadCardImage(s,type,btn){
  const old=btn.textContent;
  btn.disabled=true;
  btn.textContent='Preparing…';
  try{
    const pdf=await ensurePdfJs();
    const page=await pdf.getPage(s.page);
    const vp=page.getViewport({scale:2.5});
    const canvas=document.createElement('canvas');
    canvas.width=Math.floor(vp.width);
    canvas.height=Math.floor(vp.height);
    const ctx=canvas.getContext('2d',{alpha:false});
    await page.render({canvasContext:ctx,viewport:vp,background:'white'}).promise;

    const mime=type==='png'?'image/png':'image/jpeg';
    const ext=type==='png'?'png':'jpg';
    const quality=type==='jpg'?0.96:undefined;
    const blob=await new Promise((resolve,reject)=>{
      canvas.toBlob(b=>b?resolve(b):reject(Error('blob')),mime,quality);
    });
    if(!blob||!blob.size)throw Error('empty blob');
    await triggerBlobDownload(blob,`registration-card-page-${s.page}-${safeName(s.name)}.${ext}`);
  }catch(e){
    alert('ছবিটি তৈরি বা Download করা যায়নি। আবার চেষ্টা করুন।');
    console.error(e);
  }finally{
    btn.disabled=false;
    btn.textContent=old;
  }
}

async function downloadCard(s,b){
  const old=b.textContent;
  b.disabled=true;
  b.textContent='Preparing…';
  try{
    const src=await ensurePdf();
    const out=await PDFLib.PDFDocument.create();
    const [p]=await out.copyPages(src,[s.page-1]);
    out.addPage(p);
    const bytes=await out.save();
    const blob=new Blob([bytes],{type:'application/pdf'});
    await triggerBlobDownload(blob,`registration-card-${safeName(s.admissionRoll)}-${safeName(s.name)}.pdf`);
  }catch(e){
    alert('PDF তৈরি বা Download করা যায়নি। আবার চেষ্টা করুন।');
    console.error(e);
  }finally{
    b.disabled=false;
    b.textContent=old;
  }
}

function doSearch(){
  const input=$('search');
  if(input)render(input.value);
}

$('searchBtn')?.addEventListener('click',doSearch);
$('search')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doSearch();}});
$('clearBtn')?.addEventListener('click',()=>{
  $('search').value='';
  render();
  $('search').focus();
});

loadData().then(()=>render()).catch(e=>{
  $('status').textContent='Data load error';
  $('results').innerHTML='<div class="empty">ডেটা লোড করা যায়নি।</div>';
  console.error(e);
});
