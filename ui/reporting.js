'use strict';

const reportingWords={
 'zh-Hans':['冲突动态','报道所指城市','报道所指海域','报道摘要','查看原文','相关报道','首次收录','机翻','原文'],
 'zh-Hant':['衝突動態','報道所指城市','報道所指海域','報道摘要','查看原文','相關報道','首次收錄','機翻','原文'],
 en:['Conflict watch','City named in report','Maritime region named in report','Report summary','Original text','Related coverage','First collected','MT','Original'],
 es:['Conflictos','Ciudad citada','Zona marítima citada','Resumen','Texto original','Noticias relacionadas','Primera recepción','TA','Original'],
 fr:['Conflits','Ville citée','Zone maritime citée','Résumé','Texte original','Articles associés','Première réception','TA','Original'],
 de:['Konflikte','Genannte Stadt','Genanntes Seegebiet','Berichtsüberblick','Originaltext','Weitere Berichte','Erstmals erfasst','MÜ','Original'],
 ar:['النزاعات','المدينة المذكورة','المنطقة البحرية المذكورة','ملخص التقرير','النص الأصلي','تقارير ذات صلة','أول رصد','ترجمة آلية','الأصل'],
 ru:['Конфликты','Город в сообщении','Акватория в сообщении','Краткое содержание','Оригинал','По теме','Получено впервые','МП','Оригинал'],
 ja:['紛争情報','報道にある都市','報道にある海域','報道の要約','原文','関連報道','初回取得','機械翻訳','原文'],
 pt:['Conflitos','Cidade citada','Região marítima citada','Resumo','Texto original','Cobertura relacionada','Primeira coleta','TA','Original'],
 hi:['संघर्ष','रिपोर्ट में शहर','रिपोर्ट में समुद्री क्षेत्र','समाचार सार','मूल पाठ','संबंधित समाचार','पहला संग्रह','मशीनी अनुवाद','मूल'],
 bn:['সংঘাত','প্রতিবেদনে শহর','প্রতিবেদনে সমুদ্র অঞ্চল','সারাংশ','মূল লেখা','সম্পর্কিত খবর','প্রথম সংগ্রহ','যান্ত্রিক অনুবাদ','মূল'],
 id:['Konflik','Kota dalam laporan','Wilayah laut dalam laporan','Ringkasan','Teks asli','Laporan terkait','Pertama diterima','Terjemahan mesin','Asli'],
 ur:['تنازعات','رپورٹ میں شہر','رپورٹ میں سمندری خطہ','خلاصہ','اصل متن','متعلقہ خبریں','پہلی وصولی','مشینی ترجمہ','اصل'],
 pcm:['Conflict news','City wey report mention','Sea area wey report mention','Wetin report talk','Original text','Other reports','First time we see am','Machine translation','Original'],
 mr:['संघर्ष','बातमीतील शहर','बातमीतील सागरी क्षेत्र','सारांश','मूळ मजकूर','संबंधित बातम्या','प्रथम नोंद','यंत्रानुवाद','मूळ'],
 vi:['Xung đột','Thành phố được nêu','Vùng biển được nêu','Tóm tắt','Nguyên văn','Tin liên quan','Ghi nhận lần đầu','Dịch máy','Bản gốc'],
 te:['ఘర్షణలు','వార్తలోని నగరం','వార్తలోని సముద్ర ప్రాంతం','సారాంశం','మూల పాఠం','సంబంధిత వార్తలు','మొదటి నమోదు','యంత్రానువాదం','మూలం'],
 sw:['Migogoro','Jiji lililotajwa','Eneo la bahari lililotajwa','Muhtasari','Maandishi asili','Habari husika','Ilipokelewa kwanza','Tafsiri ya mashine','Asili'],
 tr:['Çatışmalar','Haberdeki şehir','Haberdeki deniz alanı','Haber özeti','Özgün metin','İlgili haberler','İlk kayıt','Makine çevirisi','Özgün']
};
function rw(i){return (reportingWords[lang==='arz'?'ar':lang]||reportingWords.en)[i];}
const newsLayers=new Set(['politics','conflict']);
const conflictPattern=/\b(war|wars|wartime|conflict|ceasefire|blockade|hostilities|airstrikes?|air strikes?|invasion|fighting|attacked|armed groups?|civilian casualties|warships?|hostages?|shelling|displaced|displacement|peace talks|militants?|drone strikes?|maritime security)\b|封锁|封鎖|战争|戰爭|冲突|衝突|停火|前线|前線/i;
function isConflict(e){return e.layer==='conflict'||(e.layer==='politics'&&conflictPattern.test(e.title+' '+e.summary));}
const placeIndex=new Map();
const isoByTwo=new Map(countryFeatures.map(f=>[f.properties.iso2,f.properties.iso]));
const norm=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
const specialPlaces=[
  ['city','UKR',[48.28,37.18],'Pokrovsk','红军城','紅軍城',['Pokrovsk','Krasnoarmiisk','Krasnoarmeysk','Покровськ','Покровск','红军城','紅軍城','波克罗夫斯克','波克羅夫斯克']],
  ['water','',[26.56,56.25],'Strait of Hormuz','霍尔木兹海峡','荷姆茲海峽',['Strait of Hormuz','Hormuz Strait','赫尔姆兹海峡','霍尔木兹海峡','霍爾木茲海峽','荷姆茲海峽']],
  ['water','',[60.0,26.5],'Gulf of Finland','芬兰湾','芬蘭灣',['Gulf of Finland','Finnish Gulf','芬兰湾','芬蘭灣']],
  ['water','',[14.0,48.0],'Gulf of Aden','亚丁湾','亞丁灣',['Gulf of Aden','亚丁湾','亞丁灣']],
  ['water','',[19.0,39.0],'Red Sea','红海','紅海',['Red Sea','红海','紅海']],
  ['water','',[43.0,34.0],'Black Sea','黑海','黑海',['Black Sea','黑海']]
];
function explicitPlace(text){
  const located=[];
  for(const [anchor,iso,location,en,zh,hant,names] of specialPlaces){
    if(names.some(n=>/\p{Script=Han}/u.test(n)?text.includes(n):new RegExp('(?:^|[^\\p{L}])'+escapeRe(n)+'(?:$|[^\\p{L}])','iu').test(text)))
      located.push({anchor,iso,location,place:en,placeZh:zh,placeHant:hant});
  }
  if(located.length)return located.length===1?located[0]:null;
  // Require a location phrase. A government or nationality acting as subject is not a site.
  const pattern=/\b(?:in|near|outside|around|at|from the city of|captur(?:e|ed|es)|seiz(?:e|ed|es)|occup(?:y|ied|ies))\s+(?:the (?:city|port|town) of )?([\p{Lu}][\p{L}.'’-]*(?:\s+[\p{Lu}][\p{L}.'’-]*){0,3})/gu;
  for(const m of text.matchAll(pattern)){
    const words=m[1].split(/\s+/);
    while(words.length){
      const hits=placeIndex.get(norm(words.join(' ')));
      if(hits){if(hits.length===1){const [name,,cc,lat,lon]=hits[0];located.push({anchor:'city',iso:isoByTwo.get(cc)||'',location:[lat,lon],place:name});}break;}
      words.pop();
    }
  }
  return located.length&&located.every(x=>x.place===located[0].place)?located[0]:null;
}
function loadNewsPlaces(){
  return readVector('news-cities').then(rows=>{
    for(const row of rows)for(const name of new Set(row.slice(0,2).filter(Boolean).map(norm))){
      const bucket=placeIndex.get(name)||[];bucket.push(row);placeIndex.set(name,bucket);
    }
  }).catch(console.warn);
}
function storyBundle(e){
  const seen=new Set([e.links?.[0]?.url]);
  const words=new Set(norm(e.title).match(/[a-z]{4,}/g)||[]);
  const ignore=new Set(['that','with','from','after','over','says','more','have','into','this','news','about','amid','first']);
  const related=Object.values(cache).flatMap(c=>c.records||[]).filter(x=>{
    const url=x.links?.[0]?.url;
    if(!url||seen.has(url)||x.id===e.id||x.source===e.source||!newsLayers.has(e.layer)||!newsLayers.has(x.layer)||Math.abs(Date.parse(x.time)-Date.parse(e.time))>3*86400000)return false;
    const overlap=new Set((norm(x.title).match(/[a-z]{4,}/g)||[]).filter(w=>words.has(w)&&!ignore.has(w))).size;
    if(overlap<3&&!(overlap>=1&&e.place&&e.place===x.place))return false;
    seen.add(url);return true;
  }).slice(0,4).map(x=>({title:x.title,time:x.time,source:x.source,url:x.links[0].url}));
  return {...e,related};
}
const transitCols={
 'zh-Hans':'日期|商船航次|货船|油轮','zh-Hant':'日期|商船航次|貨船|油輪',en:'Date|Transits|Cargo|Tankers',es:'Fecha|Tránsitos|Carga|Petroleros',fr:'Date|Passages|Cargo|Pétroliers',de:'Datum|Durchfahrten|Frachter|Tanker',ar:'التاريخ|العبور|سفن الشحن|الناقلات',ru:'Дата|Проходы|Грузовые|Танкеры',ja:'日付|通航回数|貨物船|タンカー',pt:'Data|Trânsitos|Carga|Petroleiros',hi:'तारीख|पारगमन|मालवाहक|टैंकर',bn:'তারিখ|পারাপার|পণ্যবাহী|ট্যাঙ্কার',id:'Tanggal|Lintasan|Kargo|Tanker',ur:'تاریخ|گزرگاہیں|مال بردار|ٹینکر',pcm:'Date|Ship trips|Cargo|Tankers',mr:'दिनांक|प्रवास|मालवाहू|टँकर',vi:'Ngày|Lượt qua|Tàu hàng|Tàu dầu',te:'తేదీ|ప్రయాణాలు|సరుకు|ట్యాంకర్లు',sw:'Tarehe|Safari|Mizigo|Matanki',tr:'Tarih|Geçişler|Yük|Tankerler'
};
function transitHistory(days,full){
 const table=make('table','','transit-history'),head=table.createTHead().insertRow();
 for(const s of (transitCols[lang==='arz'?'ar':lang]||transitCols.en).split('|'))head.append(make('th',s));
 const body=table.createTBody(),fmt=new Intl.NumberFormat(lang);
 for(const day of days.slice(0,full?14:3)){const row=body.insertRow();
   for(const val of [day.date,day.n_total,day.n_cargo,day.n_tanker])row.append(make('td',typeof val==='number'?fmt.format(val):val??'—'));
 }
 return table;
}
function showStory(e){return rpc('window','detail',JSON.stringify(storyBundle(e)));}
