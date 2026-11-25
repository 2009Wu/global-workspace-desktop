'use strict';
const chronicleLabels = {
 'zh-Hans':'事件时间线|离开后发生了什么|新发布|已有报道的更新|来源报道|修订前|发现更新',
 'zh-Hant':'事件時間線|離開後發生了什麼|新發布|既有報導的更新|來源報導|修訂前|發現更新',
 en:'Event timeline|While you were away|New reports|Updated reports|Source report|Previous version|Change observed',
 fr:'Chronologie|Pendant votre absence|Nouveaux articles|Articles mis à jour|Publication|Version précédente|Modification observée',
 es:'Cronología|Durante tu ausencia|Nuevas publicaciones|Actualizaciones|Publicación|Versión anterior|Cambio observado',
 de:'Zeitverlauf|Während deiner Abwesenheit|Neue Meldungen|Aktualisierte Meldungen|Meldung|Vorherige Fassung|Änderung erfasst',
 ja:'時系列|前回終了後の動き|新着記事|更新された記事|発表|以前の版|更新を検出',
 ru:'Хронология|Пока вас не было|Новые публикации|Обновления|Публикация|Прошлая версия|Замечено изменение',
 ar:'التسلسل الزمني|أثناء غيابك|تقارير جديدة|تقارير محدثة|تقرير المصدر|النسخة السابقة|تغيير مرصود',
 pt:'Cronologia|Enquanto esteve fora|Novas notícias|Atualizações|Publicação|Versão anterior|Alteração observada',
 hi:'घटनाक्रम|आपकी अनुपस्थिति में|नई रिपोर्ट|बदली हुई रिपोर्ट|स्रोत की रिपोर्ट|पिछला संस्करण|बदलाव दर्ज',
 bn:'ঘটনাক্রম|আপনার অনুপস্থিতিতে|নতুন প্রতিবেদন|হালনাগাদ প্রতিবেদন|মূল প্রতিবেদন|আগের সংস্করণ|পরিবর্তন শনাক্ত',
 id:'Linimasa|Selama Anda pergi|Laporan baru|Laporan diperbarui|Laporan sumber|Versi sebelumnya|Perubahan teramati',
 ur:'واقعات کی ترتیب|آپ کی غیر موجودگی میں|نئی خبریں|تازہ کردہ خبریں|اصل رپورٹ|پچھلا نسخہ|تبدیلی دیکھی گئی',
 pcm:'Event timeline|Wetin happen as you comot|New reports|Reports wey change|Source report|Old version|Change we see',
 mr:'घटनाक्रम|तुमच्या अनुपस्थितीत|नवे वृत्त|बदललेले वृत्त|मूळ वृत्त|मागील आवृत्ती|बदल आढळला',
 vi:'Dòng thời gian|Trong khi bạn vắng mặt|Tin mới|Tin cập nhật|Bản tin gốc|Phiên bản trước|Ghi nhận thay đổi',
 te:'ఘటనల క్రమం|మీరు లేనప్పుడు|కొత్త కథనాలు|మారిన కథనాలు|మూల కథనం|మునుపటి రూపం|గమనించిన మార్పు',
 sw:'Mfuatano wa matukio|Ulipokuwa mbali|Habari mpya|Habari zilizosasishwa|Habari ya chanzo|Toleo la awali|Badiliko limeonekana',
 tr:'Olay zaman çizelgesi|Siz yokken|Yeni haberler|Güncellenen haberler|Kaynak haberi|Önceki sürüm|Değişiklik görüldü'
};
function cw(i){return (chronicleLabels[lang==='arz'?'ar':lang]||chronicleLabels.en).split('|')[i]}
const routineFeeds=new Set(['nasdaqComposite','fx','crypto','metar','buoy','adsb','ships','ferry','fr24','baltic','transits','alliance']);
function rememberRevision(e,prior){
 const now=new Date().toISOString();
 e.firstSeen=prior?.firstSeen||e.firstSeen||now;
 if(routineFeeds.has(e.feed)||!prior)return;
 e.history=prior.history||[];
 e.changedAt=prior.changedAt;
 if(e.title===prior.title&&e.summary===prior.summary&&e.severity===prior.severity)return;
 e.history=[{time:prior.changedAt||publicationTime(prior)||prior.time||prior.firstSeen,title:prior.title,summary:prior.summary,severity:prior.severity},...e.history].slice(0,8);
 e.changedAt=now;
}
let pendingTimeline=null,timelineStory=null;
function parseTimeline(raw){return raw?JSON.parse(raw):null}
function openTimeline(e){return rpc('window','timeline',e?JSON.stringify(storyBundle(e)):'')}
function setTimelineStory(e){
 timelineStory=e;
 if(e){const pick=$('timelinePick');if(!Array.from(pick.options).some(o=>o.value===e.id)){const o=new Option(e.title,e.id);o.dataset.feed=e.feed;pick.add(o,0)}pick.value=e.id}
 paintTimeline();
}
function startTimeline(raw){
 document.body.classList.add('timeline-window');
 $('timelinePage').hidden=false;$('refreshAll').hidden=true;$('headVersion').textContent='v'+version;
 const pick=$('timelinePick');
 new MutationObserver(syncTimelineTitle).observe($('timelineHeadline'),{childList:true,subtree:true});
 pick.onfocus=()=>channel.postMessage({type:'timelineOptionsRequest'});
 pick.onchange=()=>{const option=pick.selectedOptions[0];if(option)channel.postMessage({type:'timelineRequest',feed:option.dataset.feed,id:option.value,choose:true})};
 startDone=true;timelineStory=parseTimeline(raw);configureMenus();
 channel.postMessage({type:'timelineOptionsRequest'});
}
function configureTimeline(){
 for(const el of document.querySelectorAll('[data-t]'))el.textContent=t(el.dataset.t);
 $('timelinePick').ariaLabel=t('events');$('language').value=lang;document.title=cw(0);rpc('title',t('title')+' · '+cw(0));paintTimeline();
}
function localizeChronicle(){
 $('timelineOpen').textContent=cw(0);$('digestClose').textContent=t('close');$('digestTitle').textContent=cw(1);
 if($('returnDigest').open)paintDigest();
}
function syncTimelineTitle(){
 const option=$('timelinePick').selectedOptions[0],headline=$('timelineHeadline').firstElementChild;
 if(option&&option.value===timelineStory?.id&&headline?.dataset.translated)option.textContent=headline.textContent;
}
function showTimelineOptions(rows){
 const pick=$('timelinePick'),items=new Map();
 if(timelineStory)items.set(timelineStory.id,timelineStory);
 for(const row of rows)items.set(row.id,row);
 pick.replaceChildren();
 for(const row of items.values()){
  const label=translations.get(translationKey(row.title,lang,translationEngine(),(row.summary||'').slice(0,280)))||row.title;
  const option=new Option(label,row.id);option.dataset.feed=row.feed;pick.add(option);
 }
 pick.hidden=!items.size;
 if(timelineStory)pick.value=timelineStory.id;
 else if(pick.options.length)pick.onchange();
 syncTimelineTitle();
}
function entryKind(row,fallback){
 if(lang.startsWith('zh')||lang==='en'){
  if(/^(?:correction|corrigendum|更正|勘误|勘誤)\s*[:：—-]/i.test(row.title))return lang==='en'?'Correction':'更正';
  if(Object.hasOwn(officialSources,row.feed))return lang==='en'?'Source bulletin':lang==='zh-Hant'?'來源公告':'来源公告';
 }
 return fallback;
}
function timelineEntries(e){
 const url=e.links?.[0]?.url;
 const entries=(e.history||[]).map(h=>({...h,kind:cw(5),source:e.source,url}));
 entries.push({...e,kind:e.changedAt?cw(6):entryKind(e,cw(4)),time:e.changedAt||publicationTime(e)||e.time||e.firstSeen,url});
 for(const x of e.related||[])entries.push({...x,kind:rw(5)});
 const nodes=[],byTitle=new Map();
 for(const x of entries){
  const key=norm(x.title),links=(x.links||[{name:x.source,url:x.url}]).filter(s=>safeUrl(s.url));
  const matching=byTitle.get(key);
  if(matching && x.kind===rw(5)){
   for(const link of links)if(!matching.links.some(s=>s.url===link.url))matching.links.push(link);
   continue;
  }
  const node={...x,links:[...links],kind:x.kind===rw(5)?entryKind(x,rw(5)):x.kind};
  byTitle.set(key,node);nodes.push(node);
 }
 return nodes.sort((a,b)=>(Date.parse(a.time)||Infinity)-(Date.parse(b.time)||Infinity));
}
function paintTimeline(){
 const e=timelineStory;$('timelineLabel').textContent=cw(0);
 $('timelineHeadline').replaceChildren();$('timelineMeta').textContent='';$('timelineEntries').replaceChildren();
 if(!e){$('timelineHeadline').textContent=t('empty');return}
 $('timelineHeadline').append(translated(make('span'),e.title,e));$('timelineMeta').textContent=[e.source,e.firstSeen?rw(6)+' · '+localStamp(e.firstSeen,'full'):''].filter(Boolean).join('   /   ');
 for(const entry of timelineEntries(e)){
  const li=make('li'),meta=make('div','','chronicle-stamp');
  meta.append(make('time',localStamp(entry.time,'full')),make('span',entry.kind));
  li.append(meta,translated(make('h3'),entry.title,e));
  if(entry.summary)li.append(translated(make('p'),entry.summary,e));
  for(const link of entry.links)li.append(button((link.name||entry.source)+' ↗',()=>rpc('external',link.url),'chronicle-source'));
  $('timelineEntries').append(li);
 }
 observeTranslations();
}
let digestSince=0,digestOpened=0,digestChecked=false,digestTimer=0,digestSignature='',digestCutoff=Infinity;
function startDigest(previous){
 digestOpened=Date.now();
 const prior=Date.parse(previous);digestSince=prior>0&&prior<=digestOpened?prior:0;
 localizeChronicle();$('returnDigest').showModal();paintDigest();
}
function scheduleDigestPaint(){
 if(!$('returnDigest').open||digestTimer)return;
 digestTimer=setTimeout(()=>{digestTimer=0;paintDigest()},300);
}
function digestSections(rows,bookmarks,since,opened,checkedThrough){
 const pins=new Set(bookmarks.map(e=>e.id)),groups=[[],[]];
 for(const e of rows){
  if(routineFeeds.has(e.feed))continue;
  const published=Date.parse(publicationTime(e)),changed=Date.parse(e.changedAt);
  if(changed>since&&changed<=checkedThrough&&Date.parse(e.firstSeen)<=since)groups[1].push({e,time:changed,pin:pins.has(e.id)});
  else if(published>since&&published<=opened)groups[0].push({e,time:published,pin:pins.has(e.id)});
 }
 return groups.map(items=>{
  items.sort((a,b)=>Number(b.pin)-Number(a.pin)||b.time-a.time);
  const seen=new Set();return items.filter(({e})=>{
   const key=e.title.trim().toLowerCase(),url=e.links?.[0]?.url;
   if(seen.has(key)||(url&&seen.has(url)))return false;
   seen.add(key);if(url)seen.add(url);return true;
  });
 });
}
function paintDigest(){
 if(digestChecked&&!Number.isFinite(digestCutoff))digestCutoff=Date.now();
 const groups=digestSince?digestSections(Object.values(cache).flatMap(c=>c.records||[]),saved,digestSince,digestOpened,digestCutoff):[[],[]];
 // A first visit still offers recent articles while establishing a baseline.
 if(!digestSince){
  const recent=digestSections(Object.values(cache).flatMap(c=>c.records||[]),saved,digestOpened-86400000,digestOpened,0);
  groups[0]=recent[0];
 }
 const quote=cache.nasdaqComposite?.records?.[0];
 const now=Date.now();
 const indexNews=Object.values(cache).flatMap(c=>c.records||[]).filter(e=>!routineFeeds.has(e.feed)&&mentionsSP500(e))
   .map(e=>({e,time:Date.parse(publicationTime(e))})).filter(x=>x.time>now-86400000&&x.time<=now)
   .sort((a,b)=>b.time-a.time);
 const indexStories=[],indexTitles=new Set(),indexLinks=new Set();
 for(const item of indexNews){
   const title=item.e.title.trim().toLowerCase(),url=item.e.links?.[0]?.url;
   if(indexTitles.has(title)||(url&&indexLinks.has(url)))continue;
   indexTitles.add(title);if(url)indexLinks.add(url);indexStories.push(item);
   if(indexStories.length===2)break;
 }
 const overlapsIndex=e=>indexTitles.has(e.title.trim().toLowerCase())||indexLinks.has(e.links?.[0]?.url);
 const market=groups.flat().filter(({e})=>!overlapsIndex(e)).filter(({e})=>e.feed==='cnbcMarkets'||
   (chinaSources[e.feed]?.layer==='money'&&/股市|港股|[AH美中]股|[恒恆]指|[恒恆]生指[数數]|上[证證]指[数數]|深[证證]成指|[纳納]斯[达達][克剋]|[标標]普500|道[琼瓊]/i.test(e.title))
 ).sort((a,b)=>b.time-a.time).slice(0,3);
 const shown=new Set(market.map(x=>x.e.id));
 const signature=JSON.stringify([lang,digestChecked,quote?.time,quote?.quote,indexStories.map(x=>[x.e.id,x.e.title,x.e.summary,x.time]),market.map(x=>[x.e.id,x.e.title,x.time]),groups.map(g=>[g.length,...g.slice(0,15).map(x=>[x.e.id,x.e.title,x.time,x.pin])])]);
 if(signature===digestSignature)return;digestSignature=signature;
 const body=$('digestBody'),scroll=body.scrollTop;body.replaceChildren();
 if(quote?.quote||market.length||indexStories.length){
   const section=make('section'),zh=lang.startsWith('zh');
   section.append(make('h3',lang==='zh-Hant'?'股票市場':zh?'股票市场':'Stock market'));
   if(quote?.quote){
     const row=button('',()=>rpc('external',quote.links[0].url),'digest-row');
     const kind=quote.quote.live?(zh?'行情':'Quote'):(lang==='zh-Hant'?'延遲行情':zh?'延迟行情':'Delayed quote');
     row.append(make('small',quote.source+' · '+kind+' · '+localStamp(quote.time,'full')),make('strong',quoteHeadline(quote)));section.append(row);
   }
   const storyRow=({e,time})=>{
     const row=button('',()=>openTimeline(e),'digest-row');
     row.append(make('small',e.source+' · '+localStamp(time)),translated(make('strong'),e.title,e));return row;
   };
   if(indexStories.length){
     section.append(make('h4',lang==='zh-Hant'?'標普 500 · 近 24 小時':zh?'标普 500 · 近 24 小时':'S&P 500 · 24 h'));
     for(const item of indexStories)section.append(storyRow(item));
     if(market.length)section.append(make('h4',lang==='zh-Hant'?'其他市場消息':zh?'其他市场消息':'Market news'));
   }
   for(const item of market)section.append(storyRow(item));
   body.append(section);
 }
 groups.forEach((group,i)=>{
  group=group.filter(x=>!shown.has(x.e.id)&&!overlapsIndex(x.e));
  if(!digestSince&&i===1)return;
  const section=make('section');
  section.append(make('h3',cw(i+2)));
  if(!group.length)section.append(make('p',digestChecked?t('empty'):t('waiting'),'chronicle-muted'));
  for(const {e,time,pin} of group.slice(0,12)){
   const row=button('',()=>openTimeline(e),'digest-row');
   row.append(make('small',(pin?'★ '+t('saved')+' · ':'')+e.source+' · '+localStamp(i===0?publicationTime(e):time)),translated(make('strong'),e.title,e));section.append(row);
  }
  body.append(section);
 });
 body.scrollTop=scroll;observeTranslations();
}
