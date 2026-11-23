'use strict';
const $=id=>document.getElementById(id);
const make=(tag,text='',cls='')=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el};
function button(label,fn,cls=''){const el=make('button',label,cls);el.onclick=()=>Promise.resolve().then(fn).catch(e=>notice(e.message));return el}
function notice(msg){$('notice').textContent=msg;$('notice').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').hidden=true,4000)}
const calls=new Map();let seq=0;
function rpc(cmd,arg='',val=''){return new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});chrome.webview.postMessage(JSON.stringify({id,cmd,arg,val}));});}
const view=new URLSearchParams(location.search).get('view')||'main';
let settings={},saved=[],selected=null,standalone=null,version='',state={},creds={},repo='',dismissed='',mode='events',region='001',layer='all',eventType='map',minLevel='any',filter='',countryLayers=new Map(),map,marks,satellite,labels,grid,markTimer,startDone=false;
let sizeX=64,sizeY=58,sessionDate=new Date(Date.now()-86400000).toISOString().slice(0,10);
const pendingFeeds=new Map();
const feedAttempts=new Map(), feedDigests=new Map();
const channel=new BroadcastChannel('workspace-sync'),cache={},status={},loading=new Set();
const regions={'001':[[4,8],2],'142':[[32,96],3],'150':[[52,15],4],'021':[[39,-102],3],'005': [[-16,-60],3],'002':[[2,18],3],'009':[[-22,144],3]};
const bounds={'142':[-11,25,78,180],'150':[34,-25,72,64],'021':[6,-170,85,-47],'005':[-57,-85,14,-32],'002':[-36,-26,38,62],'009':[-54,109,10,180]};
const continents={'142':'Asia','150':'Europe','021':'North America','005':'South America','002':'Africa','009':'Oceania'};
const paneTypes=['all','flash','air','sea','money','cyber','disaster','politics','conflict','sat','terrain','military'];
const eventTypes=paneTypes.filter(id=>id!=='terrain'&&id!=='military');
function validEventType(id){return eventTypes.includes(id)?id:'map';}
function listScope(){return eventType==='map'?layer:eventType;}
const features=countryFeatures.filter(f=>f.properties.iso!=='ATA').sort((a,b)=>a.properties.rank-b.properties.rank);
const countryNames=features.filter(f=>f.properties.en?.length>3).sort((a,b)=>b.properties.en.length-a.properties.en.length);
const escapeRe=s=>s.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
const matchers=countryNames.map(f=>[f,new RegExp('\\b'+escapeRe(f.properties.en)+'\\b','i')]);

function anchorNews(e){
 if(!e||Object.hasOwn(flashSources,e.feed)||Object.hasOwn(officialSources,e.feed)||!newsLayers.has(e.layer)||(e.location&&!e.anchor))return e;
 const place=explicitPlace(e.title)||explicitPlace((e.summary||'').split(/(?<=[.!?])\s/)[0]);
 if(place)return Object.assign(e,{area:''},place);
 if(e.anchor==='country'){e.location=null;delete e.anchor;delete e.iso;delete e.area;}
 if(e.location||areaInHeadline(e))return e;
 const text=e.title+' '+(e.summary||'').split(/[.!?]/)[0];
 const named=matchers.filter(([f,re])=>re.test(text)&&new RegExp('(?:\\b(?:in|across|throughout|hits|strikes)\\s+(?:(?:north(?:ern)?|south(?:ern)?|east(?:ern)?|west(?:ern)?|central|the)\\s+)*'+escapeRe(f.properties.en)+'\\b|^'+escapeRe(f.properties.en)+'\\s*:)','i').test(text));
 const f=named.length===1?named[0][0]:null;
 if(f)Object.assign(e,{location:[f.properties.lat,f.properties.lon],anchor:'country',iso:f.properties.iso});
 return e;
}
const regionCodes=['001','142','150','021','005','002','009'];
const regionText={'zh-Hans':'全球 亚洲 欧洲 北美洲 南美洲 非洲 大洋洲','zh-Hant':'全球 亞洲 歐洲 北美洲 南美洲 非洲 大洋洲',en:'World Asia Europe North_America South_America Africa Oceania',hi:'विश्व एशिया यूरोप उत्तर_अमेरिका दक्षिण_अमेरिका अफ्रीका ओशिनिया',es:'Mundo Asia Europa Norteamérica Sudamérica África Oceanía',ar:'العالم آسيا أوروبا أمريكا_الشمالية أمريكا_الجنوبية أفريقيا أوقيانوسيا',arz:'العالم آسيا أوروبا أمريكا_الشمالية أمريكا_الجنوبية أفريقيا أوقيانوسيا',fr:'Monde Asie Europe Amérique_du_Nord Amérique_du_Sud Afrique Océanie',bn:'বিশ্ব এশিয়া ইউরোপ উত্তর_আমেরিকা দক্ষিণ_আমেরিকা আফ্রিকা ওশেনিয়া',pt:'Mundo Ásia Europa América_do_Norte América_do_Sul África Oceania',id:'Dunia Asia Eropa Amerika_Utara Amerika_Selatan Afrika Oseania',ur:'دنیا ایشیا یورپ شمالی_امریکا جنوبی_امریکا افریقہ اوشیانا',ru:'Мир Азия Европа Северная_Америка Южная_Америка Африка Океания',de:'Welt Asien Europa Nordamerika Südamerika Afrika Ozeanien',ja:'世界 アジア ヨーロッパ 北アメリカ 南アメリカ アフリカ オセアニア',pcm:'World Asia Europe North_America South_America Africa Oceania',mr:'जग आशिया युरोप उत्तर_अमेरिका दक्षिण_अमेरिका आफ्रिका ओशिनिया',vi:'Thế_giới Châu_Á Châu_Âu Bắc_Mỹ Nam_Mỹ Châu_Phi Châu_Đại_Dương',te:'ప్రపంచం ఆసియా ఐరోపా ఉత్తర_అమెరికా దక్షిణ_అమెరికా ఆఫ్రికా ఓషియానియా',sw:'Dunia Asia Ulaya Amerika_Kaskazini Amerika_Kusini Afrika Oceania',tr:'Dünya Asya Avrupa Kuzey_Amerika Güney_Amerika Afrika Okyanusya'};
function regionName(id){if(regionCodes.includes(id))return regionText[lang].split(' ')[regionCodes.indexOf(id)].replaceAll('_',' ');try{const loc=lang==='pcm'?'en-NG':lang==='arz'?'ar-EG':lang;return new Intl.DisplayNames([loc],{type:'region'}).of(id);}catch{return id;}}
function countryName(f){return /^[A-Z]{2}$/.test(f.properties.iso2)?regionName(f.properties.iso2):lang.startsWith('zh')?f.properties.name:f.properties.en;}

function reportStamp(e,time){
 if(Object.hasOwn(flashSources,e.feed)&&time)return localStamp(time,'full');
 return fmt(time);
}
function eventTime(e){if(e.feed==='alliance')return e.time;return e.days?.[0]?.date||fmt(displayEventDate(e,e.time));}
function opt(el,val,name){el.add(new Option(name,val))}
function layouts(){document.documentElement.style.setProperty('--x',sizeX+'%');document.documentElement.style.setProperty('--y',sizeY+'%');}
function persistSession(){localStorage.setItem('desk:session',JSON.stringify({layer,region,eventType,minLevel,filter,sizeX,sizeY,sessionDate,imageryMode}));}
function putPref(){return rpc('write','settings',JSON.stringify(settings))}
function readLocal(id,fallback){try{return JSON.parse(localStorage.getItem(id))??fallback}catch{return fallback}}
function sendSelection(){channel.postMessage({type:'focus',layer,region,eventType,minLevel,filter,selected,sessionDate,imageryMode});persistSession();}
function configureMenus(){
 document.documentElement.lang=lang;document.documentElement.dir=['ar','arz','ur'].includes(lang)?'rtl':'ltr';document.title=t('title');rpc('title',t('title')+(view==='main'?'':' · '+t(view==='detail'?'details':view==='list'?'events':view))).catch(()=>{});
 document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));$('language').value=lang;$('query').placeholder=t('search');
 if(view==='main')for(const head of document.querySelectorAll('#workspace .panelhead')){
   head.title=paneDragHints[lang]||paneDragHints.en;
   head.setAttribute('aria-label',head.querySelector('h2').textContent+' · '+head.title);
 }
 if(view==='detail'){$('dismissDialog').title=t('close');document.querySelector('#briefPane h2').textContent=t('details');render();updateCard();return;}
 const r=$('region');r.replaceChildren();for(const id of Object.keys(regions).sort((a,b)=>a==='001'?-1:b==='001'?1:0))opt(r,id,regionName(id));const group=make('optgroup');group.label=t('region');
 features.map(f=>[f.properties.iso,countryName(f)]).sort((a,b)=>a[1].localeCompare(b[1],lang)).forEach(([id,name])=>group.append(new Option(name,id)));r.append(group);const sub=make('optgroup');sub.label=countryName(featuresByCode.get('CHN'))+' · '+t('region');for(const code of Object.keys(areas))sub.append(new Option(areaName(code),code));r.append(sub);r.value=region;r.ariaLabel=t('region');
 const layerSelect=$('layerSelect');layerSelect.replaceChildren();$('layers').replaceChildren();for(const key of paneTypes){opt(layerSelect,key,t(key));const b=button('',()=>setLayer(key));b.append(make('b',glyph[key]||'◎'),make('span',t(key)));b.dataset.layer=key;$('layers').append(b);}layerSelect.value=layer;layerSelect.ariaLabel=t('layer');
 const type=$('eventType');
 type.replaceChildren(new Option(t('followMapType'),'map'),new Option(t('allEventTypes'),'all'));
 for(const id of eventTypes)if(id!=='all')opt(type,id,t(id));
 type.value=eventType;
 $('level').replaceChildren();opt($('level'),'any',t('severity'));levelNames.forEach((n,i)=>opt($('level'),String(i),t(n)));$('level').value=minLevel;$('level').ariaLabel=t('severity');
 $('legend').replaceChildren(...levelNames.map((n,i)=>{const p=make('span','','legenditem');const dot=make('i','','dot');dot.style.background=colors[i];p.append(dot,make('span',t(n)));return p;}));
 document.querySelectorAll('.pop').forEach(b=>{b.title=t('detach');b.ariaLabel=t('detach');});$('refresh').title=t('refresh');$('imagery').title=t('date');$('dismissDialog').title=t('close');$('resetMap').title=t('map');$('settings').title=t('settings');
 if(view==='detail')document.querySelector('#briefPane h2').textContent=t('details');
 cityScene?.labels();imageryControls();render();scheduleCartography();updateCard();
 if(activeLocation&&locationPopup?.isOpen()&&locationPopup.reportLang!==lang)openLocation(activeLocation,false);
}
function initMap(){
 map=L.map('map',{preferCanvas:true,fadeAnimation:false,markerZoomAnimation:false,zoomAnimation:false,minZoom:1,maxZoom:19,zoomSnap:0,zoomDelta:.5,zoomControl:false,attributionControl:true,worldCopyJump:false,maxBounds:[[-86,-190],[86,190]],maxBoundsViscosity:.8}).setView([16,7],2);
 map.attributionControl.setPrefix(false);L.control.zoom({position:'bottomright'}).addTo(map);
 grid=L.layerGroup().addTo(map);for(let x=-180;x<=180;x+=30)L.polyline([[-85,x],[85,x]],{weight:.6,opacity:.32,color:'#6b909e',interactive:false,dashArray:'2,5'}).addTo(grid);
 for(let y=-60;y<=60;y+=30)L.polyline([[y,-180],[y,180]],{weight:.6,opacity:.32,color:'#6b909e',interactive:false,dashArray:'2,5'}).addTo(grid);
 readVector('places').then(data=>{cityData=data;if(desktopGlobe?.visible)desktopGlobe.redraw();else drawMap();}).catch(console.warn);
 marks=L.layerGroup().addTo(map);labels=L.layerGroup().addTo(map);
 map.on('moveend zoomend',()=>{clearTimeout(markTimer);markTimer=setTimeout(drawMap,85)});
 map.on('dragend',()=>{const c=map.getCenter();followMapCenter(c.lat,c.lng)});
 map.on('mousemove',e=>$('coords').textContent=e.latlng.lat.toFixed(2)+'° / '+e.latlng.lng.toFixed(2)+'°');
 new ResizeObserver(()=>{map.invalidateSize();}).observe($('mapWrap'));desktopGlobe=initDesktopGlobe();cityScene=initCityScene();frameRegion();
}
function frameRegion(){if(!map)return;desktopGlobe?.regionFocus();if(region==='001'){map.fitBounds([[-53,-173],[73,178]],{padding:[5,5],animate:false});}else if(regions[region])map.setView(...regions[region],{animate:false});else {const f=featuresByCode.get(region);if(f)map.fitBounds(leafletBounds(f),{maxZoom:8,padding:[14,14],animate:false});}if(cityScene?.active)cityScene.frameRegion();}
function inPolygon(coords,ll){const x=ll[1],y=ll[0];let inside=false;for(let i=0,j=coords.length-1;i<coords.length;j=i++){
 const [a,b]=coords[i],[c,d]=coords[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
function matchesRegion(e){
 if(region==='001')return true;
 if(!e.location)return false;
 if(featuresByCode.has(region)){
   if(e.anchor==='country'&&(e.area===region||e.iso===region))return true;
   return insideArea(region,e.location);
 }
 const b=bounds[region];return b&&e.location[0]>=b[0]&&e.location[0]<=b[2]&&e.location[1]>=b[1]&&e.location[1]<=b[3];}
function allRows(scope=layer){const seen=new Set();return (mode==='saved'?saved:Object.values(cache).flatMap(c=>c.records||[])).filter(e=>(scope==='all'||e.layer===scope||(['military','terrain'].includes(scope)&&['quake','eonet'].includes(e.feed))||(scope==='flash'&&Object.hasOwn(flashSources,e.feed))||(scope==='conflict'&&isConflict(e)))&&(minLevel==='any'||e.severity===+minLevel)&&matchesRegion(e)&&(!filter||(e.title+' '+e.source+' '+e.summary+' '+(translations.get(translationKey(e.title,lang))||'')).toLowerCase().includes(filter.toLowerCase()))).filter(e=>{if(!newsLayers.has(e.layer))return true;const key=e.links?.[0]?.url||e.id;if(seen.has(key))return false;seen.add(key);return true;});}
function sortRows(rows,scope=listScope()){
 if(sortByPublication){
  const ranked=rows.map(event=>{
   const date=Date.parse(publicationTime(event));
   return {event,time:Number.isFinite(date)?date:-Infinity};
  });
  ranked.sort((a,b)=>a.time===b.time?a.event.id.localeCompare(b.event.id):b.time-a.time);
  return ranked.map(item=>item.event);
 }
 return rows.sort((a,b)=>{if(scope==='all'&&mode!=='saved'){const obs=e=>['metar','buoy','fx','ferry','crypto','fr24','adsb','baltic','ships'].includes(e.feed)?1:0;const diff=obs(a)-obs(b);if(diff)return diff;}return b.time.localeCompare(a.time);});}
function drawMap(filtered){
 if(cityScene?.active){cityScene.update(Array.isArray(filtered)?filtered:allRows());return}
 if(desktopGlobe?.updateVisibility()){desktopGlobe.pinRecords(Array.isArray(filtered)?filtered:allRows());return}
 if(!map||!marks||$('mapPane').hidden)return;marks.clearLayers();labels.clearLayers();const rows=(Array.isArray(filtered)?filtered:allRows()).filter(e=>e.location&&(e.id===selected?.id||(layer!=='all'||mode==='saved'||!['buoy','fx','ferry','fr24','crypto','adsb','baltic','ships'].includes(e.feed))&&(layer!=='all'||e.feed!=='metar'||e.severity>=3)));const groups=new Map(),z=map.getZoom(),area=map.getBounds().pad(.08);
 const cell=settings.mapQuality==='smooth'?44:28;
 for(const e of rows){if(!area.contains(e.location))continue;const p=map.latLngToContainerPoint(e.location),g=z>=7?e.location.join(','):Math.floor(p.x/cell)+','+Math.floor(p.y/cell);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(e);}
 for(const group of groups.values()){const e=group.find(x=>x.id===selected?.id)||group.reduce((a,b)=>a.severity>=b.severity?a:b);
 const el=make('span',group.length>1?String(group.length):glyph[e.layer],'pin'+(group.length>1?' cluster':'')+(selected?.id===e.id?' sel':''));el.style.color=colors[e.severity];const icon=L.divIcon({className:'marker',html:el,iconAnchor:[10,10],iconSize:[20,20]});
 L.marker(e.location,{icon,title:e.title,keyboard:true}).addTo(marks).on('click',()=>openMarkerGroup(group,e));}
 paintPlaceLabels(z,area,[]);
 $('mapStats').textContent=t('map')+'  /  '+rows.length.toLocaleString(lang);
}
function followMapCenter(lat,lon,wide=false){
 if(region==='001'||(!wide&&matchesRegion({location:[lat,((lon+540)%360)-180]})))return;
 region='001';$('region').value=region;scheduleCartography();render();sendSelection();
}
function showWorldEvents(){
 mode='events';layer='all';region='001';eventType='map';minLevel='any';filter='';selected=null;
 $('query').value='';configureMenus();satLayer();frameRegion();render();sendSelection();
}
function emptyEvents(){
 const name=$('region').selectedOptions[0]?.textContent||regionName('001');
 const box=make('div','','empty');
 const criteria=[name,t(listScope()==='all'?'allEventTypes':listScope()),minLevel==='any'?'':t(levelNames[+minLevel]),filter].filter(Boolean);
 box.append(make('p',(mode==='saved'?t('saved')+' · ':'')+criteria.join(' · ')),make('p',t('empty')));
 if(mode==='saved'||region!=='001'||layer!=='all'||eventType!=='map'||filter||minLevel!=='any'){
  const label=lang==='zh-Hans'?'查看全球事件':lang==='zh-Hant'?'查看全球事件':regionName('001')+' · '+t('events');
  const reset=button(label,showWorldEvents);reset.className='primary';reset.dataset.action='world-events';box.append(reset);
 }
 return box;
}
function setRegion(id){map?.closePopup();region=regionCode(id);ensureGeometry(region);scheduleCartography();$('region').value=id;frameRegion();render();reveal($('mapWrap'));sendSelection();if(view==='main'&&['air','sea'].includes(layer))refresh(false);}
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
reduceMotion.addEventListener('change',()=>{
 if(reduceMotion.matches)for(const id of ['mapWrap','briefBody','rows'])$(id).getAnimations().forEach(a=>a.cancel());
});
function reveal(el){
 el.getAnimations().forEach(a=>a.cancel());
 if(reduceMotion.matches||settings.mapQuality==='smooth'||!el.getClientRects().length)return;
 el.animate([{opacity:.74,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:175,easing:'cubic-bezier(.2,.75,.3,1)'});
}
function moveLayerHighlight(){
 const nav=$('layers'),active=nav.querySelector('.on');
 nav.classList.toggle('has-selection',!!active);
 if(active){
   nav.style.setProperty('--highlight-y',active.offsetTop+'px');
   nav.style.setProperty('--highlight-height',active.offsetHeight+'px');
 }
}
function setLayer(id){if(layer===id&&mode==='events')return;map?.closePopup();layer=id;mode='events';selected=null;$('layerSelect').value=id;satLayer();render();$('rows').scrollTop=0;reveal($('rows'));reveal($('briefBody'));sendSelection();if(view==='main')refresh(false);}
let desktopGlobe=null,cityScene=null;
const publicationTimeFeeds=new Set(['bbc','un','france','aj','gdacs','unpeace','crisis','relief','shippingnews','ukrnews','recordnews','hibp','kev','tg','x','metar']);
function publicationTime(event){
 return event.publishedAt||(publicationTimeFeeds.has(event.feed)?event.time:'')||'';
}
const sortPreference='desk:sortByPublication';
let sortByPublication=readLocal(sortPreference,false)===true;
function setPublicationSort(enabled){
 sortByPublication=enabled;
 $('publicationSort').setAttribute('aria-pressed',String(enabled));
 render();
}
let listFilterKey='',listLimit=90;
function paintRows(records){
 const list=$('rows'),key=JSON.stringify([mode,layer,region,eventType,minLevel,filter,sortByPublication]);
 if(key!==listFilterKey){listLimit=90;list.scrollTop=0;listFilterKey=key;}
 const focus=list.contains(document.activeElement)?document.activeElement:null;
 const existing=new Map(Array.from(list.querySelectorAll('.row'),el=>[el.dataset.id,el]));
 const next=records.slice(0,listLimit).map(e=>{
   let row=existing.get(e.id);
   if(!row){
     row=button('',()=>selectEvent(row.record,true),'row');row.dataset.id=e.id;
     const text=make('span','','rowtext');text.append(make('span','','rowtitle'),make('span','','rowmeta'));
     row.append(make('span','','sym'),text);
   }
   if(row.record?.title!==e.title||row.dataset.lang!==lang||row.dataset.engine!==translationEngine()){
     row.querySelector('.rowtitle').replaceWith(translated(make('span','','rowtitle'),e.title,e));
   }
   row.record=e;row.dataset.lang=lang;row.dataset.engine=translationEngine();row.classList.toggle('selected',e.id===selected?.id);
   row.firstChild.textContent=glyph[e.layer];row.firstChild.style.color=colors[e.severity];
   row.querySelector('.rowmeta').textContent=e.source+'  ·  '+(sortByPublication?fmt(displayEventDate(e,publicationTime(e))):eventTime(e));
   return row;
 });
 if(!records.length)next.push(emptyEvents());
 if(records.length>listLimit){
   const more=button('＋ '+(records.length-listLimit),()=>{listLimit+=90;paintRows(records);observeTranslations();});
   more.id='more';next.push(more);
 }
 const keep=new Set(next);
 for(const el of Array.from(list.children))if(!keep.has(el))el.remove();
 next.forEach((el,i)=>{if(list.children[i]!==el)list.insertBefore(el,list.children[i]||null);});
 if(focus?.isConnected&&document.activeElement!==focus)focus.focus({preventScroll:true});
}
function render(){
 if(!startDone)return;if(view==='detail'){brief(standalone,true);observeTranslations();return;}$('savedTab').classList.toggle('on',mode==='saved');document.querySelectorAll('[data-layer]').forEach(b=>b.classList.toggle('on',mode!=='saved'&&b.dataset.layer===layer));$('mapScope').textContent=t(layer);
 moveLayerHighlight();
 $('topoBoundaryKey').hidden=layer!=='military';
 $('conflictTopics').hidden=layer!=='conflict';if(layer==='conflict'){const latest=cache.transits?.records?.[0];$('hormuzTopic').textContent=(lang==='zh-Hans'?'霍尔木兹海峡':lang==='zh-Hant'?'荷姆茲海峽':'Strait of Hormuz')+(latest?'  ·  '+latest.time.slice(0,10):'');$('ukraineTopic').textContent=regionName('UA');}
 const filtered=allRows();const rows=sortRows(listScope()===layer?filtered.slice():allRows(listScope()));if(view!=='detail'&&(!selected||!rows.some(e=>e.id===selected.id)))selected=rows[0]||null;
 $('counter').textContent=rows.length.toLocaleString(lang);paintRows(rows);
 if(selected&&(selected.feed==='alliance'||selected.feed==='metar'||selected.disclosure||Object.hasOwn(flashSources,selected.feed)||Object.hasOwn(officialSources,selected.feed)))selected=rows.find(e=>e.id===selected.id)||selected;
 brief(selected,false);observeTranslations();drawMap(filtered);updateFeedStatus();}
function updateFeedStatus(){const ok=Object.keys(status).filter(k=>status[k]==='online').length;$('feedStatus').textContent=t('sourceState')+'  '+ok+' / '+Object.keys(status).length+'   ·   '+t(mode==='saved'?'saved':'events');
 if($('dialog').open&&$('dialog').dataset.page==='sources')sourcesScreen();
}
function selectEvent(e,pan){
 const changed=selected?.id!==e.id;
 const focusedRow=document.activeElement?.closest('#rows .row');
 selected=e;map?.closePopup();
 for(const row of $('rows').querySelectorAll('.row'))row.classList.toggle('selected',row.dataset.id===e.id);
 brief(e,false);observeTranslations();drawMap();
 if(changed){$('briefBody').scrollTop=0;reveal($('briefBody'));}
 sendSelection();if(pan&&e.location)locateFromBrief(e);
 if(focusedRow?.isConnected&&document.activeElement!==focusedRow)focusedRow.focus({preventScroll:true});
}
function brief(e,full){const box=$('briefBody');box.replaceChildren();if(!e){box.append(make('div',t('empty'),'empty'));return;}
 const info=make('article','','info'),pill=make('span',t(levelNames[e.severity]),'pill');pill.style.color=colors[e.severity];info.append(pill,translated(make('h3'),e.title,e),make('div',e.source+' · '+(Object.hasOwn(flashSources,e.feed)?reportStamp(e,e.publishedAt):eventTime(e)),'stamp'));
 if(e.disclosure){
   const zh=lang.startsWith('zh'),traditional=lang==='zh-Hant',hibp=e.feed==='hibp';
   const published=zh?(hibp?(traditional?'目錄收錄':'目录收录'):(traditional?'報道發布':'报道发布')):(hibp?'Catalogue entry':'Reported');
   const happened=zh?(traditional?'事發日期':'事发日期'):'Incident date';
   info.append(make('div',published+' · '+localStamp(e.time,'full'),'stamp'),make('div',happened+' · '+(e.incidentDate|| (zh?(traditional?'來源未列明日期':'来源未列明日期'):'No date specified')),'stamp'));
   if(e.attribution)info.append(make('small',e.attribution));
   if(hibp&&!full)info.append(button(e.source,()=>rpc('external',e.links[0].url),'sourcebutton'));
 }
 if(e.summary)info.append(make('h4',rw(3)),translated(make('p'),e.summary,e));
 if(full&&e.excerpt&&!e.excerpt.startsWith(e.summary)&&!e.summary?.includes(e.excerpt))info.append(translated(make('p'),e.excerpt,e));
 if(full&&e.article){const a=e.article;if(a.byline||a.date)info.append(make('div',[a.byline,a.date?t('updated')+' · '+fmt(a.date):''].filter(Boolean).join('  /  '),'stamp'));for(const s of a.excerpts)info.append(translated(make('p'),s,e));}
 if(e.days?.length)info.append(transitHistory(e.days,full));
 if(full&&e.firstSeen)info.append(make('div',rw(6)+' · '+reportStamp(e,e.firstSeen),'stamp'));
 if(full&&lang!=='en'){const raw=make('details','','original-story');raw.append(make('summary',rw(4)),make('strong',e.title),make('p',e.summary));info.append(raw);}
 if(full&&e.related?.length){info.append(make('h4',rw(5)));for(const x of e.related){const link=button('',()=>rpc('external',x.url),'sourcebutton');info.append(link,make('small',x.source+' · '+fmt(x.time),'stamp'));translated(link,x.title,e);}}
 if(e.feed==='metar'&&e.flightCategory)info.append(make('small','METAR · '+e.flightCategory,'stamp'));
 const locationInfo=locationBlock(e);if(e.location)locationInfo.append(button(locText(3),()=>locateFromBrief(e)));info.append(locationInfo);
 if(full&&e.history?.length){info.append(make('h4',t('updated')));for(const h of e.history)info.append(make('div',fmt(h.time),'stamp'),translated(make('p'),h.title+' · '+h.summary,e));}
 if(full){info.append(make('h4',t('sources')));for(const link of e.links||[])if(safeUrl(link.url)){const a=button(link.name+' · '+new URL(link.url).hostname,()=>rpc('external',link.url),'sourcebutton');info.append(a);}
 if(e.media?.length){info.append(make('h4',t('media')));for(const media of e.media){if(!safeUrl(media.url))continue;const m=make(media.type==='video'?'video':'img','','media');m.src=media.url;m.referrerPolicy='no-referrer';if(media.type==='video'){m.controls=true;m.preload='metadata';}else{m.alt=e.title;m.loading='lazy';m.decoding='async';}info.append(m,button(e.source,()=>rpc('external',media.url),'sourcebutton'));}}}
 const actions=make('div','','actions');if(!full)actions.append(button(t('details'),()=>showStory(e),'action'));
 const stored=saved.some(x=>x.id===e.id);actions.append(button(t(stored?'remove':'save'),()=>rpc('bookmark',stored?'remove':'add',JSON.stringify(e))));info.append(actions);box.append(info);
}
function noticeError(err){notice(err.message||String(err));}
function cacheWrite(id,entry){dirtyFeeds.add(id);cache[id]=entry;try{localStorage.setItem('desk:feed:'+id,JSON.stringify(entry));}catch{}}
function fetchOne(id,force){
 if(pendingFeeds.has(id))return pendingFeeds.get(id);
 const task=readOneFeed(id,force).finally(()=>pendingFeeds.delete(id));pendingFeeds.set(id,task);return task;
}
async function readOneFeed(id,force){
 if(loading.has(id))return;let arg='';if(id==='adsb'||id==='ships'){if(id==='ships'&&!creds.ships)return;
 const hubs={'001':[40.64,-73.78],'142':[35.55,139.78],'150':[50.03,8.57],'021':[41.98,-87.91],'005':[-23.43,-46.47],'002':[-26.14,28.25],'009':[-33.94,151.18]};
 const center=map.getCenter(),p=map.getZoom()<4&&hubs[region]?(id==='adsb'?hubs[region]:region==='001'?[1.25,103.84]:[center.lat,center.lng]):[center.lat,center.lng];arg=p.map(v=>v.toFixed(2)).join(',');}
 if(id==='fr24'){if(!creds.fr24)return;const b=map.getBounds();arg=[Math.min(85,b.getNorth()),Math.max(-85,b.getSouth()),Math.max(-180,b.getWest()),Math.min(180,b.getEast())].map(x=>x.toFixed(2)).join(',');}if(id==='x'){if(!creds.x)return;arg=settings.xQuery||'';}if(id==='tg'){arg=(settings.tg||'').replace(/^@/,'').trim();if(!arg)return;}
 const existing=cache[id];const attempt=feedAttempts.get(id);
 if(!force&&attempt?.arg===arg&&Date.now()-attempt.time<FEED_INTERVAL_MS)return;
 feedAttempts.set(id,{arg,time:Date.now()});
 loading.add(id);status[id]='waiting';try{
 if(Object.hasOwn(flashSources,id)){
  const snapshot=await fetchFlash(id);
  const records=mergeFlash(id,snapshot),current=cache[id],prior=new Map((current?.records||[]).map(e=>[e.id,e]));
  for(const row of records)row.firstSeen=prior.get(row.id)?.firstSeen||row.firstSeen||new Date().toISOString();
  const digest=JSON.stringify(records);
  if(!current||feedDigests.get(id)!==digest){cacheWrite(id,{records,fetched:Date.now(),arg});feedDigests.set(id,digest)}
  else current.fetched=Date.now();
  status[id]='online';return;
 }
 const known=existing?.arg===arg&&existing.parserVersion===version?existing.signature||'':'';
 const {raw,signature}=await rpc('checkFeed',id,JSON.stringify({arg,known}));
 if(raw===null){existing.fetched=Date.now();status[id]='online';return}
 const records=parseFeed(id,raw).map(anchorNews);const old=new Map((existing?.records||[]).map(e=>[e.id,e]));
 for(const e of records){const prior=old.get(e.id);e.firstSeen=prior?.firstSeen||new Date().toISOString();if(!['disaster','politics','conflict','cyber','sat'].includes(e.layer))continue;e.history=prior?.history||[];if(prior&&(prior.title!==e.title||prior.summary!==e.summary||prior.severity!==e.severity)){e.history=[{time:prior.time,title:prior.title,summary:prior.summary},...e.history].slice(0,5);}}
 if(id==='recordnews'||(catalogs[id][0]==='conflict'&&id!=='transits')){
   const present=new Set(records.map(e=>e.id)),cutoff=Date.now()-30*86400000;
   records.push(...Array.from(old.values()).filter(e=>!present.has(e.id)&&Date.parse(e.time)>cutoff).sort((a,b)=>b.time.localeCompare(a.time)).slice(0,Math.max(0,120-records.length)));
 }
 cacheWrite(id,{records,fetched:Date.now(),arg,signature,parserVersion:version});status[id]='online';}
 catch(e){status[id]=existing?'cached':'error';console.warn(id,e.message);}finally{loading.delete(id);scheduleFeedDisplay();}
}
const dirtyFeeds=new Set();
let displayTimer=0,lastDisplay=0;
function scheduleFeedDisplay(){
 if(displayTimer)return;
 // Keep a fixed presentation deadline even when other sources keep arriving.
 const delay=Math.max(0,140-(performance.now()-lastDisplay));
 displayTimer=setTimeout(flushFeedDisplay,delay);
}
function flushFeedDisplay(){
 clearTimeout(displayTimer);displayTimer=0;lastDisplay=performance.now();
 const ids=Array.from(dirtyFeeds);dirtyFeeds.clear();
 if(ids.length)render();else updateFeedStatus();
 channel.postMessage({type:'feeds',status,ids});
 if(manualBusy&&manualProgress){
  showRefreshState(true,null,manualProgress);
  channel.postMessage({type:'manualRefresh',busy:true,progress:manualProgress});
 }
}
function enabledFeeds(){
 const scope=listScope();
 const priority=id=>{
  if((scope==='flash'&&Object.hasOwn(flashSources,id))||catalogs[id][0]===scope)return 0;
  return Object.hasOwn(flashSources,id)||['bbc','un','france','aj'].includes(id)?1:2;
 };
 return Object.keys(catalogs).filter(id=>{
  if(['fr24','ships','x'].includes(id))return !!creds[id];
  return id!=='tg'||!!settings.tg?.replace(/^@/,'').trim();
 }).sort((a,b)=>priority(a)-priority(b));
}
async function refresh(force){
 if(!startDone)return;
 if(view!=='main'){channel.postMessage({type:'refresh',force});return;}
 await Promise.all(enabledFeeds().map(id=>fetchOne(id,force)));
}
let manualBusy=false,manualProgress=null;
function showRefreshState(busy,summary,progress){
 manualBusy=busy;
 for(const id of ['refreshAll','refresh']){
  $(id).disabled=busy;
  $(id).setAttribute('aria-busy',String(busy));
 }
 $('refreshAll').textContent=t('refreshAll')+(busy?(progress?' '+progress.done+'/'+progress.total:' …'):'');
 if(summary)notice(t('sourceState')+' · '+t('online')+' '+summary.online+' / '+summary.total);
}
async function manualRefresh(){
 if(!startDone||manualBusy)return;
 if(view!=='main'){showRefreshState(true);channel.postMessage({type:'refresh'});return}
 const ids=enabledFeeds();
 manualProgress={done:0,total:ids.length};
 showRefreshState(true,null,manualProgress);
 channel.postMessage({type:'manualRefresh',busy:true,progress:manualProgress});
 try{
  // Map measurements refresh independently of the event feeds.
  desktopGlobe?.refreshNetwork()?.catch(console.warn);
  await Promise.allSettled(ids.map(id=>fetchOne(id,true).finally(()=>{manualProgress.done++;scheduleFeedDisplay()})));
 }finally{
  manualProgress=null;
  flushFeedDisplay();
  const summary={online:ids.filter(id=>status[id]==='online').length,total:ids.length};
  showRefreshState(false,summary);channel.postMessage({type:'manualRefresh',busy:false,summary});
 }
}
function restoreFeed(id){const v=readLocal('desk:feed:'+id,null);if(v){v.records=(v.records||[]).map(upgradeRecord).map(anchorNews);cache[id]=v;status[id]||='cached';}}
function showDialog(page,title){const d=$('dialog');d.dataset.page=page;$('dialogTitle').textContent=t(title);$('dialogBody').replaceChildren();if(!d.open)d.showModal();return $('dialogBody');}
function sourcesScreen(){const body=showDialog('sources','sourceState');for(const [id,[type,name]] of Object.entries(catalogs)){
 const row=make('div','','sourceRow');row.append(make('span',name),make('small',t(type)+' · '+t(status[id]||'waiting')+(cache[id]?' · '+fmt(cache[id].fetched):'')));body.append(row);}body.append(button(t('refresh'),manualRefresh));}
function settingsScreen(){const b=showDialog('settings','settings');b.append(make('div',t('version')+'  ·  v'+version,'stamp'));
 const box=make('div');box.id='settingsUpdate';b.append(box,button(t('check'),()=>rpc('check')));
 const qualityLabel=make('label',lang==='zh-Hans'?'地图性能':lang==='zh-Hant'?'地圖效能':'Map performance');
 const quality=make('select');quality.id='mapQuality';const zh=lang.startsWith('zh');
 opt(quality,'auto',lang==='zh-Hant'?'自動':zh?'自动':'Automatic');opt(quality,'smooth',lang==='zh-Hant'?'優先流暢':zh?'优先流畅':'Prioritize smoothness');quality.value=settings.mapQuality||'auto';qualityLabel.append(quality);b.append(qualityLabel);
 const engineLabel=make('label',zh?'新闻翻译':'News translation');
 const engine=make('select');engine.id='translationEngine';opt(engine,'auto',zh?'自动 · 优先本地 AI':'Automatic · prefer local AI');opt(engine,'standard',zh?'标准翻译':'Standard translation');
 engine.value=settings.translationEngine||'auto';engineLabel.append(engine);b.append(engineLabel,make('small',localAIReady?'HY-MT 1.5 · '+(zh?'本地模型就绪':'Local model ready'):(zh?'未检测到本地模型，将使用标准翻译':'Local model unavailable · standard translation')));
 b.append(make('hr'),make('h3',t('sourceState')));
 const field=(label,id,value,secret=false)=>{const l=make('label',label);l.htmlFor=id;const input=make('input');input.id=id;input.type=secret?'password':'text';input.autocomplete='off';input.value=value;l.append(input);b.append(l);return input;};
 const inputs={};for(const [key,name] of [['fr24','Flightradar24 API token'],['ships','Datalastic API key'],['x','X API Bearer Token'],['github','GitHub · '+repo+' · Contents: read']]){inputs[key]=field(name+(creds[key]?' ✓':''),'key-'+key,'',true);}
 const tg=field('Telegram · @channel','tgChannel',settings.tg||''), query=field('X · Search query','xQuery',settings.xQuery||'');
 b.append(button(t('apply'),async()=>{const feedsChanged=Object.values(inputs).some(i=>i.value.trim())||tg.value.trim()!==(settings.tg||'')||query.value.trim()!==(settings.xQuery||'');for(const [k,input] of Object.entries(inputs))if(input.value.trim()){await rpc('key',k,input.value.trim());creds[k]=true;}settings.translationEngine=engine.value;settings.mapQuality=quality.value;settings.tg=tg.value.trim();settings.xQuery=query.value.trim();await putPref();b.parentElement.close();render();if(feedsChanged)refresh(true);},'action'));
 b.append(make('hr'),button(t('coffee'),()=>rpc('external','https://ko-fi.com/little_wang')),button(t('export')+' · '+t('saved'),()=>rpc('export',JSON.stringify(saved,null,2))));updateCard();}
function updateCard(){const toast=$('toast'),box=$('settingsUpdate');
 const visible=!!state.next&&dismissed!==state.next&&view==='main';toast.hidden=!visible;
 for(const el of [visible?toast:null,box].filter(Boolean)){el.replaceChildren();if(!state.next){el.append(make('p',state.check==='error'?t('error'):state.check==='empty'?t('empty')+' · GitHub Releases':state.check==='same'?'✓ v'+version:'','sub'));continue;}
 const head=make('div','','toasthead');head.append(make('strong',t('newVersion')+'  v'+state.next));if(el===toast)head.append(button('×',()=>{dismissed=state.next;updateCard();}));el.append(head,make('p',state.notes||t('notes')));
 if(state.busy){el.append(make('p',t(state.phase==='restart'?'restart':state.status.includes('校验')?'verify':'download')+' · '+state.percent+'%'));const p=make('progress');p.max=100;p.value=state.percent;el.append(p);}
 if(state.phase==='error')el.append(make('p',t('error')+' · '+state.status));
 const action=button(t(state.phase==='error'?'retry':'install'),()=>rpc('install'),'action');action.disabled=state.busy;action.dataset.update='install';el.append(action);}
}
function handleSplitter(id,axis){
 const el=$(id),horizontal=axis==='x';
 let frame=0,pending=null,dragId=null;
 function set(value){
   if(horizontal)sizeX=Math.max(32,Math.min(75,value));else sizeY=Math.max(23,Math.min(76,value));
   layouts();
 }
 function flush(){if(pending!==null)set(pending);frame=0;pending=null;}
 function target(e){
   const r=el.parentElement.getBoundingClientRect();
   return horizontal?(e.clientX-r.x)*100/r.width:(e.clientY-r.y)*100/r.height;
 }
 el.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();el.focus({preventScroll:true});dragId=e.pointerId;el.setPointerCapture(dragId);el.classList.add('dragging');};
 el.onpointermove=e=>{
   if(e.pointerId!==dragId)return;
   pending=target(e);
   if(!frame)frame=requestAnimationFrame(flush);
 };
 function finish(e){
   if(e.pointerId!==dragId)return;
   if(e.type==='pointerup')pending=target(e);
   dragId=null;cancelAnimationFrame(frame);flush();el.classList.remove('dragging');persistSession();
   if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
 }
 el.onpointerup=el.onpointercancel=el.onlostpointercapture=finish;
 el.onkeydown=e=>{
   const keys=horizontal?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];
   if(!keys.includes(e.key))return;
   e.preventDefault();set((horizontal?sizeX:sizeY)+(e.key===keys[1]?2:-2));persistSession();
 };
}
const paneDragHints={
 'zh-Hans':'拖动标题换位，也可按 Alt + ← / →','zh-Hant':'拖動標題換位，也可按 Alt + ← / →',
 en:'Drag the title to swap panels, or press Alt + ← / →',es:'Arrastra el título o pulsa Alt + ← / →',
 fr:'Déplacez le titre ou appuyez sur Alt + ← / →',de:'Titel ziehen oder Alt + ← / → drücken',
 ar:'اسحب العنوان أو اضغط Alt + ← / →',arz:'اسحب العنوان أو اضغط Alt + ← / →',
 hi:'शीर्षक खींचें या Alt + ← / → दबाएँ',bn:'শিরোনাম টানুন বা Alt + ← / → চাপুন',
 pt:'Arraste o título ou pressione Alt + ← / →',id:'Seret judul atau tekan Alt + ← / →',
 ur:'عنوان کھینچیں یا Alt + ← / → دبائیں',ru:'Перетащите заголовок или нажмите Alt + ← / →',
 ja:'見出しをドラッグ、または Alt + ← / →',pcm:'Drag di title or press Alt + ← / →',
 mr:'शीर्षक ओढा किंवा Alt + ← / → दाबा',vi:'Kéo tiêu đề hoặc nhấn Alt + ← / →',
 te:'శీర్షికను లాగండి లేదా Alt + ← / → నొక్కండి',sw:'Buruta kichwa au bonyeza Alt + ← / →',
 tr:'Başlığı sürükleyin veya Alt + ← / → tuşlarına basın'
};
function paneOrder(){return [...$('workspace').querySelectorAll('section.panel')].map(el=>el.id);}
function swapPanes(a,b){
 const marker=document.createComment('panel position');
 a.replaceWith(marker);b.replaceWith(a);marker.replaceWith(b);
}
function wirePaneLayout(){
 const order=paneOrder(),savedOrder=readLocal('desk:paneOrder',[]);
 if(Array.isArray(savedOrder)&&savedOrder.length===order.length&&order.every(id=>savedOrder.includes(id))){
   savedOrder.forEach((id,i)=>{const current=paneOrder()[i];if(current!==id)swapPanes($(id),$(current));});
 }
 function move(from,to){
   if(!to||to===from)return;
   swapPanes(from,to);localStorage.setItem('desk:paneOrder',JSON.stringify(paneOrder()));
   map?.invalidateSize({pan:false});reveal(from);reveal(to);
 }
 for(const id of order){
   const panel=$(id),head=panel.querySelector('.panelhead');
   let origin=null,candidate=null;
   head.tabIndex=0;head.setAttribute('aria-keyshortcuts','Alt+ArrowLeft Alt+ArrowRight');
   function highlight(next){
     candidate?.classList.remove('drop-target');candidate=next===panel?null:next;candidate?.classList.add('drop-target');
   }
   head.onpointerdown=e=>{
     if(e.button!==0||e.target.closest('button'))return;
     e.preventDefault();head.focus({preventScroll:true});origin={id:e.pointerId,x:e.clientX,y:e.clientY};
     head.setPointerCapture(e.pointerId);
   };
   head.onpointermove=e=>{
     if(origin?.id!==e.pointerId||Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<6)return;
     panel.classList.add('moving');highlight(document.elementFromPoint(e.clientX,e.clientY)?.closest('#workspace section.panel'));
   };
   function end(e){
     if(origin?.id!==e.pointerId)return;
     const dropped=e.type==='pointerup'&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>=6
       ?document.elementFromPoint(e.clientX,e.clientY)?.closest('#workspace section.panel'):null;
     origin=null;highlight(null);panel.classList.remove('moving');
     if(head.hasPointerCapture(e.pointerId))head.releasePointerCapture(e.pointerId);
     if(dropped){move(panel,dropped);head.focus({preventScroll:true});}
   }
   head.onpointerup=head.onpointercancel=head.onlostpointercapture=end;
   head.onkeydown=e=>{
     if(e.target!==head||!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;
     e.preventDefault();const slots=paneOrder(),index=slots.indexOf(id),step=e.key==='ArrowRight'?1:-1;
     move(panel,$(slots[(index+step+slots.length)%slots.length]));head.focus({preventScroll:true});
   };
 }
}
function wire(){
 $('publicationSort').setAttribute('aria-pressed',String(sortByPublication));
 $('publicationSort').onclick=()=>{
  setPublicationSort(!sortByPublication);
  try{localStorage.setItem(sortPreference,JSON.stringify(sortByPublication))}catch{}
 };
 window.addEventListener('storage',event=>{
  if(event.key===sortPreference)setPublicationSort(event.newValue==='true');
 });
 if(view==='main')wirePaneLayout();
 new ResizeObserver(moveLayerHighlight).observe($('layers'));
 $('ukraineTopic').onclick=()=>{setRegion('001');$('query').value=filter='Ukraine';map.fitBounds(leafletBounds(featuresByCode.get('UKR')),{animate:false});render();sendSelection();};
 $('hormuzTopic').onclick=()=>{setRegion('001');$('query').value=filter='Hormuz';render();const e=cache.transits?.records?.[0]||allRows()[0];if(e)selectEvent(e,true);else sendSelection();};
 $('coffee').onclick=()=>rpc('external','https://ko-fi.com/little_wang');
 Object.entries(localeNames).forEach(([id,name])=>opt($('language'),id,name));$('language').onchange=async()=>{lang=$('language').value;settings.lang=lang;await putPref();configureMenus();if($('dialog').open)settingsScreen();};
 $('region').onchange=()=>setRegion($('region').value);$('layerSelect').onchange=()=>setLayer($('layerSelect').value);$('eventType').onchange=()=>{eventType=validEventType($('eventType').value);render();sendSelection();};$('level').onchange=()=>{minLevel=$('level').value;render();sendSelection();};$('query').oninput=()=>{filter=$('query').value;render();sendSelection();};
 $('imageryMode').onchange=()=>{applyImageryMode($('imageryMode').value);satLayer();sendSelection();};
 $('imageryRetry').onclick=()=>{activeImageryKey='';satLayer();};
 $('imagery').max=new Date().toISOString().slice(0,10);$('imagery').onchange=()=>{if($('imagery').value){sessionDate=$('imagery').value;satLayer();sendSelection();}};$('refreshAll').hidden=view!=='main';$('refreshAll').onclick=manualRefresh;$('refresh').onclick=manualRefresh;$('resetMap').onclick=frameRegion;
 $('savedTab').onclick=()=>{mode=mode==='saved'?'events':'saved';if(mode==='saved'){region='001';layer='all';eventType='map';filter='';minLevel='any';$('query').value='';configureMenus();satLayer();frameRegion();}render();};
 $('settings').onclick=settingsScreen;$('sourcesTab').onclick=sourcesScreen;$('dismissDialog').onclick=()=>$('dialog').close();document.querySelectorAll('.pop').forEach(b=>b.onclick=()=>rpc('window',b.dataset.view,JSON.stringify({selected,layer,region,eventType,minLevel,filter,sessionDate,imageryMode})));
 handleSplitter('splitX','x');handleSplitter('splitY','y');
}
function syncFocus(m,pan){layer=m.layer;region=regionCode(m.region);ensureGeometry(region);eventType=validEventType(m.eventType);minLevel=m.minLevel;filter=m.filter;selected=upgradeRecord(m.selected);applyImageryMode(m.imageryMode);sessionDate=m.sessionDate||sessionDate;$('query').value=filter;configureMenus();satLayer();if(pan)frameRegion();}
channel.onmessage=({data:m})=>{if(!startDone)return;if(m.type==='locate'&&(view==='main'||view==='map'))openLocation(upgradeRecord(m.event));if(m.type==='feeds'&&view!=='main'&&view!=='detail'){Object.assign(status,m.status);if(m.ids?.length){m.ids.forEach(restoreFeed);render()}else updateFeedStatus()}
 if(m.type==='refresh'&&view==='main')manualRefresh();if(m.type==='manualRefresh'&&view!=='main')showRefreshState(m.busy,m.summary,m.progress);if(m.type==='focus'&&view!=='detail')syncFocus(m,region!==m.region);};
chrome.webview.addEventListener('message',async({data:m})=>{if(m.type==='reply'){const p=calls.get(m.value.id);if(p){calls.delete(m.value.id);m.value.error?p.reject(Error(m.value.error)):p.resolve(m.value.result);}return;}
 if(m.type==='story'&&view==='detail'){readStory(m.value);return;}
 if(m.type==='update'){state=m.value;updateCard();}if(m.type==='changed'&&startDone){if(m.value==='saved'){saved=JSON.parse(await rpc('read','saved')).map(upgradeRecord).map(anchorNews);render();}else{settings=JSON.parse(await rpc('read','settings'));lang=settings.lang||lang;configureMenus();}}});
function readStory(raw){
 if(!raw)return;
 standalone=upgradeRecord(JSON.parse(raw));
 if(location.search.includes('warm='))history.replaceState(null,'',location.pathname+'?view=detail');
 document.getElementById('briefBody').scrollTop=0;render();enrichArticle(standalone);
}
async function boot(){wire();const [ready,prefs,bookmarks]=await Promise.all([rpc('ready'),rpc('read','settings'),rpc('read','saved')]);version=ready.version;updateClock();setInterval(updateClock,1000);localAIReady=!!ready.localAI;repo=ready.repo;state=ready.state;creds={fr24:ready.fr24,x:ready.x,github:ready.github,ships:ready.ships};
 settings=JSON.parse(prefs);lang=localeNames[settings.lang]?settings.lang:'zh-Hans';saved=JSON.parse(bookmarks).map(upgradeRecord);
 if(view==='detail'){
   $('refreshAll').hidden=true;document.body.classList.add('single','dossier');$('mapPane').hidden=true;$('listPane').hidden=true;
   $('headVersion').textContent='v'+version;startDone=true;configureMenus();readStory(await rpc('readerReady'));return;
 }

 const prev=readLocal('desk:session',{});layer=prev.layer||layer;region=regionCode(prev.region||region);eventType=validEventType(prev.eventType);minLevel=prev.minLevel||minLevel;filter=prev.filter||'';sizeX=prev.sizeX||sizeX;sizeY=prev.sizeY||sizeY;applyImageryMode(prev.imageryMode);sessionDate=prev.sessionDate||sessionDate;layouts();
 if(view!=='main'){document.body.classList.add('single');$('mapPane').hidden=view!=='map';document.querySelector('.right').hidden=view==='map';$('listPane').hidden=view!=='list';$('briefPane').hidden=!['brief','detail'].includes(view);if(view==='detail')standalone=upgradeRecord(JSON.parse(ready.data));else if(ready.data){const d=JSON.parse(ready.data);layer=d.layer;region=regionCode(d.region);eventType=validEventType(d.eventType);minLevel=d.minLevel;filter=d.filter;selected=upgradeRecord(d.selected);applyImageryMode(d.imageryMode);sessionDate=d.sessionDate||sessionDate;}}
 $('headVersion').textContent='v'+version;$('query').value=filter;if(mapView){await overviewReady;initMap();ensureGeometry(region);}
 configureMenus();satLayer();
 // Give the interactive camera a paint before restoring and geocoding old news.
 if(mapView&&!document.hidden)await new Promise(done=>{
  const deadline=setTimeout(done,100);
  requestAnimationFrame(()=>setTimeout(()=>{clearTimeout(deadline);done()},0));
 });
 await loadNewsPlaces();saved=saved.map(anchorNews);
 for(const id of Object.keys(catalogs)){
  restoreFeed(id);
  if(cache[id])await new Promise(done=>setTimeout(done,0));
 }
 startDone=true;
 if(view==='main'&&!readLocal('desk:region-recovery-019',false)){
  localStorage.setItem('desk:region-recovery-019','true');
  if(region!=='001'&&layer==='all'&&!filter&&minLevel==='any'&&!allRows().length&&Object.values(cache).some(c=>c.records?.length)){
   showWorldEvents();
  }
 }
 render();
 if(view==='main'){$('refreshAll').disabled=false;await rpc('healthy');startFlashStream();refresh(true);setInterval(()=>refresh(true),FEED_INTERVAL_MS);if(ready.installError)notice(ready.installError);}
}
boot().catch(e=>notice(e.message));

