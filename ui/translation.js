'use strict';

// Cache public report text by original wording and target language across windows.
const translations=new Map(), translating=new Map(), failures=new Map();
let database;
function translationDB(){
  if(!database)database=new Promise(resolve=>{
    const req=indexedDB.open('report-translations',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('texts',{keyPath:'key'}).createIndex('time','time');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);
  });
  return database;
}
async function lookupText(key){
  if(translations.has(key))return translations.get(key);
  const db=await translationDB();if(!db)return '';
  return new Promise(resolve=>{
    const req=db.transaction('texts').objectStore('texts').get(key);
    req.onsuccess=()=>resolve(req.result?.value||'');req.onerror=()=>resolve('');
  });
}
async function rememberText(key,value){
  translations.set(key,value);if(translations.size>2500)translations.delete(translations.keys().next().value);
  const db=await translationDB();if(!db)return;
  const store=db.transaction('texts','readwrite').objectStore('texts');
  store.put({key,value,time:Date.now()});
  if(Math.random()<.02){
    const req=store.count();req.onsuccess=()=>{let extra=req.result-5000;if(extra<=0)return;
      const cur=store.index('time').openCursor();cur.onsuccess=()=>{if(cur.result&&extra-->0){cur.result.delete();cur.result.continue();}};};
  }
}
function translateReport(text,target){
  const key=target+'\n'+text;
  if(translating.has(key))return translating.get(key);
  const task=(async()=>{
    const cached=await lookupText(key);if(cached){translations.set(key,cached);return cached;}
    if((failures.get(key)||0)>Date.now())throw Error('Unavailable');
    const code=({'zh-Hans':'zh-CN','zh-Hant':'zh-TW'})[target]||target;
    const chunks=text.match(/[\s\S]{1,900}(?:\s+|$)|[\s\S]{1,900}/gu)||[];
    const parts=[];
    for(const part of chunks){
      const output=await rpc('translate',code,part);
      if(!output?.trim())throw Error('Empty translation');
      parts.push(output);
    }
    const result=parts.join(' ');await rememberText(key,result);return result;
  })().catch(err=>{failures.set(key,Date.now()+60000);throw err;}).finally(()=>translating.delete(key));
  translating.set(key,task);return task;
}
const waiting=new Set();
let translatingNodes=0;
function drainTranslations(){
  while(translatingNodes<3&&waiting.size){
    const el=waiting.values().next().value;waiting.delete(el);
    const original=el.dataset.original,target=el.dataset.target;
    if(!el.isConnected||target!==lang)continue;
    translatingNodes++;
    translateReport(original,target).then(value=>{
      if(el.isConnected&&lang===target){el.textContent=value;el.title=rw(7)+' · '+original;el.lang=target;el.dataset.translated='true';el.dataset.translationLabel=rw(7);}
    }).catch(()=>{
      if(el.isConnected&&lang===target){el.dataset.fallback=rw(8);el.title=rw(8)+' · '+t('error');}
    }).finally(()=>{translatingNodes--;drainTranslations();});
  }
}
const translationObserver=new IntersectionObserver(items=>{
  for(const item of items){const el=item.target;
    if(item.isIntersecting){translationObserver.unobserve(el);waiting.add(el);}
  }
  drainTranslations();
});
function translated(el,value,e){
  const text=String(value||'').trim();el.textContent=text;
  // Identifiers and instrument readings retain their source format.
  if(!text||['fx','crypto','buoy','metar','fr24','adsb','baltic','ships','ferry'].includes(e.feed)||
    (lang==='en'&&!['tg','x','relief'].includes(e.feed)))return el;
  const key=lang+'\n'+text;
  if(translations.has(key)){el.textContent=translations.get(key);el.title=rw(7)+' · '+text;el.dataset.translated='true';el.dataset.translationLabel=rw(7);return el;}
  el.dataset.original=text;el.dataset.target=lang;return el;
}
function observeTranslations(){
  translationObserver.disconnect();waiting.clear();
  for(const el of document.querySelectorAll('[data-original]:not([data-translated])'))translationObserver.observe(el);
}
