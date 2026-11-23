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
let localAIReady=false;
function translationEngine(){return localAIReady&&settings.translationEngine!=='standard'?'hymt15':'standard'}
function translationKey(text,target,engine=translationEngine()){return (engine==='standard'?'':engine+'\n')+target+'\n'+text}
function translateReport(text,target,engine=translationEngine()){
  const key=translationKey(text,target,engine);
  if(translating.has(key))return translating.get(key);
  const task=(async()=>{
    const cached=await lookupText(key);if(cached){translations.set(key,cached);return cached;}
    if((failures.get(key)||0)>Date.now())throw Error('Unavailable');
    const code=({'zh-Hans':'zh-CN','zh-Hant':'zh-TW'})[target]||target;
    const chunks=text.match(/[\s\S]{1,900}(?:\s+|$)|[\s\S]{1,900}/gu)||[];
    const parts=[];
    for(const part of chunks){
      const output=await rpc(engine==='standard'?'translate':'translateAI',code,part);
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
    const engine=translationEngine();
    let provider=engine;
    translateReport(original,target,engine).catch(error=>{
      if(engine==='standard')throw error;
      provider='standard';return translateReport(original,target,'standard');
    }).then(value=>{
      if(el.isConnected&&lang===target&&engine===translationEngine()){el.textContent=value;el.title=(provider==='standard'?rw(7):'HY-MT · AI')+' · '+original;el.lang=target;el.dataset.translated='true';el.dataset.translationLabel=provider==='standard'?rw(7):'AI';}
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
  if(!text||['alliance','fx','crypto','buoy','metar','fr24','adsb','baltic','ships','ferry'].includes(e.feed)||
    (lang==='en'&&!['tg','x','relief'].includes(e.feed)))return el;
  const key=translationKey(text,lang);
  if(translations.has(key)){const tag=translationEngine()==='standard'?rw(7):'AI';el.textContent=translations.get(key);el.title=tag+' · '+text;el.dataset.translated='true';el.dataset.translationLabel=tag;return el;}
  el.dataset.original=text;el.dataset.target=lang;return el;
}
function observeTranslations(){
  translationObserver.disconnect();waiting.clear();
  for(const el of document.querySelectorAll('[data-original]:not([data-translated])'))translationObserver.observe(el);
}

// Translate only visible labels that have no language-tagged gazetteer entry.
// Keep these cache entries separate from articles and from homonyms in other countries.
const placeQueue=new Map(),placeRetry=new Map();
let placeTimer=0,placeBusy=false;
function queuePlaceName(node,name,country,target){
 const key=['place-v1',country,target,name].join('\n');
 node.title=name;
 if(translations.has(key)){node.textContent=translations.get(key);return}
 if((placeRetry.get(key)||0)>Date.now())return;
 placeQueue.set(key,{key,node,name,target,country});
 if(!placeTimer&&!placeBusy)placeTimer=setTimeout(translateVisiblePlaces,100);
}
async function translateVisiblePlaces(){
 placeTimer=0;placeBusy=true;
 try{
  let batch=[];
  for(const [key,item] of placeQueue){
   if(!item.node.isConnected||item.target!==lang){placeQueue.delete(key);continue}
   if(batch.length&&item.country!==batch[0].country)continue;
   placeQueue.delete(key);
   const saved=await lookupText(key);
   if(saved){translations.set(key,saved);item.node.textContent=saved;continue}
   batch.push(item);if(batch.length===10)break;
  }
  if(!batch.length)return;
  try{
   const code=({'zh-Hans':'zh-CN','zh-Hant':'zh-TW'})[batch[0].target]||batch[0].target;
   const result=await rpc('translate',code,batch.map(item=>item.name).join('\n'));
   const lines=result.trim().split(/\r?\n/);
   if(lines.length!==batch.length)throw Error('Ambiguous labels');
   for(const [i,item] of batch.entries()){
    const value=lines[i].trim();if(!value)continue;
    await rememberText(item.key,value);
    if(item.node.isConnected&&lang===item.target){item.node.textContent=value;item.node.title=item.name;}
   }
  }catch{for(const item of batch)placeRetry.set(item.key,Date.now()+60000)}
 }finally{placeBusy=false;if(placeQueue.size)placeTimer=setTimeout(translateVisiblePlaces,180)}
}
