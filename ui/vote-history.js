'use strict';

let voteVisits=[],historyMode='recent',historyYear='',historyNation='',historyLimit=40,visitTimer=0;
const maxVoteVisits=100;

function rememberVote(){
 clearTimeout(visitTimer);visitTimer=0;
 const record=voteRecords.get(activeVote);
 if(!record)return;
 const entry={id:record.id,country:votingCountry,at:Date.now(),record};
 voteVisits=[entry,...voteVisits.filter(v=>v.id!==record.id)].slice(0,maxVoteVisits);
 // A snapshot keeps a recent online roll call accessible even after the live cache rotates.
 return rpc('write','vote-history',JSON.stringify(voteVisits)).catch(e=>notice(e.message));
}
function chooseVoter(code){
 showVoter(code);
 rememberVote();
}
function openPastVote(record,country){
 clearTimeout(visitTimer);followNewest=false;
 if(!voteRecords.has(record.id))voteRecords.set(record.id,record);
 activeVote=record.id;$('voteQuery').value='';
 votingCountry=country||'';
 $('dialog').close();populateResolutions();rememberVote();
}
function historyItem(record,country,stamp){
 const row=button('',()=>openPastVote(record,country),'vote-history-row');
 row.dataset.id=record.id;
 const when=make('small',stamp+'   ·   '+record.symbol),heading=make('span',resolutionName(record));
 if(lang!=='en'&&resolutionName(record)===record.title)translated(heading,record.title,{feed:'un'});
 row.append(when,heading);
 if(country){
  const pick=record.groups.findIndex(group=>group.split(' ').includes(country));
  const kind=voteKinds[pick]||'-',mark=make('small',seatName(country,record)+' · '+voteLabel(kind));
  mark.style.borderInlineStart='3px solid '+voteColors[voteKinds.indexOf(kind)];mark.style.paddingInlineStart='6px';row.append(mark);
 }
 return row;
}
function drawVoteHistory(){
 const body=showDialog('voteHistory','voteHistory'),tabs=make('div','','vote-history-tabs');
 for(const key of ['recent','archive']){
  const tab=button(t(key==='recent'?'voteVisits':'voteArchive'),()=>{historyMode=key;historyLimit=40;drawVoteHistory()});
  tab.dataset.mode=key;tab.setAttribute('aria-pressed',String(historyMode===key));tabs.append(tab);
 }
 body.append(tabs);
 const recent=historyMode==='recent';
 let rows=[];
 if(recent){
  rows=voteVisits.map(v=>({record:voteRecords.get(v.id)||v.record,country:v.country,stamp:localStamp(v.at,'full')}));
 }else{
  const filters=make('div','','vote-history-filters'),year=make('select'),nation=make('select');
  year.id='historyYear';year.ariaLabel=t('date');nation.id='historyNation';nation.ariaLabel=t('voteCountry');
  const records=[...voteRecords.values()].sort(voteOrder);
  year.add(new Option(t('all'),''));
  for(const y of new Set(records.map(r=>r.date.slice(0,4))))year.add(new Option(y,y));
  year.value=historyYear;
  nation.add(new Option(t('all'),''));
  const members=new Map();
  for(const record of records){
   if(historyYear&&!record.date.startsWith(historyYear))continue;
   for(const code of record.groups.join(' ').split(/\s+/))if(code&&!members.has(code))members.set(code,seatName(code,record));
   if(!historyYear&&members.size===Object.keys(memberAtlas.defaults).length)break;
  }
  for(const [code,name] of [...members].sort((a,b)=>a[1].localeCompare(b[1],lang)))nation.add(new Option(name,code));
  if(!members.has(historyNation))historyNation='';
  nation.value=historyNation;
  year.onchange=()=>{historyYear=year.value;historyLimit=40;drawVoteHistory()};
  nation.onchange=()=>{historyNation=nation.value;historyLimit=40;drawVoteHistory()};
  const yearLabel=make('label',t('date')),countryLabel=make('label',t('voteCountry'));
  yearLabel.append(year);countryLabel.append(nation);filters.append(yearLabel,countryLabel);body.append(filters);
  rows=records.filter(r=>(!historyYear||r.date.startsWith(historyYear))&&(!historyNation||r.groups.some(group=>group.split(' ').includes(historyNation))))
   .map(record=>({record,country:historyNation,stamp:record.date}));
 }
 const list=make('div','','vote-history-list');body.append(list);
 if(!rows.length)list.append(make('p',t('empty')));
 let shown=0;
 const more=button('',()=>{historyLimit+=40;appendRows()});
 function appendRows(){
  for(const item of rows.slice(shown,historyLimit))list.append(historyItem(item.record,item.country,item.stamp));
  shown=Math.min(historyLimit,rows.length);more.hidden=shown>=rows.length;
  more.textContent=t('voteMore')+' · '+shown+' / '+rows.length;observeTranslations();
 }
 body.append(more);appendRows();
}
function openVoteHistory(){
 if(visitTimer){clearTimeout(visitTimer);visitTimer=0;rememberVote()}
 historyMode='recent';historyNation=votingCountry;historyYear='';historyLimit=40;drawVoteHistory();
}

