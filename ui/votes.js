'use strict';
const voteKinds=['Y','N','A','X','-'];
const voteLabels=['voteYes','voteNo','voteAbstain','voteAbsent','voteMissing'];
const voteColors=['#429e8f','#dc7969','#d7ae58','#758798','#303c49'];
const voteRecords=new Map(),votePaths=new Map(),voteMembers=new Map();
const voteCacheKey='desk:un-roll-calls-v1';
let followNewest=true,splitGeometry={};
const splitLayers=new Map(),paintedSeats=new Map();
let detailSeat='';
let voteMap,activeVote='',votingCountry='',votingChoices=new Map(),voteState='cached',voteSignature='';
function voteIso(f){return f.properties.iso==='SDS'?'SSD':f.properties.iso}
function voteLabel(code){return t(voteLabels[voteKinds.indexOf(code)])}
function resolutionName(record){
 const key=lang.startsWith('zh')?'zh':lang==='arz'?'ar':lang;
 return record.names?.[key]||record.title;
}
function parseRollCalls(raw){
 const xml=new DOMParser().parseFromString(raw,'application/xml');
 if(xml.documentElement.localName!=='collection'||xml.querySelector('parsererror'))throw Error('UN MARCXML');
 const out=[];
 for(const rec of xml.getElementsByTagNameNS('*','record')){
  const fields=tag=>Array.from(rec.children).filter(f=>f.getAttribute('tag')===tag);
  const sub=(node,key)=>Array.from(node?.children||[]).find(f=>f.getAttribute('code')===key)?.textContent?.trim()||'';
  const id=fields('001')[0]?.textContent.trim(),symbol=sub(fields('791')[0],'a'),date=sub(fields('992')[0],'a');
  if(!/^\d+$/.test(id)||!/^A\/RES\/[\w/.-]+$/.test(symbol)||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
  const counts=['b','c','d','e'].map(k=>Number(sub(fields('996')[0],k)||0));
  const groups=[[],[],[],[]],seen=new Set(),memberNames={};
  for(const voter of fields('967')){
   const iso=sub(voter,'c'),kind=sub(voter,'d')||'X',index=voteKinds.indexOf(kind);
   if(index<0||index>3||seen.has(iso)||!/^[A-Z]{3}$/.test(iso))throw Error('Invalid UN vote '+id);
   groups[index].push(iso);seen.add(iso);
   if(sub(voter,'e'))memberNames[iso]=sub(voter,'e').toUpperCase();
  }
  if(!seen.size)continue;
  if(counts.some((n,i)=>n!==groups[i].length))continue;
  const names={},locales={chi:'zh',fre:'fr',spa:'es',ara:'ar',rus:'ru'};
  for(const field of fields('767')){
   const locale=locales[sub(field,'9')],name=sub(field,'t');
   if(locale&&name.length>1)names[locale]=name;
  }
  out.push({id,symbol,date,title:sub(fields('245')[0],'a').replace(/\s*:\s*$/,''),counts,names,memberNames,groups:groups.map(g=>g.join(' '))});
 }
 if(!out.length)throw Error('No validated roll calls');
 return out;
}
function voteOrder(a,b){return b.date.localeCompare(a.date)||b.symbol.localeCompare(a.symbol,'en',{numeric:true})}
function votePaint(code){
 const kind=votingChoices.get(code)||'-';
 return {color:code===votingCountry?'#fff':'#182431',weight:code===votingCountry?2.5:.7,fillColor:voteColors[voteKinds.indexOf(kind)],fillOpacity:1};
}
function showVoter(code){
 const previous=votingCountry;votingCountry=code;
 for(const key of [previous,code])for(const path of paintedSeats.get(key)||[])path.setStyle(votePaint(key));
 $('voteNation').value=votingChoices.has(code)?code:'';
 $('voteResult').textContent=votingChoices.has(code)?seatName(code)+' · '+voteLabel(votingChoices.get(code)):'';
}
function labelForLand(code){
 if(votingChoices.has(code)||!voteMembers.has(code))return seatName(code);
 return countryName(voteMembers.get(code));
}
function bindVoteLand(path,getSeat){
 path.bindTooltip(()=>{
  const code=getSeat();
  return make('span',labelForLand(code)+' · '+voteLabel(votingChoices.get(code)||'-'));
 },{sticky:true});
 path.on('click',()=>{if(activeVote)openSeatDetail(getSeat())});
}
function paintVoteLand(date){
 const splits=new Map();
 if(date>='1949-10-07'&&date<'1990-10-03')splits.set('DEU',['GER','DDR']);
 if(date&&date<'1990-05-22'&&votingChoices.has('YEM'))splits.set('YEM',['YEM','YMD']);
 if(votingChoices.has('EAT')||votingChoices.has('EAZ'))splits.set('TZA',['EAT','EAZ']);
 paintedSeats.clear();
 function paint(code,path){
  path.setStyle(votePaint(code));
  if(!paintedSeats.has(code))paintedSeats.set(code,[]);
  paintedSeats.get(code).push(path);
 }
 for(const [code,path] of votePaths){
  if(splits.has(code)){if(voteMap.hasLayer(path))path.remove();continue}
  if(!voteMap.hasLayer(path))path.addTo(voteMap);
  paint(landSeat(code,date),path);
 }
 const needed=new Set([...splits.values()].flat());
 for(const [code,path] of splitLayers)if(!needed.has(code))path.remove();
 for(const code of needed){
  if(!splitLayers.has(code)){
   const path=L.GeoJSON.geometryToLayer(splitGeometry[code],{smoothFactor:.18});
   bindVoteLand(path,()=>code);splitLayers.set(code,path);
  }
  const path=splitLayers.get(code);
  if(!voteMap.hasLayer(path))path.addTo(voteMap);
  paint(code,path);
 }
}
function openSeatDetail(code){
 followNewest=false;
 if(votingChoices.has(code))chooseVoter(code);else showVoter('');
 drawSeatDetail(code);
}
function drawSeatDetail(code){
 const record=voteRecords.get(activeVote);
 if(!record){$('dialog').close();return}
 detailSeat=code;
 const body=showDialog('seatDetail','voteRecord'),kind=votingChoices.get(code)||'-';
 const title=make('h2',labelForLand(code)),badge=make('strong',voteLabel(kind),'seat-choice');
 badge.style.borderInlineStartColor=voteColors[voteKinds.indexOf(kind)];
 body.append(title,badge,make('h3',resolutionName(record)),make('p',record.date+' · '+record.symbol));
 const totals=make('div','','seat-totals');
 record.counts.forEach((n,i)=>totals.append(make('span',voteLabel(voteKinds[i])+' '+n)));
 body.append(totals);
 const links=make('div','','seat-links');body.append(links);
 for(const [key,url] of [['voteRecord','https://digitallibrary.un.org/record/'+record.id],['voteText','https://docs.un.org/'+record.symbol]]){
  const link=make('a',t(key));link.href=url;
  link.onclick=e=>{e.preventDefault();rpc('external',url)};links.append(link);
 }
}
function initVoteMap(){
 const regionBounds=[[-59,-179],[83,179]];
 voteMap=L.map('ballotMap',{crs:L.CRS.EPSG4326,zoomSnap:.05,minZoom:-1,maxZoom:10,attributionControl:false,zoomControl:true,maxBounds:[[-90,-220],[90,220]]});
 const geometries=countryFeatures.filter(f=>f.properties.iso!=='ATA');
 L.geoJSON(geometries,{smoothFactor:.18,style:f=>votePaint(voteIso(f)),onEachFeature:(f,path)=>{
  const code=voteIso(f);voteMembers.set(code,f);votePaths.set(code,path);
  shownGeometry.set(code,f.geometry);
  bindVoteLand(path,()=>landSeat(code,voteRecords.get(activeVote)?.date||''));
 }}).addTo(voteMap);
 const fit=()=>voteMap.fitBounds(regionBounds,{padding:[3,4],animate:false});
 fit();
 addVoteCartography(voteMap);
 let oldSize=voteMap.getSize();
 new ResizeObserver(()=>{
  const wasOverview=voteMap.getZoom()<=voteMap.getBoundsZoom(L.latLngBounds(regionBounds))+.1;
  voteMap.invalidateSize({pan:false});const size=voteMap.getSize();
  if(size.x!==oldSize.x||size.y!==oldSize.y){oldSize=size;if(wasOverview)fit()}
 }).observe($('ballotMap'));
}
function populateResolutions(){
 const rows=[...voteRecords.values()].sort(voteOrder),picker=$('voteSelect'),query=$('voteQuery').value.trim().toLocaleLowerCase();
 const visible=rows.filter(r=>!query||[r.symbol,r.date,r.title,resolutionName(r)].some(v=>v.toLocaleLowerCase().includes(query)));
 const items=document.createDocumentFragment();
 for(const r of visible)items.append(new Option(r.date+' · '+r.symbol+' · '+resolutionName(r),r.id));
 picker.replaceChildren(items);picker.disabled=!visible.length;
 if(!visible.some(r=>r.id===activeVote))activeVote=visible[0]?.id||'';
 picker.value=activeVote;displayRollCall();
}
function voteSourceLink(id,url){
 const link=$(id);link.href=url;link.onclick=e=>{e.preventDefault();rpc('external',url)};
}
function displayRollCall(){
 const record=voteRecords.get(activeVote);
 $('voteHeadline').textContent=record?resolutionName(record):t('empty');
 const heading=$('voteHeadline');delete heading.dataset.original;delete heading.dataset.translated;
 if(record&&lang!=='en'&&resolutionName(record)===record.title){translated(heading,record.title,{feed:'un'});observeTranslations()}
 $('voteInfo').textContent=record?record.date+'   ·   '+record.symbol:'';
 if(record && record.date<'2015-01-01')$('voteInfo').append('   ·   '+t('voteModernBorders'));
 $('voteLinks').hidden=!record;
 if(record){
  voteSourceLink('voteRecordLink','https://digitallibrary.un.org/record/'+record.id);
  voteSourceLink('voteTextLink','https://docs.un.org/'+record.symbol);
 }
 votingChoices=new Map();const legend=$('voteLegend');legend.replaceChildren();
 for(const [i,kind] of voteKinds.entries()){
  const item=make('span'),dot=make('i');dot.style.backgroundColor=voteColors[i];
  item.append(dot,document.createTextNode(voteLabel(kind)+(record&&i<4?' '+record.counts[i]:'')));legend.append(item);
  for(const iso of record?.groups[i]?.split(' ')||[])if(iso)votingChoices.set(iso,kind);
 }
 const nation=$('voteNation'),collator=new Intl.Collator(lang);
 nation.replaceChildren(new Option(t('voteCountry')+' · '+votingChoices.size,''));
 const entries=[...votingChoices.keys()].map(code=>[code,seatName(code)]).sort((a,b)=>collator.compare(a[1],b[1]));
 for(const [code,name] of entries)nation.add(new Option(name,code));
 if(!votingChoices.has(votingCountry))votingCountry='';
 paintVoteLand(record?.date||'');
 showVoter(votingCountry);
 if($('dialog').open&&$('dialog').dataset.page==='seatDetail')drawSeatDetail(detailSeat);
}
function localizeVoteView(){
 document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));
 document.title=t('voteMap');rpc('title',document.title);$('language').value=lang;
 $('voteQuery').placeholder=t('resolution')+' / №';$('voteQuery').ariaLabel=t('resolution');
 $('voteNation').ariaLabel=t('voteCountry');
 populateResolutions();$('voteStatus').textContent=t(voteState);
 if($('dialog').open&&$('dialog').dataset.page==='voteHistory')drawVoteHistory();
}
async function pullVotes(){
 try{
  const reply=await rpc('checkFeed','unvotes',JSON.stringify({known:voteSignature,arg:''}));
  if(reply.raw!=null){
   const fresh=parseRollCalls(reply.raw),updates=readLocal(voteCacheKey,{});
   for(const r of fresh){voteRecords.set(r.id,r);updates[r.id]=r}
   try{localStorage.setItem(voteCacheKey,JSON.stringify(Object.fromEntries(Object.values(updates).sort(voteOrder).slice(0,300).map(r=>[r.id,r]))))}catch{}
   voteSignature=reply.signature;if(followNewest)activeVote='';populateResolutions();
  }
  voteState='online';
 }catch{voteState=voteRecords.size?'cached':'error'}
 $('voteStatus').textContent=t(voteState);
 setTimeout(pullVotes,30000);
}
async function startVotes(){
 document.body.classList.add('votes-window');$('voteView').hidden=false;$('headVersion').textContent='v'+version;
 initVoteMap();
 $('voteQuery').oninput=()=>{followNewest=false;populateResolutions();clearTimeout(visitTimer);visitTimer=setTimeout(rememberVote,500)};
 $('voteSelect').onchange=()=>{followNewest=false;activeVote=$('voteSelect').value;displayRollCall();rememberVote()};
 $('voteNation').onchange=()=>{const code=$('voteNation').value;if(code)openSeatDetail(code);else showVoter('')};
 $('voteHistoryOpen').onclick=openVoteHistory;
 const [splits,members,archive,recent,visits]=await Promise.all([fetch('atlas/vote-splits.json').then(r=>r.json()),fetch('atlas/ga-members.json').then(r=>r.json()),fetch('atlas/ga-votes.json').then(r=>r.json()),fetch('atlas/ga-recent.xml').then(r=>r.text()),rpc('read','vote-history')]);
 splitGeometry=splits;memberAtlas=members;
 const stored=JSON.parse(visits);
 voteVisits=Array.isArray(stored)?stored.filter(v=>v?.record?.id===v.id&&Array.isArray(v.record.groups)&&Number.isFinite(v.at)).slice(0,maxVoteVisits):[];
 for(const r of [...archive,...Object.values(readLocal(voteCacheKey,{})),...parseRollCalls(recent)])voteRecords.set(r.id,{...voteRecords.get(r.id),...r});
 startDone=true;configureMenus();if(!voteVisits.some(v=>v.id===activeVote))rememberVote();$('voteHistoryOpen').disabled=false;pullVotes();
}
