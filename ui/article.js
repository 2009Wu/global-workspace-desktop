'use strict';
const publishers=new Set(['www.bbc.co.uk','www.bbc.com','news.un.org','www.aljazeera.com','www.france24.com','www.crisisgroup.org','reliefweb.int','therecord.media']);
async function enrichArticle(e){
 const url=safeUrl(e?.links?.[0]?.url);if(!url||!publishers.has(new URL(url).hostname))return;
 const key='desk:article:'+url;
 let facts=readLocal(key,null);
 if(!facts||Date.now()-facts.readAt>3600000){
   try{
     const data=await rpc('article',url),nodes=[];
     function add(node){
       if(Array.isArray(node)){node.forEach(add);return;}
       if(node&&typeof node==='object'){nodes.push(node);if(node['@graph'])add(node['@graph']);}
     }
     for(const raw of data.ld||[]){try{add(JSON.parse(raw));}catch{}}
     const a=nodes.find(x=>/Article|Report|Posting/i.test(String(x['@type'])))||{};
     const byline=[a.author||[]].flat().map(x=>typeof x==='string'?x:x?.name).filter(Boolean).join(' · ');
     const candidates=[...(data.excerpts||[]),typeof a.description==='string'?a.description:''];
     const excerpts=[...new Set(candidates.map(plain))].filter(s=>s.length>35&&!e.summary.includes(s)&&!s.includes(e.summary||'__')&&!e.excerpt?.includes(s)).slice(0,2);
     facts={byline:byline.slice(0,180),date:dateISO(a.dateModified),excerpts,readAt:Date.now()};
     const keys=Object.keys(localStorage).filter(k=>k.startsWith('desk:article:'));
     if(keys.length>=32)localStorage.removeItem(keys[0]);
     try{localStorage.setItem(key,JSON.stringify(facts));}catch{}
   }catch{return;}
 }
 if(standalone?.id!==e.id)return;
 e.article=facts;render();
}
