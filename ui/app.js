'use strict';
const $=id=>document.getElementById(id);
const make=(tag,text='',cls='')=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el};
function button(label,fn,cls=''){const el=make('button',label,cls);el.onclick=()=>Promise.resolve().then(fn).catch(e=>notice(e.message));return el}
function notice(msg){$('notice').textContent=msg;$('notice').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').hidden=true,4000)}
const calls=new Map();let seq=0;
function rpc(cmd,arg='',val=''){return new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});chrome.webview.postMessage(JSON.stringify({id,cmd,arg,val}));});}
const view=new URLSearchParams(location.search).get('view')||'main';
let settings={},saved=[],selected=null,standalone=null,version='',state={},creds={},repo='',dismissed='',mode='events',region='001',layer='all',minLevel='any',filter='',countryLayers=new Map(),map,marks,satellite,labels,grid,queued,markTimer,startDone=false;
let sizeX=64,sizeY=58,sessionDate=new Date(Date.now()-86400000).toISOString().slice(0,10);
const channel=new BroadcastChannel('workspace-sync'),cache={},status={},loading=new Set();
const regions={'001':[[4,8],2],'142':[[32,96],3],'150':[[52,15],4],'021':[[39,-102],3],'005': [[-16,-60],3],'002':[[2,18],3],'009':[[-22,144],3]};
const bounds={'142':[-11,25,78,180],'150':[34,-25,72,64],'021':[6,-170,85,-47],'005':[-57,-85,14,-32],'002':[-36,-26,38,62],'009':[-54,109,10,180]};
const continents={'142':'Asia','150':'Europe','021':'North America','005':'South America','002':'Africa','009':'Oceania'};
const paneTypes=['all','air','sea','money','cyber','disaster','politics','sat'];
const features=countryFeatures.filter(f=>f.properties.iso!=='ATA').sort((a,b)=>a.properties.rank-b.properties.rank);
const countryNames=features.filter(f=>f.properties.en?.length>3).sort((a,b)=>b.properties.en.length-a.properties.en.length);
const escapeRe=s=>s.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
const matchers=countryNames.map(f=>[f,new RegExp('\\b'+escapeRe(f.properties.en)+'\\b','i')]);
const aliases={'US':'USA','U.S.':'USA','UK':'GBR','Britain':'GBR','Chinese':'CHN','Beijing':'CHN','Russian':'RUS','Moscow':'RUS','Kyiv':'UKR','Ukrainian':'UKR','Gaza':'PSX','Israeli':'ISR','Iranian':'IRN','Japanese':'JPN','Tokyo':'JPN','German':'DEU','French':'FRA','Paris':'FRA','London':'GBR','Indian':'IND','Delhi':'IND','Brazilian':'BRA','China':'CHN'};
const aliasMatchers=Object.entries(aliases).map(([a,iso])=>[iso,new RegExp('\\b'+escapeRe(a)+'\\b',a==='US'||a==='UK'?'':'i')]);
function anchorNews(e){if(e.location||e.layer!=='politics')return e;if(areaInHeadline(e))return e;let f=matchers.find(([,re])=>re.test(e.title))?.[0];if(!f){const iso=aliasMatchers.find(([,re])=>re.test(e.title))?.[0];f=features.find(x=>x.properties.iso===iso);}
 if(f){e.location=[f.properties.lat,f.properties.lon];e.anchor='country';e.iso=f.properties.iso;}return e;}
const regionCodes=['001','142','150','021','005','002','009'];
const regionText={'zh-Hans':'全球 亚洲 欧洲 北美洲 南美洲 非洲 大洋洲','zh-Hant':'全球 亞洲 歐洲 北美洲 南美洲 非洲 大洋洲',en:'World Asia Europe North_America South_America Africa Oceania',hi:'विश्व एशिया यूरोप उत्तर_अमेरिका दक्षिण_अमेरिका अफ्रीका ओशिनिया',es:'Mundo Asia Europa Norteamérica Sudamérica África Oceanía',ar:'العالم آسيا أوروبا أمريكا_الشمالية أمريكا_الجنوبية أفريقيا أوقيانوسيا',arz:'العالم آسيا أوروبا أمريكا_الشمالية أمريكا_الجنوبية أفريقيا أوقيانوسيا',fr:'Monde Asie Europe Amérique_du_Nord Amérique_du_Sud Afrique Océanie',bn:'বিশ্ব এশিয়া ইউরোপ উত্তর_আমেরিকা দক্ষিণ_আমেরিকা আফ্রিকা ওশেনিয়া',pt:'Mundo Ásia Europa América_do_Norte América_do_Sul África Oceania',id:'Dunia Asia Eropa Amerika_Utara Amerika_Selatan Afrika Oseania',ur:'دنیا ایشیا یورپ شمالی_امریکا جنوبی_امریکا افریقہ اوشیانا',ru:'Мир Азия Европа Северная_Америка Южная_Америка Африка Океания',de:'Welt Asien Europa Nordamerika Südamerika Afrika Ozeanien',ja:'世界 アジア ヨーロッパ 北アメリカ 南アメリカ アフリカ オセアニア',pcm:'World Asia Europe North_America South_America Africa Oceania',mr:'जग आशिया युरोप उत्तर_अमेरिका दक्षिण_अमेरिका आफ्रिका ओशिनिया',vi:'Thế_giới Châu_Á Châu_Âu Bắc_Mỹ Nam_Mỹ Châu_Phi Châu_Đại_Dương',te:'ప్రపంచం ఆసియా ఐరోపా ఉత్తర_అమెరికా దక్షిణ_అమెరికా ఆఫ్రికా ఓషియానియా',sw:'Dunia Asia Ulaya Amerika_Kaskazini Amerika_Kusini Afrika Oceania',tr:'Dünya Asya Avrupa Kuzey_Amerika Güney_Amerika Afrika Okyanusya'};
function regionName(id){if(regionCodes.includes(id))return regionText[lang].split(' ')[regionCodes.indexOf(id)].replaceAll('_',' ');try{const loc=lang==='pcm'?'en-NG':lang==='arz'?'ar-EG':lang;return new Intl.DisplayNames([loc],{type:'region'}).of(id);}catch{return id;}}
function countryName(f){return /^[A-Z]{2}$/.test(f.properties.iso2)?regionName(f.properties.iso2):lang.startsWith('zh')?f.properties.name:f.properties.en;}
function fmt(iso){if(!iso)return '—';try{return new Intl.DateTimeFormat(lang,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}catch{return iso;}}
function opt(el,val,name){el.add(new Option(name,val))}
function layouts(){document.documentElement.style.setProperty('--x',sizeX+'%');document.documentElement.style.setProperty('--y',sizeY+'%');}
function persistSession(){localStorage.setItem('desk:session',JSON.stringify({layer,region,minLevel,filter,sizeX,sizeY,sessionDate}));}
function putPref(){return rpc('write','settings',JSON.stringify(settings))}
function readLocal(id,fallback){try{return JSON.parse(localStorage.getItem(id))??fallback}catch{return fallback}}
function sendSelection(){channel.postMessage({type:'focus',layer,region,minLevel,filter,selected,sessionDate});persistSession();}
function configureMenus(){
 document.documentElement.lang=lang;document.documentElement.dir=['ar','arz','ur'].includes(lang)?'rtl':'ltr';document.title=t('title');rpc('title',t('title')+(view==='main'?'':' · '+t(view==='detail'?'details':view==='list'?'events':view))).catch(()=>{});
 document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));$('language').value=lang;$('query').placeholder=t('search');
 const r=$('region');r.replaceChildren();for(const id of Object.keys(regions).sort((a,b)=>a==='001'?-1:b==='001'?1:0))opt(r,id,regionName(id));const group=make('optgroup');group.label=t('region');
 features.map(f=>[f.properties.iso,countryName(f)]).sort((a,b)=>a[1].localeCompare(b[1],lang)).forEach(([id,name])=>group.append(new Option(name,id)));r.append(group);const sub=make('optgroup');sub.label=countryName(featuresByCode.get('CHN'))+' · '+t('region');for(const code of Object.keys(areas))sub.append(new Option(areaName(code),code));r.append(sub);r.value=region;r.ariaLabel=t('region');
 const layerSelect=$('layerSelect');layerSelect.replaceChildren();$('layers').replaceChildren();for(const key of paneTypes){opt(layerSelect,key,t(key));const b=button('',()=>setLayer(key));b.append(make('b',glyph[key]||'◎'),make('span',t(key)));b.dataset.layer=key;$('layers').append(b);}layerSelect.value=layer;layerSelect.ariaLabel=t('layer');
 $('level').replaceChildren();opt($('level'),'any',t('severity'));levelNames.forEach((n,i)=>opt($('level'),String(i),t(n)));$('level').value=minLevel;$('level').ariaLabel=t('severity');
 $('legend').replaceChildren(...levelNames.map((n,i)=>{const p=make('span','','legenditem');const dot=make('i','','dot');dot.style.background=colors[i];p.append(dot,make('span',t(n)));return p;}));
 document.querySelectorAll('.pop').forEach(b=>{b.title=t('detach');b.ariaLabel=t('detach');});$('refresh').title=t('refresh');$('imagery').title=t('date');$('dismissDialog').title=t('close');$('resetMap').title=t('map');$('settings').title=t('settings');
 if(view==='detail')document.querySelector('#briefPane h2').textContent=t('details');
 render();scheduleCartography();updateCard();
}
function initMap(){
 map=L.map('map',{preferCanvas:true,minZoom:1,maxZoom:10,zoomSnap:.25,zoomDelta:.5,zoomControl:false,attributionControl:true,worldCopyJump:false,maxBounds:[[-86,-190],[86,190]],maxBoundsViscosity:.8}).setView([16,7],2);
 map.attributionControl.setPrefix(false);L.control.zoom({position:'bottomright'}).addTo(map);
 grid=L.layerGroup().addTo(map);for(let x=-180;x<=180;x+=30)L.polyline([[-85,x],[85,x]],{weight:.6,opacity:.32,color:'#6b909e',interactive:false,dashArray:'2,5'}).addTo(grid);
 for(let y=-60;y<=60;y+=30)L.polyline([[y,-180],[y,180]],{weight:.6,opacity:.32,color:'#6b909e',interactive:false,dashArray:'2,5'}).addTo(grid);
 if(view==="main"||view==="map")setupCartography();
 marks=L.layerGroup().addTo(map);labels=L.layerGroup().addTo(map);
 map.on('moveend zoomend',()=>{clearTimeout(markTimer);markTimer=setTimeout(drawMap,85)});
 map.on('mousemove',e=>$('coords').textContent=e.latlng.lat.toFixed(2)+'° / '+e.latlng.lng.toFixed(2)+'°');
 new ResizeObserver(()=>{map.invalidateSize();}).observe($('mapWrap'));frameRegion();
}
function frameRegion(){if(!map)return;if(region==='001'){map.fitBounds([[-53,-173],[73,178]],{padding:[5,5]});}else if(regions[region])map.setView(...regions[region]);else {const f=featuresByCode.get(region);if(f)map.fitBounds(leafletBounds(f),{maxZoom:8,padding:[14,14],animate:false});}}
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
function allRows(){return (mode==='saved'?saved:Object.values(cache).flatMap(c=>c.records||[])).filter(e=>(layer==='all'||e.layer===layer)&&(minLevel==='any'||e.severity===+minLevel)&&matchesRegion(e)&&(!filter||(e.title+' '+e.source+' '+e.summary).toLowerCase().includes(filter.toLowerCase())));}
function sortRows(rows){return rows.sort((a,b)=>{if(layer==='all'&&mode!=='saved'){const obs=e=>['metar','buoy','fx','ferry','crypto','fr24','adsb','baltic','ships'].includes(e.feed)?1:0;const diff=obs(a)-obs(b);if(diff)return diff;}return b.time.localeCompare(a.time);});}
function drawMap(){
 if(!map||!marks||$('mapPane').hidden)return;marks.clearLayers();labels.clearLayers();const rows=allRows().filter(e=>e.location&&(layer!=='all'||mode==='saved'||!['buoy','fx','ferry','fr24','crypto','adsb','baltic','ships'].includes(e.feed))&&(layer!=='all'||e.feed!=='metar'||e.severity>=3));const groups=new Map(),z=map.getZoom(),area=map.getBounds().pad(.08);
 for(const e of rows){if(!area.contains(e.location))continue;const p=map.latLngToContainerPoint(e.location),g=z>=7?e.id:Math.floor(p.x/28)+','+Math.floor(p.y/28);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(e);}
 for(const group of groups.values()){const e=group.find(x=>x.id===selected?.id)||group.reduce((a,b)=>a.severity>=b.severity?a:b);
 const el=make('span',group.length>1?String(group.length):glyph[e.layer],'pin'+(group.length>1?' cluster':'')+(selected?.id===e.id?' sel':''));el.style.color=colors[e.severity];const icon=L.divIcon({className:'marker',html:el,iconAnchor:[10,10],iconSize:[20,20]});
 L.marker(e.location,{icon,title:e.title,keyboard:true}).addTo(marks).on('click',()=>{selectEvent(e,false);if(group.length>1&&map.getZoom()<7)map.setView(e.location,map.getZoom()+1);});}
 paintPlaceLabels(z,area,[]);
 $('mapStats').textContent=t('map')+'  /  '+rows.length.toLocaleString(lang);
}
function satLayer(){
 $('imagery').hidden=layer!=='sat';$('imagery').value=sessionDate;if(!map)return;
 if(satellite){satellite.remove();satellite=null;}
 const on=layer==='sat';scheduleCartography();
 if(on){satellite=L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/'+sessionDate+'/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',{maxNativeZoom:9,maxZoom:10,noWrap:true,attribution:'NASA GIBS · MODIS Terra '+sessionDate}).addTo(map);
 satellite.once('tileerror',()=>notice('NASA GIBS · '+t('error')+' · '+sessionDate));}
}
function setRegion(id){region=regionCode(id);ensureGeometry(region);scheduleCartography();$('region').value=id;frameRegion();render();sendSelection();if(view==='main'&&['air','sea'].includes(layer))refresh(false);}
function setLayer(id){layer=id;mode='events';selected=null;$('layerSelect').value=id;satLayer();render();sendSelection();if(view==='main')refresh(false);}
function render(){
 if(!startDone)return;$('savedTab').classList.toggle('on',mode==='saved');document.querySelectorAll('[data-layer]').forEach(b=>b.classList.toggle('on',mode!=='saved'&&b.dataset.layer===layer));$('mapScope').textContent=t(layer);
 let rows=sortRows(allRows());if(view!=='detail'&&(!selected||!rows.some(e=>e.id===selected.id)))selected=rows[0]||null;
 $('counter').textContent=rows.length.toLocaleString(lang);$('rows').replaceChildren();
 if(!rows.length)$('rows').append(make('div',t('empty'),'empty'));
 let shown=0;function more(){const old=$('more');if(old)old.remove();const end=Math.min(shown+90,rows.length);
 for(;shown<end;shown++){const e=rows[shown],b=button('',()=>selectEvent(e,true),'row'+(selected?.id===e.id?' selected':''));const ico=make('span',glyph[e.layer],'sym');ico.style.color=colors[e.severity];const text=make('span','','rowtext');text.append(make('span',e.title,'rowtitle'),make('span',e.source+'  ·  '+fmt(e.time),'rowmeta'));b.dataset.id=e.id;b.append(ico,text);$('rows').append(b);}
 if(shown<rows.length){const b=button('＋ '+(rows.length-shown),more);b.id='more';$('rows').append(b);}}
 more();brief(view==='detail'?standalone:selected,view==='detail');drawMap();const ok=Object.keys(status).filter(k=>status[k]==='online').length;$('feedStatus').textContent=t('sourceState')+'  '+ok+' / '+Object.keys(status).length+'   ·   '+t(mode==='saved'?'saved':'events');
 if($('dialog').open&&$('dialog').dataset.page==='sources')sourcesScreen();
}
function selectEvent(e,pan){selected=e;if(pan&&map&&e.location)map.panTo(e.location);render();sendSelection();}
function brief(e,full){const box=$('briefBody');box.replaceChildren();if(!e){box.append(make('div',t('empty'),'empty'));return;}
 const info=make('article','','info'),pill=make('span',t(levelNames[e.severity]),'pill');pill.style.color=colors[e.severity];info.append(pill,make('h3',e.title),make('div',e.source+' · '+fmt(e.time),'stamp'),make('p',e.summary||'—'));
 if(e.area&&areas[e.area])info.append(make('small',areaName(e.area)+' · '+countryName(featuresByCode.get('CHN')),'sub'));else if(e.anchor==='country'||e.anchor==='currency'){info.append(make('small',e.anchor==='country'?'≈ '+(features.find(f=>f.properties.iso===e.iso)?countryName(features.find(f=>f.properties.iso===e.iso)):'')+' · '+t('region'):'≈ '+t('region')+' · FX','sub'));}
 if(full&&e.history?.length){info.append(make('h4',t('updated')));for(const h of e.history)info.append(make('div',fmt(h.time),'stamp'),make('p',h.title+' · '+h.summary));}
 if(full){info.append(make('h4',t('sources')));for(const link of e.links||[])if(safeUrl(link.url)){const a=button(link.name+' · '+new URL(link.url).hostname,()=>rpc('external',link.url),'sourcebutton');info.append(a);}
 if(e.media?.length){info.append(make('h4',t('media')));for(const media of e.media){if(!safeUrl(media.url))continue;const m=make(media.type==='video'?'video':'img','','media');m.src=media.url;m.referrerPolicy='no-referrer';if(media.type==='video'){m.controls=true;m.preload='metadata';}else m.alt=e.title;info.append(m,button(e.source,()=>rpc('external',media.url),'sourcebutton'));}}}
 const actions=make('div','','actions');if(!full)actions.append(button(t('details'),()=>rpc('window','detail',JSON.stringify(e)),'action'));
 const stored=saved.some(x=>x.id===e.id);actions.append(button(t(stored?'remove':'save'),()=>rpc('bookmark',stored?'remove':'add',JSON.stringify(e))));info.append(actions);box.append(info);
}
function noticeError(err){notice(err.message||String(err));}
function cacheWrite(id,entry){cache[id]=entry;try{localStorage.setItem('desk:feed:'+id,JSON.stringify(entry));}catch{}}
async function fetchOne(id,force){
 if(loading.has(id))return;let arg='';if(id==='adsb'||id==='ships'){if(id==='adsb'&&layer!=='air'||id==='ships'&&(layer!=='sea'||!creds.ships))return;
 const hubs={'001':[40.64,-73.78],'142':[35.55,139.78],'150':[50.03,8.57],'021':[41.98,-87.91],'005':[-23.43,-46.47],'002':[-26.14,28.25],'009':[-33.94,151.18]};
 const center=map.getCenter(),p=map.getZoom()<4&&hubs[region]?(id==='adsb'?hubs[region]:region==='001'?[1.25,103.84]:[center.lat,center.lng]):[center.lat,center.lng];arg=p.map(v=>v.toFixed(2)).join(',');}
 if(id==='fr24'){if(!creds.fr24||layer!=='air')return;const b=map.getBounds();arg=[Math.min(85,b.getNorth()),Math.max(-85,b.getSouth()),Math.max(-180,b.getWest()),Math.min(180,b.getEast())].map(x=>x.toFixed(2)).join(',');}if(id==='x'){if(!creds.x)return;arg=settings.xQuery||'';}if(id==='tg'){arg=(settings.tg||'').replace(/^@/,'').trim();if(!arg)return;}
 const existing=cache[id];if(!force&&existing&&existing.arg===arg&&Date.now()-existing.fetched<catalogs[id][2]*60000)return;
 loading.add(id);status[id]='waiting';try{const raw=await rpc('feed',id,arg);const records=parseFeed(id,raw).map(anchorNews);const old=new Map((existing?.records||[]).map(e=>[e.id,e]));
 for(const e of records){if(!['disaster','politics','cyber','sat'].includes(e.layer))continue;const prior=old.get(e.id);e.history=prior?.history||[];if(prior&&(prior.title!==e.title||prior.summary!==e.summary||prior.severity!==e.severity)){e.history=[{time:prior.time,title:prior.title,summary:prior.summary},...e.history].slice(0,5);}}
 cacheWrite(id,{records,fetched:Date.now(),arg});status[id]='online';}
 catch(e){status[id]=existing?'cached':'error';console.warn(id,e.message);}finally{loading.delete(id);clearTimeout(queued);queued=setTimeout(()=>{render();channel.postMessage({type:'feeds',status});},180);}
}
async function refresh(force){if(view!=='main'){channel.postMessage({type:'refresh',force});return;}await Promise.all(Object.keys(catalogs).map(id=>fetchOne(id,force)));render();}
function loadCaches(){for(const id of Object.keys(catalogs)){const v=readLocal('desk:feed:'+id,null);if(v){v.records=(v.records||[]).map(upgradeRecord);cache[id]=v;status[id]||='cached';}}}
function showDialog(page,title){const d=$('dialog');d.dataset.page=page;$('dialogTitle').textContent=t(title);$('dialogBody').replaceChildren();if(!d.open)d.showModal();return $('dialogBody');}
function sourcesScreen(){const body=showDialog('sources','sourceState');for(const [id,[type,name]] of Object.entries(catalogs)){
 const row=make('div','','sourceRow');row.append(make('span',name),make('small',t(type)+' · '+t(status[id]||'waiting')+(cache[id]?' · '+fmt(cache[id].fetched):'')));body.append(row);}body.append(button(t('refresh'),()=>refresh(true)));}
function settingsScreen(){const b=showDialog('settings','settings');b.append(make('div',t('version')+'  ·  v'+version,'stamp'));
 const box=make('div');box.id='settingsUpdate';b.append(box,button(t('check'),()=>rpc('check')));b.append(make('hr'),make('h3',t('sourceState')));
 const field=(label,id,value,secret=false)=>{const l=make('label',label);l.htmlFor=id;const input=make('input');input.id=id;input.type=secret?'password':'text';input.autocomplete='off';input.value=value;l.append(input);b.append(l);return input;};
 const inputs={};for(const [key,name] of [['fr24','Flightradar24 API token'],['ships','Datalastic API key'],['x','X API Bearer Token'],['github','GitHub · '+repo+' · Contents: read']]){inputs[key]=field(name+(creds[key]?' ✓':''),'key-'+key,'',true);}
 const tg=field('Telegram · @channel','tgChannel',settings.tg||''), query=field('X · Search query','xQuery',settings.xQuery||'');
 b.append(button(t('apply'),async()=>{for(const [k,input] of Object.entries(inputs))if(input.value.trim()){await rpc('key',k,input.value.trim());creds[k]=true;}settings.tg=tg.value.trim();settings.xQuery=query.value.trim();await putPref();b.parentElement.close();refresh(true);},'action'));
 b.append(make('hr'),button(t('coffee'),()=>rpc('external','https://ko-fi.com/little_wang')),button(t('export')+' · '+t('saved'),()=>rpc('export',JSON.stringify(saved,null,2))));updateCard();}
function updateCard(){const toast=$('toast'),box=$('settingsUpdate');
 const visible=!!state.next&&dismissed!==state.next&&view==='main';toast.hidden=!visible;
 for(const el of [visible?toast:null,box].filter(Boolean)){el.replaceChildren();if(!state.next){el.append(make('p',state.check==='error'?t('error'):state.check==='empty'?t('empty')+' · GitHub Releases':state.check==='same'?'✓ v'+version:'','sub'));continue;}
 const head=make('div','','toasthead');head.append(make('strong',t('newVersion')+'  v'+state.next));if(el===toast)head.append(button('×',()=>{dismissed=state.next;updateCard();}));el.append(head,make('p',state.notes||t('notes')));
 if(state.busy){el.append(make('p',t(state.phase==='restart'?'restart':state.status.includes('校验')?'verify':'download')+' · '+state.percent+'%'));const p=make('progress');p.max=100;p.value=state.percent;el.append(p);}
 if(state.phase==='error')el.append(make('p',t('error')+' · '+state.status));
 const action=button(t(state.phase==='error'?'retry':'install'),()=>rpc('install'),'action');action.disabled=state.busy;action.dataset.update='install';el.append(action);}
}
function handleSplitter(id,axis){const el=$(id);
 function set(v){if(axis==='x')sizeX=Math.max(32,Math.min(75,v));else sizeY=Math.max(23,Math.min(76,v));layouts();persistSession();}
 el.onpointerdown=e=>{el.setPointerCapture(e.pointerId);};el.onpointermove=e=>{if(!el.hasPointerCapture(e.pointerId))return;const r=el.parentElement.getBoundingClientRect();set(axis==='x'?(e.clientX-r.x)*100/r.width:(e.clientY-r.y)*100/r.height);};el.onpointerup=e=>el.releasePointerCapture(e.pointerId);el.onkeydown=e=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)){e.preventDefault();set((axis==='x'?sizeX:sizeY)+(['ArrowRight','ArrowDown'].includes(e.key)?2:-2));}};}
function wire(){
 Object.entries(localeNames).forEach(([id,name])=>opt($('language'),id,name));$('language').onchange=async()=>{lang=$('language').value;settings.lang=lang;await putPref();configureMenus();if($('dialog').open)settingsScreen();};
 $('region').onchange=()=>setRegion($('region').value);$('layerSelect').onchange=()=>setLayer($('layerSelect').value);$('level').onchange=()=>{minLevel=$('level').value;render();sendSelection();};$('query').oninput=()=>{filter=$('query').value;render();sendSelection();};
 $('imagery').max=new Date().toISOString().slice(0,10);$('imagery').onchange=()=>{if($('imagery').value){sessionDate=$('imagery').value;satLayer();sendSelection();}};$('refresh').onclick=()=>refresh(true);$('resetMap').onclick=frameRegion;
 $('savedTab').onclick=()=>{mode=mode==='saved'?'events':'saved';if(mode==='saved'){region='001';layer='all';filter='';minLevel='any';$('query').value='';configureMenus();satLayer();frameRegion();}render();};
 $('settings').onclick=settingsScreen;$('sourcesTab').onclick=sourcesScreen;$('dismissDialog').onclick=()=>$('dialog').close();document.querySelectorAll('.pop').forEach(b=>b.onclick=()=>rpc('window',b.dataset.view,JSON.stringify({selected,layer,region,minLevel,filter,sessionDate})));
 handleSplitter('splitX','x');handleSplitter('splitY','y');
}
function syncFocus(m,pan){layer=m.layer;region=regionCode(m.region);ensureGeometry(region);minLevel=m.minLevel;filter=m.filter;selected=upgradeRecord(m.selected);sessionDate=m.sessionDate||sessionDate;$('query').value=filter;configureMenus();satLayer();if(pan)frameRegion();}
channel.onmessage=({data:m})=>{if(!startDone)return;if(m.type==='feeds'&&view!=='main'){Object.assign(status,m.status);loadCaches();render();}
 if(m.type==='refresh'&&view==='main')refresh(m.force);if(m.type==='focus'&&view!=='detail')syncFocus(m,region!==m.region);};
chrome.webview.addEventListener('message',async({data:m})=>{if(m.type==='reply'){const p=calls.get(m.value.id);if(p){calls.delete(m.value.id);m.value.error?p.reject(Error(m.value.error)):p.resolve(m.value.result);}return;}
 if(m.type==='update'){state=m.value;updateCard();}if(m.type==='changed'&&startDone){if(m.value==='saved'){saved=JSON.parse(await rpc('read','saved')).map(upgradeRecord);render();}else{settings=JSON.parse(await rpc('read','settings'));lang=settings.lang||lang;configureMenus();}}});
async function boot(){wire();const ready=await rpc('ready');version=ready.version;repo=ready.repo;state=ready.state;creds={fr24:ready.fr24,x:ready.x,github:ready.github,ships:ready.ships};
 settings=JSON.parse(await rpc('read','settings'));lang=localeNames[settings.lang]?settings.lang:'zh-Hans';saved=JSON.parse(await rpc('read','saved')).map(upgradeRecord);
 const prev=readLocal('desk:session',{});layer=prev.layer||layer;region=regionCode(prev.region||region);minLevel=prev.minLevel||minLevel;filter=prev.filter||'';sizeX=prev.sizeX||sizeX;sizeY=prev.sizeY||sizeY;sessionDate=prev.sessionDate||sessionDate;layouts();
 if(view!=='main'){document.body.classList.add('single');$('mapPane').hidden=view!=='map';document.querySelector('.right').hidden=view==='map';$('listPane').hidden=view!=='list';$('briefPane').hidden=!['brief','detail'].includes(view);if(view==='detail')standalone=upgradeRecord(JSON.parse(ready.data));else if(ready.data){const d=JSON.parse(ready.data);layer=d.layer;region=regionCode(d.region);minLevel=d.minLevel;filter=d.filter;selected=upgradeRecord(d.selected);sessionDate=d.sessionDate;}}
 $('headVersion').textContent='v'+version;$('query').value=filter;loadCaches();initMap();ensureGeometry(region);startDone=true;configureMenus();satLayer();render();
 if(view==='main'){await rpc('healthy');refresh(false);setInterval(()=>refresh(false),60000);if(ready.installError)notice(ready.installError);}setInterval(()=>$('clock').textContent=new Date().toISOString().slice(11,19)+' UTC',1000);
}
boot().catch(e=>notice(e.message));

