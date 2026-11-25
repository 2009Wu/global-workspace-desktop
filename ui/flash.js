'use strict';
// Domain handles are checked together with permanent AT Protocol identifiers.
const flashSources={
 flashReuters:['Reuters','reuters.com','did:plc:jbvnehrrdqoulco4rf5gxg5r'],
 flashAP:['Associated Press','apnews.com','did:plc:a67zdrt4nl2tv2qojpngogbq'],
 flashAFP:['Agence France-Presse','en.afp.com','did:plc:r4ve5hjtfjubdwrvlxcad62e'],
 flashPolitico:['POLITICO Europe','politico.eu','did:plc:bak7f4b3jsiqlpyo6o4ejaji'],
 flashEC:['European Commission','ec.europa.eu','did:plc:oxo226vi7t2btjokm2buusoy'],
 flashCouncil:['Council of the EU','consilium.europa.eu','did:plc:p7p4oif45fw3r554m5byp54q']
};
const flashByDid=new Map(Object.entries(flashSources).map(([id,source])=>[source[2],id]));
const flashTopic=/\b(breaking|just in|news alert|urgent|diploma\w*|peace talks?|cease-?fire|sanctions?|treat(y|ies)|ambassadors?|summit|negotiat\w*|elections?|referend\w*|parliament\w*|cabinet|government|president\w*|prime minister|foreign minist\w*|foreign secretary|chancellor|coup|impeach\w*|resign\w*|coalition|opposition leader|supreme court|security council|united nations|nato|g7|g20|european (union|council|commission)|white house|kremlin|paris accord|bilateral|multilateral|hostages?|invasion|airstrikes?|missile strikes?|declares? war|martial law|border closure|state of emergency|protests?|demonstrators?|peace deal|trade deal|tariffs?|foreign policy)\b/i;
function flashPost(feed,rkey,post){
 if(!post||post.reply||post.$type!=='app.bsky.feed.post'||!/^[a-zA-Z0-9._~:-]{1,512}$/.test(rkey))return null;
 const text=String(post.text||'').trim(),external=post.embed?.external||post.embed?.media?.external;
 const headline=plain(external?.title);
 if(!text||!dateISO(post.createdAt)||!flashTopic.test(text+' '+headline))return null;
 const [name,,did]=flashSources[feed];
 const url='https://bsky.app/profile/'+did+'/post/'+encodeURIComponent(rkey);
 const links=[{name,url}],article=safeUrl(external?.uri);
 if(article)links.push({name:headline||name,url:article});
 const title=(text.split(/\n/).find(s=>s.trim()&&!/^https?:\/\//i.test(s))||headline||text).slice(0,240);
 return record(feed,rkey,title,post.createdAt,null,0,text,url,{publishedAt:dateISO(post.createdAt),links});
}
async function fetchFlash(feed){
 const [,handle,did]=flashSources[feed],query=new URLSearchParams({actor:did,limit:'80',filter:'posts_no_replies'});
 const response=await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?'+query,{credentials:'omit',signal:AbortSignal.timeout(14000)});
 if(!response.ok)throw Error('Bluesky HTTP '+response.status);
 const data=await response.json();if(!Array.isArray(data.feed))throw Error('Invalid author feed');
 const rows=[];
 for(const item of data.feed){
  const p=item.post,prefix='at://'+did+'/app.bsky.feed.post/';
  if(item.reason||p?.author?.did!==did||p.author.handle!==handle||!p.uri?.startsWith(prefix))continue;
  const row=flashPost(feed,p.uri.slice(prefix.length),p.record);
  if(row)rows.push(row);
 }
 return rows;
}
// Retain recent stream changes while the public author-feed index catches up.
const flashChanges=new Map();
function recentChanges(feed){
 let changes=flashChanges.get(feed);
 if(!changes){changes=new Map();flashChanges.set(feed,changes)}
 for(const [key,v] of changes)if(v.until<Date.now())changes.delete(key);
 return changes;
}
function mergeFlash(feed,snapshot){
 const rows=new Map(snapshot.map(e=>[e.id,e]));
 for(const [key,change] of recentChanges(feed)){
  if(change.row)rows.set(key,change.row);else rows.delete(key);
 }
 return [...rows.values()].sort((a,b)=>b.time.localeCompare(a.time)).slice(0,100);
}
function applyFlashCommit(msg){
 const feed=flashByDid.get(msg?.did),c=msg?.commit;
 if(!feed||!Number.isSafeInteger(msg.time_us)||msg.kind!=='commit'||c?.collection!=='app.bsky.feed.post'||!['create','update','delete'].includes(c.operation)||typeof c.rkey!=='string')return;
 const key=feed+':'+c.rkey,entry=cache[feed],prior=entry?.records.find(e=>e.id===key);
 const row=c.operation==='delete'?null:flashPost(feed,c.rkey,c.record);
 if(!row&&!prior&&c.operation==='create')return;
 const changes=recentChanges(feed),previous=changes.get(key);
 if(previous&&previous.sequence>=msg.time_us)return;
 if(row)rememberRevision(row,prior);
 changes.set(key,{row,sequence:msg.time_us,until:Date.now()+180000});
 if(!row&&!prior)return;
 const records=mergeFlash(feed,entry?.records||[]);
 feedDigests.delete(feed);cacheWrite(feed,{records,arg:'',fetched:Date.now()});status[feed]='online';
 scheduleFeedDisplay();
}
const streamHost='wss://jetstream2.us-east.bsky.network/subscribe';
let flashSocket=null;
function startFlashStream(){
 let reconnectTimer,delay=1000,stopped=false;
 function connect(){
  if(stopped||!navigator.onLine||flashSocket)return;
  const query=new URLSearchParams({wantedCollections:'app.bsky.feed.post'});
  for(const did of flashByDid.keys())query.append('wantedDids',did);
  const socket=new WebSocket(streamHost+'?'+query);flashSocket=socket;
  socket.onopen=()=>{delay=1000};
  socket.onmessage=e=>{try{applyFlashCommit(JSON.parse(e.data))}catch(err){console.warn('News stream',err.message)}};
  socket.onclose=()=>{flashSocket=null;if(!stopped){clearTimeout(reconnectTimer);reconnectTimer=setTimeout(connect,delay);delay=Math.min(delay*2,30000)}};
 }
 window.addEventListener('online',connect);
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(reconnectTimer);flashSocket?.close()},{once:true});
 connect();
}
