const FEED_INTERVAL_MS = 30_000;
const chinaSources={
 cnsChina:{layer:'politics',name:'中新网 · 国内',language:'zh-Hans'},
 cnsWorld:{layer:'politics',name:'中新网 · 国际',language:'zh-Hans',flash:true},
 cnsFinance:{layer:'money',name:'中新网 · 财经',language:'zh-Hans'},
 rthkChina:{layer:'politics',name:'香港電台 · 大中華',language:'zh-Hant'},
 rthkFinance:{layer:'money',name:'香港電台 · 財經',language:'zh-Hant'},
 mfaBriefings:{layer:'politics',name:'中国外交部 · 例行记者会',language:'zh-Hans',flash:true}
};
const catalogs = {
 ...Object.fromEntries(Object.entries(chinaSources).map(([id,s])=>[id,[s.layer,s.name]])),
 nasdaqComposite:['money','Nasdaq'],cnbcMarkets:['money','CNBC'],sp500News:['money','Yahoo Finance · S&P 500'],
 ...officialSources,
 ...Object.fromEntries(Object.entries(flashSources).map(([id,[name]])=>[id,['politics',name+' · Bluesky']])),
 ...Object.fromEntries(Object.entries(disclosureSources).map(([id,s])=>[id,['cyber',s.name]])),
 transits:['conflict','IMF PortWatch'],shippingnews:['conflict','Google News · Hormuz shipping'],ukrnews:['conflict','Google News · Ukraine'],
 unpeace:['conflict','UN News · Peace and Security'],crisis:['conflict','International Crisis Group'],relief:['politics','OCHA · ReliefWeb'],
 adsb:['air','adsb.lol · ODbL 1.0'],baltic:['sea','Fintraffic · Digitraffic AIS'],ships:['sea','Datalastic · AIS'],france:['politics','France 24'],aj:['politics','Al Jazeera'],
 quake:['disaster','USGS'],gdacs:['disaster','GDACS'],bbc:['politics','BBC World'],un:['politics','UN News'],
 eonet:['sat','NASA EONET'],cloud:['cyber','Google Cloud Service Health'],kev:['cyber','CISA KEV'],metar:['air','NOAA Aviation Weather'],
 buoy:['sea','NOAA NDBC'],ferry:['sea','MBTA Ferry'],fx:['money','Frankfurter · ECB'],
 crypto:['money','Coinbase Exchange'],fr24:['air','Flightradar24'],tg:['politics','Telegram'],x:['politics','X']
};
const glyph={terrain:"⛰",military:"⚐",flash:"ϟ",conflict:'◩',air:'✈',sea:'⚓︎',money:'₿',cyber:'⬡',disaster:'ϟ',politics:'⚑',sat:'◈'};
const levelNames=['unknown','low','medium','high','critical'];
const colors=['#acb6bd','#65c8cf','#f1c65b','#ff9758','#ff646d'];
const safeUrl=value=>{try{let u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
const plain=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function dateISO(value){
 if(value==null||value==='')return '';
 const time=new Date(value).getTime();
 if(!Number.isFinite(time))return '';
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Date(time).toISOString();
}
function point(lat,lon){return lat!=null&&lon!=null&&lat!==''&&lon!==''&&Number.isFinite(+lat)&&Number.isFinite(+lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?[+lat,+lon]:null;}
const fxLocations={EUR:[50.11,8.68],GBP:[51.5,-.12],JPY:[35.68,139.69],CNY:[39.9,116.4],CAD:[45.42,-75.7],AUD:[-35.28,149.13],BRL:[-15.78,-47.93],INR:[28.61,77.21],IDR:[-6.2,106.8],KRW:[37.56,126.98],TRY:[39.93,32.85],ZAR:[-25.75,28.19],CHF:[46.95,7.45],MXN:[19.43,-99.13],SEK:[59.33,18.06],NZD:[-41.29,174.78],NOK:[59.91,10.75],PLN:[52.23,21.01],SGD:[1.35,103.82],THB:[13.76,100.5],PHP:[14.6,120.98],MYR:[3.14,101.69],CZK:[50.08,14.43],DKK:[55.68,12.57],HUF:[47.5,19.04],RON:[44.43,26.1],ILS:[31.78,35.22],ISK:[64.15,-21.94],HKD:[22.32,114.17]};
function record(feed,key,title,time,location,severity,summary,url,more={}){
 if(['ships','metar'].includes(feed)&&/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?$/.test(time))time=time.replace(' ','T')+'Z';
 return {id:feed+':'+key,feed,layer:catalogs[feed][0],source:catalogs[feed][1],title:plain(title),time:dateISO(time),location,severity,summary:plain(summary),links:[{name:catalogs[feed][1],url:safeUrl(url)}],media:[],...more};
}
function xml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid XML');return doc;}
function byName(el,n){return Array.from(el.getElementsByTagNameNS('*',n));}
function content(el,n){return byName(el,n)[0]?.textContent?.trim()||'';}
function rss(feed,text,doc=xml(text)){
 const root=doc.documentElement.localName.toLowerCase();
 if((root!=='rss'&&root!=='rdf')||!byName(doc,'channel').length)throw Error('Invalid RSS channel');
 return Array.from(doc.querySelectorAll('item')).slice(0,100).map(el=>{
 const title=content(el,'title'),summary=content(el,'description');
 let url=content(el,'link'),issued=content(el,'pubDate');
 if(feed==='hkowarn')url=url.replace(/^http:\/\/www\.weather\.gov\.hk\//,'https://www.weather.gov.hk/');
 if(feed==='certeu')issued=issued.replace(/ CEST$/,' +0200').replace(/ CET$/,' +0100');
 const time=issued||content(el,'updated');
 const coords=content(el,'point').split(/\s+/),severity={Green:1,Orange:3,Red:4}[content(el,'alertlevel')]||0;
 const media=[];for(const child of [...byName(el,'thumbnail'),...byName(el,'content'),...byName(el,'enclosure')]){
 const url=safeUrl(child.getAttribute('url'));if(!url||media.some(m=>m.url===url))continue;
 const type=child.getAttribute('type')||child.getAttribute('medium')||'';if(type.startsWith('video')||/\.(mp4|webm)(\?|$)/i.test(url))media.push({type:'video',url});
 else if(child.localName==='thumbnail'||type.startsWith('image')||/\.(jpe?g|png|webp)(\?|$)/i.test(url))media.push({type:'image',url});}
 return record(feed,content(el,'guid')||url,title,time,point(coords[0],coords[1])||point(content(el,'lat'),content(el,'long')),severity,plain(summary).slice(0,1400),url,{publishedAt:dateISO(issued),source:content(el,'source')||catalogs[feed][1],excerpt:plain(content(el,'encoded')).slice(0,1500),media,place:content(el,'featureName')||content(el,'country')});
 });
}
function marketQuoteTime(value){
 const m=/^([A-Za-z]{3}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}) (AM|PM) ET$/i.exec(String(value));
 if(!m)return '';
 const month='jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').indexOf(m[1].toLowerCase());
 if(month<0||+m[4]<1||+m[4]>12||+m[5]>=60)return '';
 const hour=+m[4]%12+(m[6].toUpperCase()==='PM'?12:0);
 const day=Date.UTC(+m[3],month,+m[2],hour,+m[5]);
 // Verify the cash-session clock against New York in both standard and daylight time.
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'});
 for(const offset of [4,5]){
   const time=new Date(day+offset*3600000),p=Object.fromEntries(fmt.formatToParts(time).map(v=>[v.type,+v.value]));
   if(p.year===+m[3]&&p.month===month+1&&p.day===+m[2]&&p.hour===hour&&p.minute===+m[5])return time.toISOString();
 }
 return '';
}
function parseNasdaq(data){
 const q=data?.primaryData,time=marketQuoteTime(q?.lastTradeTimestamp);
 const number=(s,percent=false)=>{
   const value=String(s??'').trim().replace(/,/g,'');
   if(!(percent?/^[+-]?\d+(?:\.\d+)?%$/:/^[+-]?\d+(?:\.\d+)?$/).test(value))return NaN;
   return Number(value.replace('%',''));
 };
 const price=number(q?.lastSalePrice),pct=number(q?.percentageChange,true);
 if(data?.symbol!=='COMP'||!(price>0)||!Number.isFinite(pct)||!time)throw Error('Nasdaq quote unavailable');
 const quote={price,pct,live:q.isRealTime===true};
 const title='Nasdaq Composite · '+price.toLocaleString('en-US')+' · '+(pct>0?'+':'')+pct+'%';
 return [record('nasdaqComposite',time.slice(0,10),title,time,null,0,'','https://www.nasdaq.com/market-activity/index/comp',{publishedAt:time,quote})];
}
function quoteHeadline(e){
 const name=lang==='zh-Hans'?'纳斯达克综合指数':lang==='zh-Hant'?'納斯達克綜合指數':'Nasdaq Composite';
 const pct=new Intl.NumberFormat(lang,{style:'percent',signDisplay:'exceptZero',minimumFractionDigits:2,maximumFractionDigits:2}).format(e.quote.pct/100);
 return name+'　'+e.quote.price.toLocaleString(lang,{minimumFractionDigits:2,maximumFractionDigits:2})+'　'+pct;
}
function mentionsSP500(e){
 return /\bS\s*&\s*P\s*[-–]?\s*500\b|\bStandard\s*(?:&|and)\s*Poor['’]?s\s*500\b|[标標](?:[准準]普[尔爾]|普)\s*(?:500|五百)/iu.test((e.title+' '+(e.summary||'')).normalize('NFKC'));
}
function parseFeed(id,raw){
 if(id==='sp500News')return rss(id,raw).filter(e=>e.publishedAt&&e.links[0].url&&mentionsSP500(e)).map(e=>{
   const publisher=new URL(e.links[0].url).hostname.replace(/^www\./,'');
   if(e.source===catalogs[id][1])e.source=publisher;
   e.links[0].name=e.source;
   return e;
 });
 if(id==='mfaBriefings'){
   const base='https://www.mfa.gov.cn/web/fyrbt_673021/jzhsl_673025/';
   const doc=new DOMParser().parseFromString(raw,'text/html'),rows=[];
   for(const link of doc.querySelectorAll('.newsBd .list1 a[href]')){
     const href=link.getAttribute('href'),match=/^\.\/\d{6}\/t(\d{4})(\d\d)(\d\d)_\d+\.shtml$/.exec(href);
     if(!match)continue;
     const date=match.slice(1).join('-'),url=new URL(href,base).href;
     const title=link.textContent.replace(/（\d{4}-\d\d-\d\d）\s*$/,'').trim();
     if(title)rows.push(record(id,url,title,date,null,0,'',url,{publishedAt:date}));
   }
   if(!rows.length)throw Error('Press briefing index unavailable');
   return rows;
 }
 if(Object.hasOwn(chinaSources,id)){
   const rows=rss(id,raw).filter(e=>e.title&&e.publishedAt&&e.links[0].url);
   if(!rows.length)throw Error('News feed has no dated articles');
   return rows;
 }
 if(id==='nasdaqComposite')return parseNasdaq(JSON.parse(raw).data);
 if(id==='cnbcMarkets')return rss(id,raw).filter(e=>/\b(nasdaq|s&p\s?500|dow jones|dow industrials|wall street|stocks?|shares?|equities|stock markets?|earnings|futures)\b/i.test(e.title));
 if(Object.hasOwn(officialSources,id))return officialRecords(id,raw);
 if(Object.hasOwn(disclosureSources,id))return readDisclosures(id,raw,name=>{
   const hits=placeIndex.get(norm(name));if(hits?.length!==1)return null;
   const [place,,cc,lat,lon]=hits[0];return {place,cc,iso:isoByTwo.get(cc)||'',location:[lat,lon],anchor:'city'};
 });
 if(['gdacs','bbc','un','france','aj','unpeace','crisis','relief','shippingnews','ukrnews'].includes(id))return rss(id,raw);
 if(id==='buoy')return raw.trim().split(/\r?\n/).slice(2).map(line=>line.trim().split(/\s+/)).filter(a=>a.length>=16).map(a=>record(id,a[0],'NDBC '+a[0],[a[3],a[4],a[5]].join('-')+'T'+a[6]+':'+a[7]+':00Z',point(a[1],a[2]),1,
 [['WSPD',a[9],'m/s'],['WVHT',a[11],'m'],['PRES',a[15],'hPa'],['WTMP',a[17],'°C']].filter(x=>x[1]&&x[1]!=='MM').map(x=>x.join(' ')).join('  ·  '),'https://www.ndbc.noaa.gov/station_page.php?station='+encodeURIComponent(a[0])));
 if(id==='tg'){
 const doc=new DOMParser().parseFromString(raw,'text/html'), posts=[...doc.querySelectorAll('.tgme_widget_message[data-post]')];
 if(!posts.length)throw Error('Public preview unavailable');
 return posts.map(el=>{let post=el.dataset.post,body=el.querySelector('.tgme_widget_message_text')?.textContent??'',video=safeUrl(el.querySelector('video')?.getAttribute('src')),img=safeUrl(el.querySelector('.tgme_widget_message_photo_wrap')?.getAttribute('style')?.match(/url\(['"]?([^'")]+)/)?.[1]);
 return record(id,post,body.slice(0,150)||post,el.querySelector('time')?.dateTime,null,0,body,'https://t.me/'+post,{media:[...(video?[{type:'video',url:video}]:[]),...(img?[{type:'image',url:img}]:[])]});});}
 const d=JSON.parse(raw);
 switch(id){
 case 'transits':{
   if(d.error||!Array.isArray(d.features))throw Error('PortWatch unavailable');
   const days=d.features.map(f=>f.attributes).filter(a=>a&&Number.isFinite(a.n_total)&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)).sort((a,b)=>b.date.localeCompare(a.date));
   if(!days.length)return [];
   const a=days[0];return [record(id,'chokepoint6','Strait of Hormuz · commercial vessel transits',a.date,[26.56,56.25],0,
     a.date+' · '+a.n_total+' commercial transits recorded by PortWatch. Counts are estimated from AIS coverage and may be revised.',
     'https://portwatch.imf.org/',{anchor:'water',place:'Strait of Hormuz',placeZh:'霍尔木兹海峡',placeHant:'荷姆茲海峽',days})];
 }
 case 'quake':return d.features.map(f=>{const p=f.properties,g=f.geometry.coordinates;return record(id,f.id,p.title,p.time,point(g[1],g[0]),({red:4,orange:3,yellow:2,green:1})[p.alert]||0,
 [p.place,'M '+p.mag,g[2]+' km',p.status,p.alert?'PAGER '+p.alert:''].filter(Boolean).join(' · '),p.url,{place:p.place});});
 case 'adsb':return d.ac.filter(a=>/^(AAL|DAL|UAL|SWA|JBU|BAW|DLH|AFR|KLM|EZY|RYR|ANA|JAL|CCA|CES|CSN|CPA|SIA|QFA|ACA|UAE|THY|IBE|LAT|KAL|AIC)\d/.test(a.flight?.trim())&&a.lat!=null&&a.lon!=null).map(a=>record(id,a.flight.trim(),a.flight.trim()+' · '+(a.t||'ADS-B'),Number(d.now)-(a.seen_pos||0)*1000,point(a.lat,a.lon),1,[a.alt_baro+' ft',a.gs+' kt','ADS-B'].join(' · '),'https://www.adsb.lol/docs/open-data/api'));
 case 'baltic':{const vessels=new Map(d.meta.filter(v=>v.shipType>=60&&v.shipType<80).map(v=>[v.mmsi,v]));return d.positions.features.filter(f=>vessels.has(f.mmsi)&&Date.now()-f.properties.timestampExternal<86400000).map(f=>{const v=vessels.get(f.mmsi),p=f.properties,c=f.geometry.coordinates;return record(id,v.mmsi,v.name,p.timestampExternal,point(c[1],c[0]),1,[v.destination,p.sog+' kt','AIS'].filter(Boolean).join(' · '),'https://www.digitraffic.fi/en/marine-traffic/');});}
 case 'ships':return d.data.vessels.filter(v=>/^cargo/i.test(v.type)).map(v=>record(id,v.uuid,v.name,v.last_position_UTC,point(v.lat,v.lon),1,[v.type,v.speed+' kt',v.destination].filter(Boolean).join(' · '),'https://datalastic.com/'));
 case 'metar':return d.map(a=>record(id,a.icaoId,a.icaoId+' · '+a.name,a.reportTime,point(a.lat,a.lon),1,a.rawOb,'https://aviationweather.gov/data/metar/?id='+a.icaoId,{place:a.name,flightCategory:a.fltCat||''}));
 case 'ferry':return d.data.map(f=>{const a=f.attributes;return record(id,f.id,'MBTA · '+(a.label||f.id),a.updated_at,point(a.latitude,a.longitude),1,[f.relationships.route.data?.id,a.current_status].filter(Boolean).join(' · '),'https://www.mbta.com/schedules/ferry');});
 case 'fx':return Object.entries(d.rates).map(([currency,rate])=>record(id,currency,'USD / '+currency+'   '+rate,d.date,fxLocations[currency]||null,1,'1 USD = '+rate+' '+currency+' · '+d.date,'https://www.frankfurter.dev/',{anchor:'currency'}));
 case 'crypto':return [record(id,'btc','BTC / USD   '+Number(d.price).toLocaleString(),d.time,null,1,'Bid '+d.bid+' USD · Ask '+d.ask+' USD','https://exchange.coinbase.com/trade/BTC-USD')];
 case 'cloud':{
 const places={'europe-west2':[51.5,-.12],'europe-west1':[50.45,3.82],'europe-west3':[50.11,8.68],'europe-west4':[53.44,6.84],'us-central1':[41.26,-95.86],'us-east1':[33.2,-80.01],'us-west1':[45.59,-121.18],'us-east4':[39.04,-77.49],'asia-east1':[24.08,120.54],'asia-northeast1':[35.68,139.69],'asia-southeast1':[1.35,103.82],'asia-south1':[19.08,72.88],'australia-southeast1':[-33.87,151.21],'southamerica-east1':[-23.55,-46.63]};
 return d.slice(0,30).flatMap(i=>{const affected=[...i.currently_affected_locations||[],...i.previously_affected_locations||[]];const unique=[...new Map(affected.map(p=>[p.id,p])).values()];return (unique.length?unique:[{}]).map(p=>record(id,i.id+':'+(p.id||''),i.external_desc,i.modified||i.end||i.begin,places[p.id]||null,i.end?1:0,[p.title,i.begin,i.end].filter(Boolean).join(' · '),'https://status.cloud.google.com/'+i.uri,{place:p.title,anchor:'region',publishedAt:dateISO(i.created)}));});}
 case 'kev':return d.vulnerabilities.sort((a,b)=>b.dateAdded.localeCompare(a.dateAdded)).slice(0,100).map(v=>record(id,v.cveID,v.cveID+' · '+v.vulnerabilityName,v.dateAdded,null,0,v.shortDescription+' '+v.requiredAction,'https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search='+v.cveID,{links:[{name:'CISA KEV',url:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search='+v.cveID},{name:'CVE',url:'https://www.cve.org/CVERecord?id='+v.cveID}]}));
 case 'eonet':return d.events.map(e=>{let g=e.geometry.at(-1);let coords=g?.type==='Point'?g.coordinates:[];return record(id,e.id,e.title,g?.date,point(coords[1],coords[0]),0,e.description||e.categories.map(c=>c.title).join(', '),e.link,{links:[{name:'NASA EONET',url:safeUrl(e.link)},...e.sources.map(s=>({name:s.id,url:safeUrl(s.url)}))]});});
 case 'fr24':return d.data.map(a=>record(id,a.fr24_id,a.callsign||a.flight||a.fr24_id,a.timestamp,point(a.lat,a.lon),1,[a.alt+' ft',a.gspeed+' kt'].join(' · '),'https://www.flightradar24.com/'+encodeURIComponent(a.callsign||'')+'/'+encodeURIComponent(a.fr24_id)));
 case 'x':return (d.data||[]).map(p=>{const media=(d.includes?.media||[]).filter(m=>p.attachments?.media_keys?.includes(m.media_key)).flatMap(m=>{const video=m.variants?.find(v=>v.content_type==='video/mp4');const url=safeUrl(video?.url||m.url||m.preview_image_url);return url?[{type:video?'video':'image',url}]:[]});return record(id,p.id,p.text.slice(0,150),p.created_at,null,0,p.text,'https://x.com/i/web/status/'+p.id,{media});});
 default:throw Error('Unknown feed');}
}

