'use strict';

const locationLabels={
 'zh-Hans':['来源报告的位置','区域参考点','来源未提供位置','查看位置','附近地图标注'],
 'zh-Hant':['來源報告的位置','區域參考點','來源未提供位置','查看位置','附近地圖標註'],
 en:['Reported location','Regional reference point','Location unavailable','Show location','Nearby map labels'],
 es:['Ubicación reportada','Referencia regional','Ubicación desconocida','Ver ubicación','Nombres cercanos'],
 fr:['Lieu signalé','Repère régional','Lieu inconnu','Voir le lieu','Noms à proximité'],
 de:['Gemeldeter Ort','Regionaler Bezugspunkt','Ort unbekannt','Ort anzeigen','Namen in der Nähe'],
 pt:['Local informado','Referência regional','Local desconhecido','Ver local','Nomes próximos'],
 ru:['Место по данным источника','Региональный ориентир','Место неизвестно','Показать на карте','Названия рядом'],
 ja:['情報源が示す位置','地域の代表点','位置情報なし','位置を表示','周辺の地名'],
 ar:['الموقع المبلّغ عنه','نقطة مرجعية إقليمية','الموقع غير متاح','عرض الموقع','أسماء قريبة'],
 hi:['स्रोत के अनुसार स्थान','क्षेत्रीय संदर्भ बिंदु','स्थान उपलब्ध नहीं','स्थान देखें','आसपास के नाम'],
 bn:['সূত্রে উল্লিখিত স্থান','আঞ্চলিক নির্দেশক','স্থান অজানা','স্থান দেখুন','কাছাকাছি নাম'],
 id:['Lokasi yang dilaporkan','Titik acuan wilayah','Lokasi tidak tersedia','Lihat lokasi','Nama di sekitar'],
 ur:['اطلاع کردہ مقام','علاقائی حوالہ','مقام دستیاب نہیں','مقام دکھائیں','قریبی نام'],
 pcm:['Place wey source report','Point for di region','Location no dey','Show location','Names near here'],
 mr:['स्रोतानुसार ठिकाण','प्रादेशिक संदर्भ बिंदू','स्थान उपलब्ध नाही','ठिकाण पहा','आसपासची नावे'],
 vi:['Vị trí theo nguồn tin','Điểm tham chiếu khu vực','Chưa rõ vị trí','Xem vị trí','Tên địa điểm lân cận'],
 te:['మూలం తెలిపిన స్థానం','ప్రాంత సూచిక','స్థానం అందుబాటులో లేదు','స్థానాన్ని చూపు','సమీప ప్రదేశాల పేర్లు'],
 sw:['Eneo lililoripotiwa','Kitovu cha eneo','Eneo halijulikani','Onyesha eneo','Majina ya karibu'],
 tr:['Bildirilen konum','Bölgesel referans noktası','Konum bilinmiyor','Konumu göster','Yakındaki yer adları']
};
function locText(i){return (locationLabels[lang==='arz'?'ar':lang]||locationLabels.en)[i];}
function regionalPoint(e){return !!e.anchor||e.feed==='cloud';}
function sourcePlace(e){
  if(e.area&&areas[e.area])return areaName(e.area)+' · '+countryName(featuresByCode.get('CHN'));
  const country=featuresByCode.get(e.iso);
  if(e.anchor==='country'&&country)return countryName(country);
  if(e.anchor==='region'&&country){
    const label=lang==='zh-Hans'?e.placeZh:lang==='zh-Hant'?e.placeHant:null;
    return countryName(country)+' · '+(label||e.place);
  }
  if(e.anchor==='currency')return e.title.split(/\s{2,}/)[0];
  if(e.place)return plain(lang==='zh-Hans'&&e.placeZh?e.placeZh:lang==='zh-Hant'&&e.placeHant?e.placeHant:e.place);
  if(e.feed==='quake'||e.feed==='cloud')return (e.summary||'').split(' · ')[0];
  if(e.feed==='metar')return e.title;
  return '';
}
function locationBlock(e){
  const div=make('div','','event-location');
  div.append(make('small',e.anchor==='city'?rw(1):e.anchor==='water'?rw(2):locText(!e.location?2:regionalPoint(e)?1:0)));
  const place=sourcePlace(e);
  if(place)div.append(make('strong',place));
  if(e.location&&!regionalPoint(e))div.append(make('span',e.location.map(x=>String(x)).join(', ')+'  ·  WGS 84','geo-coords'));
  return div;
}
let locationPopup, activeLocation;
function nearbyNames(){
  if(!activeLocation||regionalPoint(activeLocation)||!locationPopup?.isOpen()||!streets||map.getZoom()<13)return;
  const target=locationPopup.getElement()?.querySelector('.nearby-names');
  if(!target)return;
  const [lat,lon]=activeLocation.location;
  const hits=streets.queryTileFeaturesDebug(lon,lat,22).get('')||[];
  const names=new Set();
  for(const {feature,layerName} of hits){
    if(!['transportation_name','place'].includes(layerName))continue;
    const p=feature.props, name=p['name:'+lang]||p['name:'+lang.split('-')[0]]||p.name;
    if(name)names.add(name);
  }
  target.textContent=names.size?locText(4)+' · '+[...names].slice(0,3).join(' / '):'';
  locationPopup.update();
}
function openLocation(e,zoom=true){
  if(!e.location||$('mapPane').hidden)return;
  if(cityScene?.active){cityScene.locate(e);return}
  if(desktopGlobe?.visible){desktopGlobe.locate(e);return}
  map.closePopup();activeLocation=e;
  if(zoom){
    const z=regionalPoint(e)?(e.anchor==='city'?10:e.anchor==='water'?7:e.area?7:5):['gdacs','eonet','quake'].includes(e.feed)?12:15;
    map.setView(e.location,regionalPoint(e)?z:Math.max(map.getZoom(),z),{animate:false});
  }
  const body=make('article','','location-card');
  body.append(translated(make('strong'),e.title,e),locationBlock(e),make('small','','nearby-names'),
    make('small',e.source+' · '+eventTime(e)),button(t('details'),()=>showStory(e)));
  locationPopup=L.popup({maxWidth:290,maxHeight:230,autoPanPadding:[14,18],offset:[0,-10]})
    .setLatLng(e.location).setContent(body).openOn(map);
  locationPopup.reportLang=lang;observeTranslations();nearbyNames();
}
function openMarkerGroup(group,e){
  if(group.length===1){selectEvent(e,true);return;}
  const body=make('article','','location-card marker-choices');
  body.append(make('strong',t('events')+' · '+group.length));
  for(const item of group)body.append(translated(button('',()=>selectEvent(item,true)),item.title,item));
  activeLocation=null;
  L.popup({maxWidth:280,maxHeight:215}).setLatLng(e.location).setContent(body).openOn(map);observeTranslations();
}
function locateFromBrief(e){
  if(view==='main'||view==='map')openLocation(e);
  else channel.postMessage({type:'locate',event:e});
}
