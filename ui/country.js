'use strict';

const ministrySites={
 CHN:['中华人民共和国外交部','https://www.mfa.gov.cn/web/fyrbt_673021/'],
 GBR:['Foreign, Commonwealth & Development Office','https://www.gov.uk/government/organisations/foreign-commonwealth-development-office'],
 USA:['U.S. Department of State','https://www.state.gov/releases/'],
 FRA:['France Diplomatie','https://www.diplomatie.gouv.fr/en/'],
 DEU:['Auswärtiges Amt','https://www.auswaertiges-amt.de/en/'],
 JPN:['外務省','https://www.mofa.go.jp/press/release/index.html'],
 IND:['Ministry of External Affairs','https://www.mea.gov.in/press-releases.htm'],
 AUS:['Department of Foreign Affairs and Trade','https://www.dfat.gov.au/news'],
 CAN:['Global Affairs Canada','https://www.canada.ca/en/global-affairs.html'],
 NZL:['Ministry of Foreign Affairs and Trade','https://www.mfat.govt.nz/en/'],
 ITA:['Ministero degli Affari Esteri','https://www.esteri.it/en/sala_stampa/'],
 BRA:['Ministério das Relações Exteriores','https://www.gov.br/mre/pt-br'],
 CHE:['Eidgenössisches Departement für auswärtige Angelegenheiten','https://www.eda.admin.ch/eda/en/fdfa.html'],
 SGP:['Ministry of Foreign Affairs','https://www.mfa.gov.sg/'],
 ZAF:['Department of International Relations and Cooperation','https://dirco.gov.za/'],
 UKR:['Міністерство закордонних справ','https://mfa.gov.ua/en'],
 RUS:['Министерство иностранных дел','https://mid.ru/en/'],
 KOR:['Ministry of Foreign Affairs','https://www.mofa.go.kr/eng/'],
 MEX:['Secretaría de Relaciones Exteriores','https://www.gob.mx/sre'],
 TUR:['Dışişleri Bakanlığı','https://www.mfa.gov.tr/']
};
const unCalendar='https://indico.un.org/category/0/';
const knownVenues=[
 ['CHE',/Palais des Nations|Palais Wilson|\bGeneva\b|Genève/i],
 ['USA',/United Nations Headquarters|\bNew York\b/i],
 ['AUT',/Vienna International Centre|\bVienna\b/i],
 ['FRA',/UNESCO Headquarters|\bParis\b/i],['THA',/UNCC - BKK|\bBangkok\b/i],
 ['KEN',/United Nations Office at Nairobi|\bNairobi\b/i],['ITA',/\bRome\b|\bTurin\b/i],
 ['ESP',/UNGSC Building, Valencia/i],['ETH',/\bAddis Ababa\b/i],['CHL',/\bSantiago de Chile\b/i],
 ['DEU',/\bBonn\b/i],['IDN',/\bJakarta\b/i]
];
function calendarEntries(raw){
 if(!raw.startsWith('BEGIN:VCALENDAR')||!raw.includes('END:VCALENDAR'))throw Error('Calendar format');
 const entries=[];
 for(const block of raw.replace(/\r?\n[ \t]/g,'').split('BEGIN:VEVENT').slice(1)){
  const fields={};
  for(const line of block.split(/\r?\n/)){
   if(line==='END:VEVENT')break;
   const m=/^(SUMMARY|LOCATION|URL|DTSTART|STATUS):(.*)$/.exec(line);
   if(m)fields[m[1]]=m[2].replace(/\\([,;\\])/g,'$1').replace(/\\n/gi,' ');
  }
  const {SUMMARY:title,LOCATION:place='',URL:url,DTSTART:start,STATUS:status}=fields;
  const date=/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(start||'');
  if(!title||!date||!/^https:\/\/indico\.un\.org\/event\/\d+\/?$/.test(url)||status==='CANCELLED')continue;
  if(!/\b(meeting|session|conference|forum|assembly|summit|committee|workshop|dialogue|consultation|réunion)\b/i.test(title)||/\b(test|private|closed|accreditation)\b/i.test(title))continue;
  const countries=knownVenues.filter(([,re])=>re.test(place));
  if(countries.length!==1||/\b(?:meeting|conference) rooms?\s*\d*$/i.test(title))continue;
  const [,y,m,d,h,min,s]=date;
  entries.push({iso:countries[0][0],title,place,url,time:y+'-'+m+'-'+d+'T'+h+':'+min+':'+s+'Z'});
 }
 return entries;
}
function countryAt(point){
 if(!point)return '';
 const ll=[point[0],((point[1]+540)%360+360)%360-180];
 return features.find(f=>insideArea(f.properties.iso,ll))?.properties.iso||'';
}
function openCountry(code){
 if(areas[code])code='CHN';
 if(featuresByCode.has(code))return rpc('window','country',code);
 const body=showDialog('country','pickCountry'),select=make('select');
 select.id='countryChoice';select.ariaLabel=t('pickCountry');
 const choices=features.map(f=>[f.properties.iso,countryName(f)]).sort((a,b)=>a[1].localeCompare(b[1],lang));
 for(const [iso,name] of choices)opt(select,iso,name);
 select.value=readLocal('desk:last-country','CHN');
 if(!select.value)select.selectedIndex=0;
 body.append(select,button(t('countryOverview'),()=>{
   try{localStorage.setItem('desk:last-country',JSON.stringify(select.value))}catch{}
   $('dialog').close();return rpc('window','country',select.value);
 }));
 select.focus();
}
function overviewRows(code,now=Date.now()){
 const feature=featuresByCode.get(code);
 if(!feature)return [];
 const cutoff=now-86400000,seen=new Set(),rows=[];
 const name=feature.properties.en;
 const named=name?.length>=4?new RegExp('\\b'+escapeRe(name)+'\\b','i'):null;
 const aliases={USA:/\b(?:US|U\.S\.|United States|America(?:n)?)\b/,GBR:/\b(?:UK|British|Britain)\b/,CHN:/\bChinese\b/i,JPN:/\bJapanese\b/i};
 for(const feed of Object.values(cache))for(const e of feed.records||[]){
  if(!['flash','politics','conflict'].includes(e.layer)&&!(e.severity>=2&&['money','cyber','disaster','air','sea'].includes(e.layer)))continue;
  const when=Date.parse(publicationTime(e)||e.time);
  if(!Number.isFinite(when)||when<cutoff||when>now)continue;
  if(!(e.iso===code||e.cc===feature.properties.iso2||insideArea(code,e.location)||named?.test(e.title)||aliases[code]?.test(e.title)))continue;
  const key=e.links?.[0]?.url||e.id;
  if(seen.has(key))continue;
  seen.add(key);rows.push({e,when});
 }
 return rows.sort((a,b)=>b.e.severity-a.e.severity||b.when-a.when).slice(0,20).map(x=>x.e);
}
function sendCountrySnapshot(code){
 if(!featuresByCode.has(code))return;
 const official=code==='GBR'?(cache.fcdopress?.records||[]).slice(0,5):[];
 channel.postMessage({type:'countrySnapshot',code,rows:overviewRows(code),official});
}
let profileCode='',profileRows=[],profileOfficial=[],profileStatements=[],profileMeetings=[],profileCapital=null;
let hasSnapshot=false,calendarState='waiting',ministryState='waiting',countryTimer=0,pinned=false;
function requestCountry(){channel.postMessage({type:'countryRequest',code:profileCode})}
function profileMessage(m){
 if(m.type==='feeds'&&m.ids?.length&&!countryTimer){
  countryTimer=setTimeout(()=>{countryTimer=0;requestCountry()},450);
 }
 if(m.type==='countrySnapshot'&&m.code===profileCode){
  hasSnapshot=true;profileRows=m.rows;profileOfficial=m.official;renderCountry();
 }
}
function profileLink(title,url){
 const el=make('a',title);el.href=url;
 el.onclick=e=>{e.preventDefault();rpc('external',url)};return el;
}
function profileClock(){
 const clock=$('profileClock');if(!clock||!profileCapital)return;
 const locale=lang==='pcm'?'en-NG':lang==='arz'?'ar-EG':lang;
 const formatter=new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:profileCapital.zone,timeZoneName:'short'});
 clock.textContent=formatter.format(new Date());
}
function countrySection(title){
 const section=make('section');section.append(make('h2',title));return section;
}
function renderCountry(){
 if(!profileCode)return;
 const panel=$('profileBody'),name=countryName(featuresByCode.get(profileCode));
 const title=t('countryOverview')+' · '+name;
 document.title=title;if(panel.dataset.title!==title){panel.dataset.title=title;rpc('title',title)}
 $('profileHeading').textContent=name;
 const cap=profileCapital;
 $('profileCapital').textContent=t('capitalTime')+' · '+(cap?(cap.names[lang]||(lang.startsWith('zh')?cap.names.zh:'')||cap.name):'—');
 if(cap){$('profileCapital').href='https://www.geonames.org/'+cap.id+'/';$('profileCapital').onclick=e=>{e.preventDefault();rpc('external',e.currentTarget.href)}}
 profileClock();
 $('profilePin').textContent=t('pinWindow');$('profilePin').setAttribute('aria-pressed',String(pinned));
 const signature=JSON.stringify([lang,timeZoneId,hasSnapshot,profileRows.map(e=>[e.id,e.title,e.source,e.time,e.publishedAt,e.severity]),profileOfficial.map(e=>[e.id,e.title]),profileStatements,profileMeetings.filter(e=>e.iso===profileCode&&Date.parse(e.time)>Date.now()),calendarState,ministryState]);
 if(panel.profileSignature===signature)return;
 panel.profileSignature=signature;
 const events=countrySection(t('countryEvents')),ministry=countrySection(t('ministry')),meetings=countrySection(t('upcoming'));
 const addRow=(section,title,meta,action,event,url)=>{
  const row=make('div','','country-item');
  const el=url?profileLink(title,url):button(title,action);
  if(event)translated(el,title,event);
  row.append(el,make('small',meta));section.append(row);
 };
 for(const e of profileRows)addRow(events,e.title,e.source+' · '+fmt(publicationTime(e)||e.time),()=>rpc('window','detail',JSON.stringify(e)),e);
 if(!profileRows.length)events.append(make('p',t(hasSnapshot?'empty':'waiting')));
 const site=ministrySites[profileCode];
 if(site)ministry.append(profileLink(site[0]+' ↗',site[1]));
 else ministry.append(make('p',t('noMinistry')));
 for(const e of profileOfficial)if(e.links?.[0]?.url)addRow(ministry,e.title,fmt(publicationTime(e)||e.time),null,e,e.links[0].url);
 for(const e of profileStatements)addRow(ministry,e.title,e.date,null,{feed:'tg'},e.url);
 if(profileCode==='CHN'&&ministryState==='error')ministry.append(make('small',t('error')));
 const upcoming=profileMeetings.filter(e=>e.iso===profileCode&&Date.parse(e.time)>Date.now()).sort((a,b)=>a.time.localeCompare(b.time)).slice(0,8);
 for(const e of upcoming)addRow(meetings,e.title,fmt(e.time)+' · '+e.place,null,{feed:'un'},e.url);
 if(!upcoming.length)meetings.append(make('p',t(calendarState==='ready'?'empty':calendarState)));
 else if(calendarState==='error')meetings.append(make('small',t('cached')+' · '+t('error')));
 meetings.append(profileLink('Indico.UN ↗',unCalendar));
 panel.replaceChildren(events,ministry,meetings);observeTranslations();
}
async function updateCountrySource(source){
 const key='desk:profile-v1:'+source;
 try{
  const raw=await rpc('countrySource',source);
  let rows;
  if(source==='calendar'){
   rows=calendarEntries(raw).filter(e=>Date.parse(e.time)>Date.now());
   profileMeetings=rows;calendarState='ready';
  }else{
   rows=[];const base=ministrySites.CHN[1];
   const re=/<a\s+href="(\.\/[^"]+\/t(\d{4})(\d{2})(\d{2})_\d+\.shtml)"[^>]*>([^<>]+)<\/a>/gi;
   for(const m of raw.matchAll(re))rows.push({url:new URL(m[1],base).href,date:[m[2],m[3],m[4]].join('-'),title:m[5]});
   if(!rows.length)throw Error('Press index unavailable');
   rows=rows.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
   profileStatements=rows;ministryState='ready';
  }
  try{localStorage.setItem(key,JSON.stringify(rows))}catch{}
 }catch{if(source==='calendar')calendarState='error';else ministryState='error'}
 renderCountry();
}
async function startCountry(code){
 if(!featuresByCode.has(code))throw Error('Unknown country');
 profileCode=code;document.body.classList.add('country-window');$('countryProfile').hidden=false;
 $('headVersion').textContent='v'+version;
 $('profilePin').onclick=async()=>{pinned=await rpc('pinCountry','',String(!pinned));$('profilePin').setAttribute('aria-pressed',String(pinned))};
 profileMeetings=readLocal('desk:profile-v1:calendar',[]);
 profileStatements=code==='CHN'?readLocal('desk:profile-v1:china',[]):[];
 startDone=true;configureMenus();requestCountry();
 fetch('atlas/capitals.json').then(r=>r.json()).then(all=>{profileCapital=all[featuresByCode.get(code).properties.iso2];renderCountry()}).catch(()=>{});
 async function poll(){
  await Promise.all([updateCountrySource('calendar'),...(code==='CHN'?[updateCountrySource('china')]:[])]);
  setTimeout(poll,30000);
 }
 poll();setInterval(profileClock,10000);setInterval(requestCountry,30000);
}
