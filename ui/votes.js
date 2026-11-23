'use strict';
const voteKinds=['Y','N','A','X','-'];
const voteLabels=['voteYes','voteNo','voteAbstain','voteAbsent','voteMissing'];
const voteColors=['#429e8f','#dc7969','#d7ae58','#758798','#303c49'];
const voteRecords=new Map(),votePaths=new Map(),voteMembers=new Map();
const voteCacheKey='desk:un-roll-calls-v1';
let followNewest=true;
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
  const groups=[[],[],[],[]],seen=new Set();
  for(const voter of fields('967')){
   const iso=sub(voter,'c'),kind=sub(voter,'d')||'X',index=voteKinds.indexOf(kind);
   if(index<0||index>3||seen.has(iso)||!/^[A-Z]{3}$/.test(iso))throw Error('Invalid UN vote '+id);
   groups[index].push(iso);seen.add(iso);
  }
  if(!seen.size)continue;
  if(counts.some((n,i)=>n!==groups[i].length))continue;
  const names={},locales={chi:'zh',fre:'fr',spa:'es',ara:'ar',rus:'ru'};
  for(const field of fields('767')){
   const locale=locales[sub(field,'9')],name=sub(field,'t');
   if(locale&&name.length>1)names[locale]=name;
  }
  out.push({id,symbol,date,title:sub(fields('245')[0],'a').replace(/\s*:\s*$/,''),counts,names,groups:groups.map(g=>g.join(' '))});
 }
 if(!out.length)throw Error('No validated roll calls');
 return out;
}
function voteOrder(a,b){return b.date.localeCompare(a.date)||b.symbol.localeCompare(a.symbol,'en',{numeric:true})}
function votePaint(code){
 const kind=votingChoices.get(code)||'-';
 return {color:code===votingCountry?'#fff':'#182431',weight:code===votingCountry?2.5:.7,fillColor:voteColors[voteKinds.indexOf(kind)],fillOpacity:.96};
}
function showVoter(code){
 const previous=votingCountry;votingCountry=code;
 for(const key of [previous,code])votePaths.get(key)?.setStyle(votePaint(key));
 $('voteNation').value=voteMembers.has(code)?code:'';
 const f=voteMembers.get(code);
 $('voteResult').textContent=f?countryName(f)+' · '+voteLabel(votingChoices.get(code)||'-'):'';
}
function initVoteMap(){
 const regionBounds=[[-59,-179],[83,179]];
 voteMap=L.map('ballotMap',{crs:L.CRS.EPSG4326,zoomSnap:.05,minZoom:-1,maxZoom:10,attributionControl:false,zoomControl:true,maxBounds:[[-90,-220],[90,220]]});
 const geometries=countryFeatures.filter(f=>f.properties.iso!=='ATA');
 L.geoJSON(geometries,{style:f=>votePaint(voteIso(f)),onEachFeature:(f,path)=>{
  const code=voteIso(f);voteMembers.set(code,f);votePaths.set(code,path);
  path.bindTooltip(()=>make('span',countryName(f)+' · '+voteLabel(votingChoices.get(code)||'-')),{sticky:true});
  path.on('click',()=>chooseVoter(code));
 }}).addTo(voteMap);
 const fit=()=>voteMap.fitBounds(regionBounds,{padding:[3,4],animate:false});
 fit();
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
 for(const [code,path] of votePaths)path.setStyle(votePaint(code));
 showVoter(votingCountry);
}
function localizeVoteView(){
 document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));
 document.title=t('voteMap');rpc('title',document.title);$('language').value=lang;
 $('voteQuery').placeholder=t('resolution')+' / №';$('voteQuery').ariaLabel=t('resolution');
 $('voteNation').ariaLabel=t('voteCountry');
 const nation=$('voteNation');
 nation.replaceChildren(new Option(t('voteCountry'),''));
 const ordered=[...voteMembers].map(([code,f])=>[code,countryName(f)]).sort((a,b)=>a[1].localeCompare(b[1],lang));
 for(const [code,name] of ordered)nation.add(new Option(name,code));
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
 $('voteNation').onchange=()=>chooseVoter($('voteNation').value);
 $('voteHistoryOpen').onclick=openVoteHistory;
 const [archive,recent,visits]=await Promise.all([fetch('atlas/ga-votes.json').then(r=>r.json()),fetch('atlas/ga-recent.xml').then(r=>r.text()),rpc('read','vote-history')]);
 const stored=JSON.parse(visits);
 voteVisits=Array.isArray(stored)?stored.filter(v=>v?.record?.id===v.id&&Array.isArray(v.record.groups)&&Number.isFinite(v.at)).slice(0,maxVoteVisits):[];
 for(const r of [...archive,...parseRollCalls(recent),...Object.values(readLocal(voteCacheKey,{}))])voteRecords.set(r.id,r);
 startDone=true;configureMenus();if(!voteVisits.some(v=>v.id===activeVote))rememberVote();$('voteHistoryOpen').disabled=false;pullVotes();
}
