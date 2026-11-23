'use strict';
const localFormats=new Map();
let timeZoneId='',nextZoneCheck=0;
function localStamp(value,kind='list'){
 if(value==null||value==='')return '—';
 if(typeof value==='string'&&/^\d{4}(-\d\d-\d\d)?$/.test(value))return value;
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '—';
 if(!timeZoneId)timeZoneId=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const key=[lang,timeZoneId,kind].join('/');
 if(!localFormats.has(key)){
  const options={timeZone:timeZoneId,hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'};
  if(kind!=='clock')Object.assign(options,{month:'2-digit',day:'2-digit'});
  if(kind!=='list')options.second='2-digit';
  if(kind==='full')options.year='numeric';
  localFormats.set(key,new Intl.DateTimeFormat(lang,options));
 }
 return localFormats.get(key).format(date);
}
function fmt(value){return localStamp(value)}
function displayEventDate(e,value){
 if(value&&['fx','kev','transits'].includes(e.feed)&&/^\d{4}-\d\d-\d\dT00:00:00\.000Z$/.test(value))return value.slice(0,10);
 return value;
}
function updateClock(){
 const now=Date.now();
 if(now>=nextZoneCheck){
  nextZoneCheck=now+1000;
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const changed=timeZoneId&&timeZoneId!==zone;timeZoneId=zone;
  if(changed){localFormats.clear();if(startDone)render();}
 }
 $('clock').textContent=localStamp(now,'clock');$('clock').title=timeZoneId;
}
