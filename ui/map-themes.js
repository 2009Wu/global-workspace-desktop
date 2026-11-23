'use strict';
const terrainDEM='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const reliefURL='https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}';
const topoURL='https://a.tile.opentopomap.org/{z}/{x}/{y}.png';
const topoCredits='© OpenStreetMap contributors, SRTM | © <a href="https://opentopomap.org/about">OpenTopoMap</a> (CC BY-SA) · Natural Earth';

const mapVocabulary={
 'zh-Hans':['地形','军事地形图','建筑','加入北约年份'],'zh-Hant':['地形','軍事地形圖','建築','加入北約年份'],
 en:['Terrain','Military topography','Buildings','Year of NATO accession'],de:['Gelände','Militär','Gebäude','NATO-Beitrittsjahr'],
 ja:['地形','軍事','建物','NATO加盟年'],fr:['Relief','Militaire','Bâtiments','Année d’adhésion à l’OTAN'],
 es:['Relieve','Militar','Edificios','Año de adhesión a la OTAN'],ru:['Рельеф','Военная карта','Здания','Год вступления в НАТО'],
 ar:['التضاريس','عسكري','المباني','سنة الانضمام إلى الناتو'],hi:['भूभाग','सैन्य','इमारतें','नाटो में शामिल होने का वर्ष'],
 bn:['ভূপ্রকৃতি','সামরিক','ভবন','ন্যাটোতে যোগদানের বছর'],pt:['Relevo','Militar','Edifícios','Ano de adesão à NATO'],
 id:['Medan','Militer','Bangunan','Tahun bergabung dengan NATO'],ur:['خطہ','فوجی','عمارتیں','نیٹو میں شمولیت کا سال'],
 mr:['भूप्रदेश','लष्करी','इमारती','नाटो प्रवेश वर्ष'],vi:['Địa hình','Quân sự','Tòa nhà','Năm gia nhập NATO'],
 te:['భూభాగం','సైనిక','భవనాలు','నాటోలో చేరిన సంవత్సరం'],sw:['Mandhari','Kijeshi','Majengo','Mwaka wa kujiunga na NATO'],
 tr:['Arazi','Askerî','Binalar',"NATO’ya katılım yılı"]
};
for(const id of Object.keys(dictionaries)){
 const [terrain,military,buildings,accession]=mapVocabulary[id]||mapVocabulary[id==='arz'?'ar':'en'];
 Object.assign(dictionaries[id],{terrain,military,buildings,accession});
}

