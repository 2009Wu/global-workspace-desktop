'use strict';

// Both clients use these public disclosure feeds. No victim account lookups are made.
const disclosureSources = {
  recordnews: {name:'The Record', url:'https://therecord.media/news/cybercrime/feed'},
  hibp: {name:'Have I Been Pwned', url:'https://haveibeenpwned.com/api/v3/breaches'}
};
// Representative state points from US Census 2020 mean centers of population.
const affectedStates={"Alabama":[33.02,-86.75],"Alaska":[61.41,-148.96],"Arizona":[33.37,-111.88],"Arkansas":[35.2,-92.71],"California":[35.49,-119.35],"Colorado":[39.53,-105.19],"Connecticut":[41.49,-72.88],"Delaware":[39.33,-75.55],"District of Columbia":[38.91,-77.01],"Florida":[27.84,-81.64],"Georgia":[33.41,-83.89],"Hawaii":[21.11,-157.49],"Idaho":[44.22,-115.22],"Illinois":[41.31,-88.37],"Indiana":[40.14,-86.25],"Iowa":[41.94,-93.04],"Kansas":[38.48,-96.41],"Kentucky":[37.84,-85.26],"Louisiana":[30.7,-91.47],"Maine":[44.27,-69.76],"Maryland":[39.14,-76.8],"Massachusetts":[42.27,-71.35],"Michigan":[42.86,-84.21],"Minnesota":[45.19,-93.56],"Mississippi":[32.58,-89.57],"Missouri":[38.43,-92.23],"Montana":[46.76,-111.32],"Nebraska":[41.17,-97.22],"Nevada":[37.02,-116.17],"New Hampshire":[43.15,-71.46],"New Jersey":[40.44,-74.42],"New Mexico":[34.61,-106.33],"New York":[41.47,-74.59],"North Carolina":[35.54,-79.68],"North Dakota":[47.34,-99.44],"Ohio":[40.44,-82.8],"Oklahoma":[35.61,-96.85],"Oregon":[44.75,-122.59],"Pennsylvania":[40.44,-76.97],"Rhode Island":[41.76,-71.45],"South Carolina":[34.02,-81],"South Dakota":[43.99,-98.92],"Tennessee":[35.82,-86.33],"Texas":[30.91,-97.33],"Utah":[40.39,-111.95],"Vermont":[44.1,-72.82],"Virginia":[37.85,-77.77],"Washington":[47.33,-121.63],"West Virginia":[38.82,-80.67],"Wisconsin":[43.72,-89.03],"Wyoming":[42.69,-106.98],"Puerto Rico":[18.28,-66.35]};
function disclosureLocation(title, lookupCity, summary='') {
  // A named victim jurisdiction is an affected area, not a server or attacker position.
  const state=title.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+){0,2}) (?:Legislature|State Government|state government|state legislature) (?:hit (?:by|with)|discloses|reports|confirms|suffers)\b/);
  if(state && Object.hasOwn(affectedStates,state[1]))
    return {location:affectedStates[state[1]],anchor:'region',place:state[1]+', US',cc:'US',iso:'USA'};
  const patterns=[
    /^(?:The )?(?:[Cc]ity|[Mm]unicipality) of ([\p{Lu}][\p{L}.'’-]*(?: [\p{Lu}][\p{L}.'’-]*){0,3})(?= (?:hit|struck|confirms|suffers|reports|discloses|restores|shuts|warns|investigates)\b)/u,
    /(?:attack (?:on|hits)|breach (?:at|hits)|hackers (?:hit|breach)) (?:the )?(?:city|municipality) of ([\p{Lu}][\p{L}.'’-]*(?: [\p{Lu}][\p{L}.'’-]*){0,3})(?=$|[,.:;]| [a-z])/u,
    /^([\p{Lu}][\p{L}.'’-]*(?: [\p{Lu}][\p{L}.'’-]*){0,3}) (?:city government|city council|city services) (?:hit|struck|disclose|discloses|confirm|confirms|suffer|suffers|disrupted)\b/u
  ];
  for(const pattern of patterns){const match=title.match(pattern);if(match){const site=lookupCity(match[1]);if(site)return site}}
  // Require the place to modify an affected service, not a reporter or suspect.
  const affected=/(?:\b(?:attack|breach|outage) (?:hit|affected|disrupted)|\b(?:hackers|ransomware) (?:shut down|disrupted|hit|breached)) (?:the |a |an |several |two )?(?:hospitals?|schools?|clinics?|city services|municipal systems|transit services|government offices) in ([\p{Lu}][\p{L}.'’-]*(?: [\p{Lu}][\p{L}.'’-]*){0,3})(?=$|[.,;:]| [a-z])/gu;
  const cities=new Map();
  for(const m of (title+'. '+summary).matchAll(affected)){const city=lookupCity(m[1]);if(!city)return {location:null};cities.set(m[1],city)}
  if(cities.size===1)return [...cities.values()][0];
  return {location:null};
}
function readDisclosures(feed, raw, lookupCity) {
  const src=disclosureSources[feed];
  const date=v=>{const n=Date.parse(v);return Number.isFinite(n)?new Date(n).toISOString():''};
  const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const entry=(key,title,time,summary,url,more={})=>({id:feed+':'+key,feed,source:src.name,layer:'cyber',title,time,summary,
    location:null,severity:0,links:[{name:src.name,url}],media:[],disclosure:true,...more});
  if(feed==='hibp'){
    const data=JSON.parse(raw);if(!Array.isArray(data))throw Error('Invalid HIBP catalogue');
    return data.filter(x=>x.IsVerified===true&&!x.IsFabricated&&!x.IsSpamList&&!x.IsRetired&&!x.IsStealerLog&&!x.IsMalware&&x.Name&&x.Title&&date(x.AddedDate))
      .sort((a,b)=>b.AddedDate.localeCompare(a.AddedDate)).slice(0,60).map(x=>{
        const url='https://haveibeenpwned.com/Breach/'+encodeURIComponent(x.Name);
        const summary=clean(x.Description).slice(0,1400);
        return entry(x.Name,x.Title+' · data breach',date(x.AddedDate),summary,url,{
          ...disclosureLocation(x.Title+' confirms data breach',lookupCity),
          incidentDate:/^\d{4}-\d\d-\d\d$/.test(x.BreachDate)?x.BreachDate:'',
          subject:x.Title,attribution:clean(x.Attribution),accountCount:x.PwnCount,domain:x.Domain||''});
      });
  }
  const doc=new DOMParser().parseFromString(raw,'application/xml');
  if(doc.querySelector('parsererror')||!doc.querySelector('rss channel'))throw Error('Invalid incident RSS');
  const results=new Map();
  for(const item of doc.querySelectorAll('channel > item')){
    const value=tag=>item.querySelector(tag)?.textContent.trim()||'';
    const title=clean(value('title')),summary=clean(value('description')),time=date(value('pubDate'));
    let url;try{url=new URL(value('link'));if(url.origin!=='https://therecord.media'||url.username||url.password)continue;url.hash='';url.search=''}catch{continue}
    if(!time||!title||/\b(?:could|might|drill|exercise|simulation|hypothetical|no evidence of|risk of|how to|preparing for|warns of potential)\b/i.test(title))continue;
    const incident=/\b(?:cyber[ -]?attacks?|ransomware attack|data breach|supplier breach|security breach|cyber(?:security)? incident|DDoS attack|hackers? (?:stole|disrupted|breached)|attack on (?:a |an |the )?(?:university|hospital|company|city))\b/i;
    if(!incident.test(title)||!/(?:\b(?:hit|struck|attack on|discloses?|disclosed|confirms?|confirmed|disrupts?|disrupted|following|after|investigat\w*|stole|breached|shut\w*|affected|affects|exposed|restores?|victims?|suffers?|suffered)\b)/i.test(title+' '+summary))continue;
    results.set(url.href,entry(url.href,title,time,summary,url.href,disclosureLocation(title,lookupCity,summary)));
  }
  return [...results.values()];
}
