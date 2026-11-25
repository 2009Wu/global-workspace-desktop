'use strict';
let lightDevice=true,fastModel='',canReview=false,quietAt=0,lastNativeSignal=-Infinity;
function signalMapUse(){
  const now=performance.now();quietAt=now+1100;
  if(now-lastNativeSignal>=200){
    lastNativeSignal=now;
    rpc('mapActive').catch(()=>{});
  }
}
function quietDelay(){return Math.max(0,quietAt-performance.now());}
async function awaitQuiet(){
  while(quietDelay()>0)await new Promise(resolve=>setTimeout(resolve,Math.ceil(quietDelay())));
}
function trackMapUse(){
  const surface=document.getElementById('mapWrap');
  for(const type of ['wheel','pointerdown','pointermove','keydown','touchmove']){
    surface.addEventListener(type,event=>{
      if(type!=='pointermove'||event.buttons)signalMapUse();
    },{passive:true,capture:true});
  }
  map.on('drag zoom',signalMapUse);
}
const weekWords=new Map();
function weekdayWords(locale){
  if(!weekWords.has(locale)){
    const format=new Intl.DateTimeFormat(locale,{weekday:'long',timeZone:'UTC'});
    weekWords.set(locale,Array.from({length:7},(_,i)=>format.format(new Date(Date.UTC(2024,0,i+7))).toLowerCase()));
  }
  return weekWords.get(locale);
}
function translationIssue(original,value,target){
  const guidance=/background for terminology|do not translate it|translate only the passage|(?:仅|僅)(?:作[为為])?.{0,6}(?:术语|術語|背景).{0,8}(?:说明|說明|参考|參考)|[（(](?:无需|無需|不必)(?:翻译|翻譯)[）)]/i;
  if(guidance.test(value)&&!guidance.test(original))return true;
  const source=original.toLowerCase(),out=value.toLowerCase();
  const normalizeNumbers=s=>s.normalize('NFKC').replace(/[٠-٩۰-۹०-९০-৯]/g,c=>{
    const n=c.charCodeAt(0);return String(n-(n>=2534?2534:n>=2406?2406:n>=1776?1776:1632));
  });
  const numbers=s=>normalizeNumbers(s).match(/\d+/g)||[];
  const translatedNumbers=numbers(value);
  if(numbers(original).some(n=>!translatedNumbers.includes(n)))return true;
  if(target.startsWith('zh')&&/\bimpeach(?:ment|ing|ed)?\b/i.test(original)&&!/弹劾|彈劾/.test(value))return true;
  if(target.startsWith('zh')&&/\b(?:could|might) resume\b/i.test(original)&&!/可能|或|有望|也许|也許/.test(value))return true;
  if(target.startsWith('zh')&&/\bminister (?:says|said)\b/i.test(original)&&!/部长|部長|大臣|阁员|閣員/.test(value))return true;
  const expected=weekdayWords('en').map((word,i)=>source.includes(word)?i:-1).filter(i=>i>=0);
  if(expected.length===1){
    const actual=weekdayWords(target);
    if(actual.some((word,i)=>i!==expected[0]&&out.includes(word)))return true;
    if(target.startsWith('zh')){
      const named=[...out.matchAll(/(?:星期|礼拜|禮拜|周|週)([日天一二三四五六])/g)];
      if(named.some(m=>'日一二三四五六'.indexOf(m[1]==='天'?'日':m[1])!==expected[0]))return true;
    }
  }
  return false;
}
function addReadingControls(info,actions,story){
  const chinese=lang.startsWith('zh'),passages=[story.title,story.summary].filter(Boolean);
  const original=document.createElement('details'),label=document.createElement('summary');
  label.textContent=chinese?'查看原文':'Original';original.append(label);
  for(const passage of passages)original.append(make('p',passage));
  info.append(original);
  if(!canReview||translationEngine()==='off')return;
  const result=document.createElement('details'),caption=document.createElement('summary');
  caption.textContent=chinese?'查看精译':'Read refined translation';result.append(caption);result.hidden=true;
  const refine=button(chinese?'精译标题和摘要':'Refine headline and summary',async()=>{
    const target=lang;refine.disabled=true;refine.textContent=chinese?'正在精译…':'Refining…';
    try{
      const parts=[];
      for(const passage of passages)parts.push(await translateReport(passage,target,'qwen-review',passage===story.title?(story.summary||'').slice(0,280):''));
      if(!info.isConnected||lang!==target)return;
      for(const part of parts)result.append(make('p',part));
      result.hidden=false;refine.hidden=true;
    }catch(error){refine.disabled=false;refine.textContent=chinese?'重试精译':'Retry refinement';if(String(error).includes('Insufficient free memory'))notice(chinese?'可用内存不足，稍后可重试精译':'Not enough free memory to refine this report');}
  });
  actions.append(refine);info.append(result);
}
