'use strict';

const officialSources={
 aaib:['air','UK Air Accidents Investigation Branch'],maib:['sea','UK Marine Accident Investigation Branch'],
 fedpolicy:['money','Federal Reserve · Monetary Policy'],
 ecbpress:['money','European Central Bank'],
 fcdopress:['politics','UK Foreign Office · Press'],
 councilpress:['politics','Council of the EU · Press'],
 certeu:['cyber','CERT-EU · Security Advisories'],
 githubstatus:['cyber','GitHub Status'],
 nhcat:['disaster','NHC · Atlantic'],
 nhcep:['disaster','NHC · Eastern Pacific'],
 ntwc:['disaster','National Tsunami Warning Center'],
 ptwc:['disaster','Pacific Tsunami Warning Center'],
 hkowarn:['disaster','Hong Kong Observatory'],
 nwsalerts:['disaster','US National Weather Service']
};

function tsunamiBulletins(feed,raw){
 const doc=xml(raw);
 if(doc.documentElement.localName!=='feed')throw Error('Invalid tsunami bulletin feed');
 return byName(doc,'entry').map(el=>{
  const area=content(el,'title'),summary=byName(el,'summary')[0];
  const labels=summary?[...byName(summary,'strong')]:[];
  const field=name=>labels.find(label=>label.textContent.trim().replace(/:$/,'')===name)?.nextSibling?.textContent.trim()||'';
  const category=field('Category');
  for(const br of summary?byName(summary,'br'):[])br.replaceWith(doc.createTextNode(' '));
  const issued=field('Bulletin Issue Time').match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d\d:\d\d:\d\d)\s+UTC$/);
  const publishedAt=issued?dateISO(issued.slice(1,4).join('-')+'T'+issued[4]+'Z'):'';
  const link=byName(el,'link').find(x=>x.getAttribute('rel')==='alternate')?.getAttribute('href');
  const title=[category?'Tsunami bulletin · '+category:'Tsunami bulletin',area].filter(Boolean).join(' — ');
  return record(feed,content(el,'id')||link,title,publishedAt||content(el,'updated'),
   point(content(el,'lat'),content(el,'long')),0,plain(summary?.textContent).slice(0,1800),link,{publishedAt,place:area});
 });
}
function officialRecords(feed,raw){
 if(feed==='ptwc'||feed==='ntwc')return tsunamiBulletins(feed,raw);
 if(feed==='aaib'||feed==='maib'){
  const {results}=JSON.parse(raw);
  return results.filter(x=>x.title&&x.link?.startsWith('/'+feed+'-reports/')).map(x=>{
   const description=plain(x.description),text=(x.title+' '+description).toLowerCase()
    .replace(/\b(?:non[- ]fatal|(?:no|without)(?: any)? (?:fatalities|serious injuries|minor injuries|substantial damage)|not (?:seriously|fatally) injured)\b/g,'');
   // Use explicit consequences in the published investigation summary.
   const fatal=/\b(?:fatal accident|fatally injured|loss of (?:a life|(?:one|two|three|four|five|six|seven|eight|nine|ten|multiple|several|all|\d+) (?:lives|life))|one fatality)\b/.test(text);
   const serious=/\b(?:seriously injured|sustained serious injuries|serious incident|substantial damage)\b/.test(text);
   const minor=/\b(?:minor injuries|minor damage)\b/.test(text);
   const locationText=description.replace(/^Location:\s*/i,'');
   let place=null;
   if(!/\b(?:passage from|route from|miles?|offshore|off the coast|en route)\b/i.test(locationText)){
    const fields=locationText.split(',').map(part=>part.trim().replace(/[.;]$/,''));
    for(const field of fields){
     const hits=placeIndex.get(norm(field));
     if(hits?.length===1){const [name,,cc,lat,lon]=hits[0];place={anchor:'city',iso:isoByTwo.get(cc)||'',location:[lat,lon],place:name};break}
    }
    if(/^English Channel\.?$/i.test(locationText))place={anchor:'water',location:[50.25,-1.5],place:'English Channel',placeZh:'英吉利海峡',placeHant:'英吉利海峽'};
   }
   return record(feed,x.link,x.title,x.public_timestamp,null,fatal?4:serious?3:minor?2:0,description,'https://www.gov.uk'+x.link,{publishedAt:dateISO(x.first_published_at),...place});
  });
 }
 if(feed==='fcdopress'){
  const {results}=JSON.parse(raw);
  if(!Array.isArray(results))throw Error('Invalid GOV.UK search response');
  return results.filter(x=>x.title&&x.link?.startsWith('/government/')).map(x=>
   record(feed,x.link,x.title,x.public_timestamp,null,0,x.description,'https://www.gov.uk'+x.link,
    {publishedAt:dateISO(x.first_published_at)}));
 }
 if(feed==='githubstatus'){
  const {incidents}=JSON.parse(raw);
  if(!Array.isArray(incidents))throw Error('Invalid GitHub Status feed');
  return incidents.filter(i=>i.id&&i.name).map(i=>{
   const updates=(i.incident_updates||[]).slice().sort((a,b)=>Date.parse(b.display_at||b.created_at)-Date.parse(a.display_at||a.created_at));
   const summary=[i.status,updates[0]?.body].filter(Boolean).join(' · ');
   return record(feed,i.id,i.name,i.updated_at||i.created_at,null,0,summary.slice(0,1600),
    'https://www.githubstatus.com/incidents/'+encodeURIComponent(i.id),{publishedAt:dateISO(i.created_at)});
  });
 }
 if(feed==='nwsalerts'){
  const {features}=JSON.parse(raw);
  if(!Array.isArray(features))throw Error('Invalid NWS alert feed');
  return features.filter(f=>f.properties?.status==='Actual'&&['Severe','Extreme'].includes(f.properties.severity)).map(f=>{
   const p=f.properties,coords=f.geometry?.type==='Point'?f.geometry.coordinates:[];
   return record(feed,p.id,p.headline||p.event,p.sent,point(coords[1],coords[0]),p.severity==='Extreme'?4:3,
    [p.areaDesc,p.description,p.instruction].filter(Boolean).join(' · ').slice(0,2400),
    f.id,{publishedAt:dateISO(p.sent),place:p.areaDesc});
  });
 }
 const channel=xml(raw);
 if(!channel.querySelector('rss > channel'))throw Error('Invalid official RSS channel');
 return rss(feed,raw,channel).filter(e=>{
  if((feed==='nhcat'||feed==='nhcep')&&/^There are no tropical cyclones/i.test(e.title))return false;
  if(feed==='hkowarn'&&/現時並無警告生效/.test(e.title))return false;
  return !!(e.title&&e.time&&e.links[0].url);
 });
}
