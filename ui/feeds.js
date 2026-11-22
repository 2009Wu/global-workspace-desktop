const catalogs = {
 adsb:['air','adsb.lol · ODbL 1.0',5],baltic:['sea','Fintraffic · Digitraffic AIS',5],ships:['sea','Datalastic · AIS',10],france:['politics','France 24',10],aj:['politics','Al Jazeera',10],
 quake:['disaster','USGS',5],gdacs:['disaster','GDACS',10],bbc:['politics','BBC World',10],un:['politics','UN News',15],
 eonet:['sat','NASA EONET',30],cloud:['cyber','Google Cloud Service Health',15],kev:['cyber','CISA KEV',120],metar:['air','NOAA Aviation Weather',10],
 buoy:['sea','NOAA NDBC',15],ferry:['sea','MBTA Ferry',2],fx:['money','Frankfurter · ECB',120],
 crypto:['money','Coinbase Exchange',2],fr24:['air','Flightradar24',5],tg:['politics','Telegram',10],x:['politics','X',15]
};
const glyph={air:'✈',sea:'⚓︎',money:'₿',cyber:'⬡',disaster:'ϟ',politics:'⚑',sat:'◈'};
const levelNames=['unknown','low','medium','high','critical'];
const colors=['#acb6bd','#65c8cf','#f1c65b','#ff9758','#ff646d'];
const safeUrl=value=>{try{let u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
const plain=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function dateISO(value){const time=new Date(value).getTime();return Number.isFinite(time)?new Date(time).toISOString():'';}
function point(lat,lon){return lat!=null&&lon!=null&&lat!==''&&lon!==''&&Number.isFinite(+lat)&&Number.isFinite(+lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?[+lat,+lon]:null;}
const fxLocations={EUR:[50.11,8.68],GBP:[51.5,-.12],JPY:[35.68,139.69],CNY:[39.9,116.4],CAD:[45.42,-75.7],AUD:[-35.28,149.13],BRL:[-15.78,-47.93],INR:[28.61,77.21],IDR:[-6.2,106.8],KRW:[37.56,126.98],TRY:[39.93,32.85],ZAR:[-25.75,28.19],CHF:[46.95,7.45],MXN:[19.43,-99.13],SEK:[59.33,18.06],NZD:[-41.29,174.78],NOK:[59.91,10.75],PLN:[52.23,21.01],SGD:[1.35,103.82],THB:[13.76,100.5],PHP:[14.6,120.98],MYR:[3.14,101.69],CZK:[50.08,14.43],DKK:[55.68,12.57],HUF:[47.5,19.04],RON:[44.43,26.1],ILS:[31.78,35.22],ISK:[64.15,-21.94],HKD:[22.32,114.17]};
function record(feed,key,title,time,location,severity,summary,url,more={}){
 return {id:feed+':'+key,feed,layer:catalogs[feed][0],source:catalogs[feed][1],title:plain(title),time:dateISO(time),location,severity,summary:plain(summary),links:[{name:catalogs[feed][1],url:safeUrl(url)}],media:[],...more};
}
function xml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid XML');return doc;}
function byName(el,n){return Array.from(el.getElementsByTagNameNS('*',n));}
function content(el,n){return byName(el,n)[0]?.textContent?.trim()||'';}
function rss(feed,text){
 return Array.from(xml(text).querySelectorAll('item')).slice(0,100).map(el=>{
 const title=content(el,'title'),url=content(el,'link'),time=content(el,'pubDate'),summary=content(el,'description');
 const coords=content(el,'point').split(/\s+/),severity={Green:1,Orange:3,Red:4}[content(el,'alertlevel')]||0;
 const media=[];for(const child of [...byName(el,'thumbnail'),...byName(el,'content'),...byName(el,'enclosure')]){
 const url=safeUrl(child.getAttribute('url'));if(!url||media.some(m=>m.url===url))continue;
 const type=child.getAttribute('type')||child.getAttribute('medium')||'';if(type.startsWith('video')||/\.(mp4|webm)(\?|$)/i.test(url))media.push({type:'video',url});
 else if(child.localName==='thumbnail'||type.startsWith('image')||/\.(jpe?g|png|webp)(\?|$)/i.test(url))media.push({type:'image',url});}
 return record(feed,content(el,'guid')||url,title,time,point(coords[0],coords[1]),severity,summary,url,{media,place:content(el,'country')});
 });
}
function parseFeed(id,raw){
 if(['gdacs','bbc','un','france','aj'].includes(id))return rss(id,raw);
 if(id==='buoy')return raw.trim().split(/\r?\n/).slice(2).map(line=>line.trim().split(/\s+/)).filter(a=>a.length>=16).map(a=>record(id,a[0],'NDBC '+a[0],[a[3],a[4],a[5]].join('-')+'T'+a[6]+':'+a[7]+':00Z',point(a[1],a[2]),1,
 [['WSPD',a[9],'m/s'],['WVHT',a[11],'m'],['PRES',a[15],'hPa'],['WTMP',a[17],'°C']].filter(x=>x[1]&&x[1]!=='MM').map(x=>x.join(' ')).join('  ·  '),'https://www.ndbc.noaa.gov/station_page.php?station='+encodeURIComponent(a[0])));
 if(id==='tg'){
 const doc=new DOMParser().parseFromString(raw,'text/html'), posts=[...doc.querySelectorAll('.tgme_widget_message[data-post]')];
 if(!posts.length)throw Error('Public preview unavailable');
 return posts.map(el=>{let post=el.dataset.post,body=el.querySelector('.tgme_widget_message_text')?.textContent??'',video=safeUrl(el.querySelector('video')?.getAttribute('src')),img=safeUrl(el.querySelector('.tgme_widget_message_photo_wrap')?.getAttribute('style')?.match(/url\(['"]?([^'")]+)/)?.[1]);
 return record(id,post,body.slice(0,150)||post,el.querySelector('time')?.dateTime,null,0,body,'https://t.me/'+post,{media:[...(video?[{type:'video',url:video}]:[]),...(img?[{type:'image',url:img}]:[])]});});}
 const d=JSON.parse(raw);
 switch(id){
 case 'quake':return d.features.map(f=>{const p=f.properties,g=f.geometry.coordinates;return record(id,f.id,p.title,p.time,point(g[1],g[0]),({red:4,orange:3,yellow:2,green:1})[p.alert]||0,
 [p.place,'M '+p.mag,g[2]+' km',p.status,p.alert?'PAGER '+p.alert:''].filter(Boolean).join(' · '),p.url);});
 case 'adsb':return d.ac.filter(a=>/^(AAL|DAL|UAL|SWA|JBU|BAW|DLH|AFR|KLM|EZY|RYR|ANA|JAL|CCA|CES|CSN|CPA|SIA|QFA|ACA|UAE|THY|IBE|LAT|KAL|AIC)\d/.test(a.flight?.trim())&&a.lat!=null&&a.lon!=null).map(a=>record(id,a.flight.trim(),a.flight.trim()+' · '+(a.t||'ADS-B'),Number(d.now)-(a.seen_pos||0)*1000,point(a.lat,a.lon),1,[a.alt_baro+' ft',a.gs+' kt','ADS-B'].join(' · '),'https://www.adsb.lol/docs/open-data/api'));
 case 'baltic':{const vessels=new Map(d.meta.filter(v=>v.shipType>=60&&v.shipType<80).map(v=>[v.mmsi,v]));return d.positions.features.filter(f=>vessels.has(f.mmsi)&&Date.now()-f.properties.timestampExternal<86400000).map(f=>{const v=vessels.get(f.mmsi),p=f.properties,c=f.geometry.coordinates;return record(id,v.mmsi,v.name,p.timestampExternal,point(c[1],c[0]),1,[v.destination,p.sog+' kt','AIS'].filter(Boolean).join(' · '),'https://www.digitraffic.fi/en/marine-traffic/');});}
 case 'ships':return d.data.vessels.filter(v=>/^cargo/i.test(v.type)).map(v=>record(id,v.uuid,v.name,v.last_position_UTC,point(v.lat,v.lon),1,[v.type,v.speed+' kt',v.destination].filter(Boolean).join(' · '),'https://datalastic.com/'));
 case 'metar':return d.map(a=>record(id,a.icaoId,a.icaoId+' · '+a.name,a.reportTime,point(a.lat,a.lon),({VFR:1,MVFR:2,IFR:3,LIFR:4})[a.fltCat]||0,a.rawOb,'https://aviationweather.gov/data/metar/?id='+a.icaoId));
 case 'ferry':return d.data.map(f=>{const a=f.attributes;return record(id,f.id,'MBTA · '+(a.label||f.id),a.updated_at,point(a.latitude,a.longitude),1,[f.relationships.route.data?.id,a.current_status].filter(Boolean).join(' · '),'https://www.mbta.com/schedules/ferry');});
 case 'fx':return Object.entries(d.rates).map(([currency,rate])=>record(id,currency,'USD / '+currency+'   '+rate,d.date,fxLocations[currency]||null,1,'1 USD = '+rate+' '+currency+' · '+d.date,'https://www.frankfurter.dev/',{anchor:'currency'}));
 case 'crypto':return [record(id,'btc','BTC / USD   '+Number(d.price).toLocaleString(),d.time,null,1,'Bid '+d.bid+' USD · Ask '+d.ask+' USD','https://exchange.coinbase.com/trade/BTC-USD')];
 case 'cloud':{
 const places={'europe-west2':[51.5,-.12],'europe-west1':[50.45,3.82],'europe-west3':[50.11,8.68],'europe-west4':[53.44,6.84],'us-central1':[41.26,-95.86],'us-east1':[33.2,-80.01],'us-west1':[45.59,-121.18],'us-east4':[39.04,-77.49],'asia-east1':[24.08,120.54],'asia-northeast1':[35.68,139.69],'asia-southeast1':[1.35,103.82],'asia-south1':[19.08,72.88],'australia-southeast1':[-33.87,151.21],'southamerica-east1':[-23.55,-46.63]};
 return d.slice(0,30).flatMap(i=>{const affected=[...i.currently_affected_locations||[],...i.previously_affected_locations||[]];const unique=[...new Map(affected.map(p=>[p.id,p])).values()];return (unique.length?unique:[{}]).map(p=>record(id,i.id+':'+(p.id||''),i.external_desc,i.modified||i.end||i.begin,places[p.id]||null,i.end?1:0,[p.title,i.begin,i.end].filter(Boolean).join(' · '),'https://status.cloud.google.com/'+i.uri));});}
 case 'kev':return d.vulnerabilities.sort((a,b)=>b.dateAdded.localeCompare(a.dateAdded)).slice(0,100).map(v=>record(id,v.cveID,v.cveID+' · '+v.vulnerabilityName,v.dateAdded,null,0,v.shortDescription+' '+v.requiredAction,'https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search='+v.cveID,{links:[{name:'CISA KEV',url:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search='+v.cveID},{name:'CVE',url:'https://www.cve.org/CVERecord?id='+v.cveID}]}));
 case 'eonet':return d.events.map(e=>{let g=e.geometry.at(-1);let coords=g?.type==='Point'?g.coordinates:[];return record(id,e.id,e.title,g?.date,point(coords[1],coords[0]),0,e.description||e.categories.map(c=>c.title).join(', '),e.link,{links:[{name:'NASA EONET',url:safeUrl(e.link)},...e.sources.map(s=>({name:s.id,url:safeUrl(s.url)}))]});});
 case 'fr24':return d.data.map(a=>record(id,a.fr24_id,a.callsign||a.flight||a.fr24_id,a.timestamp,point(a.lat,a.lon),1,[a.alt+' ft',a.gspeed+' kt'].join(' · '),'https://www.flightradar24.com/'+encodeURIComponent(a.callsign||'')+'/'+encodeURIComponent(a.fr24_id)));
 case 'x':return (d.data||[]).map(p=>{const media=(d.includes?.media||[]).filter(m=>p.attachments?.media_keys?.includes(m.media_key)).flatMap(m=>{const video=m.variants?.find(v=>v.content_type==='video/mp4');const url=safeUrl(video?.url||m.url||m.preview_image_url);return url?[{type:video?'video':'image',url}]:[]});return record(id,p.id,p.text.slice(0,150),p.created_at,null,0,p.text,'https://x.com/i/web/status/'+p.id,{media});});
 default:throw Error('Unknown feed');}
}

