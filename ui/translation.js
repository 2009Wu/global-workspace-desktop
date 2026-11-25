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
function translationEngine(){return localAIReady&&settings.translationEngine!=='off'?fastModel:'off'}
const headlineWords=new Intl.Segmenter(undefined,{granularity:'word'});
function headlineContext(text,engine,context){
  if(!context||!engine.startsWith('Qwen3-14B'))return context;
  // Longer headlines carry their own facts. A shorter feed summary can hide one of their clauses.
  let count=0;
  for(const word of headlineWords.segment(text)){
    if(word.isWordLike && ++count>=9)return '';
  }
  return context;
}
function translationKey(text,target,engine=translationEngine(),context=''){
  const version=context&&engine.startsWith('Qwen3-14B')?'headline-v6':'local-v5';
  return JSON.stringify([version,engine,target,context,text]);
}
let modelWarmup;
function prepareRefreshTranslation(){
  if(translationEngine()==='off')return Promise.resolve('off');
  if(!modelWarmup){
    modelWarmup=(async()=>{
      await awaitQuiet();
      await rpc('warmTranslator');
      return 'ready';
    })().catch(error=>String(error).includes('Map active')?'deferred':'unavailable').finally(()=>{modelWarmup=null;});
  }
  return modelWarmup;
}
function translateReport(text,target,engine=translationEngine(),context='',reviewRisk=false){
  if(engine==='off')return Promise.reject(Error('Original'));
  const key=translationKey(text,target,engine,context);
  if(translating.has(key))return translating.get(key);
  const task=(async()=>{
    const cached=await lookupText(key);if(cached){translations.set(key,cached);return cached;}
    const failure=failures.get(key);
    if(failure?.until>Date.now())throw failure.error;
    failures.delete(key);
    const code=({'zh-Hans':'zh-CN','zh-Hant':'zh-TW'})[target]||target;
    const morningBid=target.startsWith('zh')&&/^Morning Bid\s*[:：]\s*(?=\S)/i.exec(text);
    const passage=morningBid?text.slice(morningBid[0].length):text;
    const chunks=passage.match(/[\s\S]{1,900}(?:\s+|$)|[\s\S]{1,900}/gu)||[];
    const parts=[];
    for(const part of chunks){
      await awaitQuiet();
      const payload=JSON.stringify({text:part,context:headlineContext(text,engine,context)});
      let output=await rpc(engine==='qwen-review'?'reviewText':'translateAI',code,payload);
      const issue=translationIssue(part,output||'',target);
      if(engine!=='qwen-review'&&canReview&&(issue||(reviewRisk&&!engine.startsWith('Qwen')))){
        await awaitQuiet();
        try{output=await rpc('reviewText',code,payload);}
        catch(error){if(issue||!String(error).includes('Insufficient free memory'))throw error;}
      }
      if(translationIssue(part,output||'',target))throw Error('Check original');
      if(!output?.trim())throw Error('Empty translation');
      parts.push(output);
    }
    const prefix=morningBid?(target==='zh-Hant'?'市場早報｜':'市场早报｜'):'';
    const result=prefix+parts.join(' ');await rememberText(key,result);return result;
  })().catch(err=>{
    if(!String(err).includes('Map active')&&!failures.has(key))failures.set(key,{error:err,until:Date.now()+60000});
    throw err;
  }).finally(()=>translating.delete(key));
  translating.set(key,task);return task;
}
const waiting=new Set(),observedText=new Set(),visibleText=new Set(),retryAt=new WeakMap();
let translatingNodes=0;
let drainTimer=0;
function showTranslation(el,value,original,target){
  el.textContent=value;el.title='AI · '+original;el.lang=target;
  el.dataset.translated='true';el.dataset.translationLabel='AI';
  delete el.dataset.fallback;delete el.dataset.pendingLabel;
}
function drainTranslations(){
  clearTimeout(drainTimer);
  if(quietDelay()>0){drainTimer=setTimeout(drainTranslations,Math.ceil(quietDelay()));return;}
  if(translatingNodes)return;
  let nextRetry=Infinity;
  // The selected report is what the reader is waiting for. Keep one model job at a time.
  const reading=[],headlines=[];
  for(const el of waiting)(el.closest('#briefBody, .location-card')?reading:headlines).push(el);
  for(const el of [...reading,...headlines]){
    const retry=retryAt.get(el)||0;
    if(retry>Date.now()){nextRetry=Math.min(nextRetry,retry);continue;}
    waiting.delete(el);
    const original=el.dataset.original,target=el.dataset.target;
    if(!visibleText.has(el)||!el.isConnected||target!==lang||el.dataset.translated)continue;
    translatingNodes++;
    const engine=translationEngine();
    translateReport(original,target,engine,el.dataset.context||'',el.dataset.review==='1').then(value=>{
      if(el.isConnected&&lang===target&&engine===translationEngine())showTranslation(el,value,original,target);
    }).catch(error=>{
      if(el.isConnected&&String(error).includes('Map active')){quietAt=performance.now()+1100;if(visibleText.has(el))waiting.add(el);return;}
      if(el.isConnected&&lang===target){
        const suspect=String(error).includes('Check original');
        delete el.dataset.pendingLabel;
        el.dataset.fallback=suspect?(lang.startsWith('zh')?'待核对':'Needs review'):rw(8);
        el.title=el.dataset.fallback+' · '+original;
        if(!suspect&&visibleText.has(el)&&engine===translationEngine()){
          retryAt.set(el,Date.now()+60000);waiting.add(el);
        }
      }
    }).finally(()=>{translatingNodes--;drainTranslations();});
    return;
  }
  if(Number.isFinite(nextRetry))drainTimer=setTimeout(drainTranslations,Math.max(1,nextRetry-Date.now()));
}
async function queueVisibleText(el){
  const {original,target,context}=el.dataset,engine=translationEngine();
  const cached=await lookupText(translationKey(original,target,engine,context||''));
  if(!el.isConnected||!visibleText.has(el)||target!==lang||engine!==translationEngine()||el.dataset.translated)return;
  if(cached){showTranslation(el,cached,original,target);return;}
  el.dataset.pendingLabel=(target==='zh-Hans'?'正在翻译':target==='zh-Hant'?'正在翻譯':rw(7))+'…';
  waiting.add(el);drainTranslations();
}
const translationObserver=new IntersectionObserver(items=>{
  for(const item of items){const el=item.target;
    if(!observedText.has(el))continue;
    if(item.isIntersecting&&!el.dataset.translated){visibleText.add(el);queueVisibleText(el);}
    else{visibleText.delete(el);waiting.delete(el);}
  }
  drainTranslations();
});
function translated(el,value,e){
  const text=String(value||'').trim();el.textContent=text;
  if(e.feed==='nasdaqComposite'&&e.quote){if(text===e.title)el.textContent=quoteHeadline(e);return el;}
  // Identifiers and instrument readings retain their source format.
  if(!text||['alliance','fx','crypto','buoy','metar','fr24','adsb','baltic','ships','ferry'].includes(e.feed)||
    (chinaSources[e.feed]?lang===chinaSources[e.feed].language:lang==='en'&&!['tg','x','relief'].includes(e.feed)))return el;
  if(translationEngine()==='off')return el;
  const context=text===e.title?(e.summary||'').slice(0,280):'';
  el.dataset.context=context;
  if(text===e.title&&/\b(?:impeach\w*|allegedly|unconfirmed|reportedly)\b/i.test(text))el.dataset.review='1';
  const key=translationKey(text,lang,translationEngine(),context);
  if(translations.has(key)){showTranslation(el,translations.get(key),text,lang);return el;}
  el.dataset.original=text;el.dataset.target=lang;return el;
}
function observeTranslations(){
  const dialog=document.getElementById('returnDigest');
  const surface=dialog?.open?dialog:document;
  for(const el of observedText){
    if(el.isConnected&&surface.contains(el)&&!el.dataset.translated)continue;
    translationObserver.unobserve(el);observedText.delete(el);visibleText.delete(el);waiting.delete(el);
  }
  for(const el of surface.querySelectorAll('[data-original]:not([data-translated])')){
    if(!observedText.has(el)){observedText.add(el);translationObserver.observe(el);}
  }
}

// Translate only visible labels that have no language-tagged gazetteer entry.
// Keep these cache entries separate from articles and from homonyms in other countries.
const placeQueue=new Map(),placeRetry=new Map();
let placeTimer=0,placeBusy=false;
function queuePlaceName(node,name,country,target){
 if(translationEngine()==='off')return;
 const key=['place-local-v2',translationEngine(),country,target,name].join('\n');
 node.title=name;
 if(translations.has(key)){node.textContent=translations.get(key);return}
 if((placeRetry.get(key)||0)>Date.now())return;
 placeQueue.set(key,{key,node,name,target,country});
 if(!placeTimer&&!placeBusy)placeTimer=setTimeout(translateVisiblePlaces,100);
}
async function translateVisiblePlaces(){
 placeTimer=0;
 if(document.getElementById('returnDigest')?.open)return;
 placeBusy=true;
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
   await awaitQuiet();
   const result=await rpc('translateAI',code,JSON.stringify({text:batch.map(item=>item.name).join('\n'),context:''}));
   const lines=result.trim().split(/\r?\n/);
   if(lines.length!==batch.length)throw Error('Ambiguous labels');
   for(const [i,item] of batch.entries()){
    const value=lines[i].trim();if(!value)continue;
    await rememberText(item.key,value);
    if(item.node.isConnected&&lang===item.target){item.node.textContent=value;item.node.title=item.name;}
   }
  }catch(error){for(const item of batch){if(String(error).includes('Map active')&&item.node.isConnected)placeQueue.set(item.key,item);else placeRetry.set(item.key,Date.now()+60000)}}
 }finally{placeBusy=false;if(placeQueue.size)placeTimer=setTimeout(translateVisiblePlaces,180)}
}
