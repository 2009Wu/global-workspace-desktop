'use strict';

const areas = {
  'CN-DIA': {names:['钓鱼岛及其附属岛屿','釣魚島及其附屬島嶼','Diaoyu Islands'], lat:25.74333, lon:123.47333, match:/\b(diaoyu(?:dao)?|diaoyutai|senkaku)\b|钓鱼岛|釣魚島|釣魚臺/i},
  'CN-TW': {names:['台湾','臺灣','Taiwan'], lat:23.7, lon:120.96, match:/\b(taiwan(?:ese)?|taipei)\b|台湾|臺灣|台灣/i},
  'CN-AKS': {names:['阿克赛钦','阿克賽欽','Aksai Chin'], lat:35.15, lon:79.8, match:/\baksai chin\b|阿克赛钦|阿克賽欽/i},
  'CN-ZAN': {names:['藏南','藏南','Zangnan (South Tibet)'], lat:28.2, lon:94.85, match:/\b(arunachal(?: pradesh)?|zangnan|south(?:ern)? tibet|itanagar|tawang)\b|藏南|达旺|達旺/i}
};
const featuresByCode = new Map(world.features.map(f=>[f.properties.iso,f]));
const countryFeatures = world.features.filter(f=>!f.properties.parent);
const exact = new Map(), requests = new Map(), indexByGeometry = new WeakMap();
const shownGeometry = new Map();
let relief, physicalLayer, areaOverlay, selectedShape='', physicalData, cityData=[], lastAttribution='';
let adminRequested=false;
const shownWater = new Map();
const terrainInsets = new Map();

function areaName(code) {
  return areas[code].names[lang==='zh-Hans'?0:lang==='zh-Hant'?1:2];
}
function regionCode(code) {
  if(code==='TWN')return 'CN-TW';
  return regions[code]||featuresByCode.has(code)?code:'001';
}
function upgradeRecord(e) {
  if(e?.iso==='TWN')return {...e,iso:'CHN',area:'CN-TW'};
  return e;
}
function areaInHeadline(e) {
  const found=Object.entries(areas).find(([,area])=>area.match.test(e.title));
  if(!found)return false;
  const [code,area]=found;
  Object.assign(e,{location:[area.lat,area.lon],anchor:'country',iso:'CHN',area:code});
  return true;
}
function leafletBounds(f) {
  const [w,s,e,n]=f.bbox;
  return L.latLngBounds([s,w],[n,e]);
}
async function readVector(file) {
  const response=await fetch('atlas/'+file+'.gz');
  if(!response.ok)throw Error('Map data: '+file);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes[0]!==31||bytes[1]!==139)return JSON.parse(new TextDecoder().decode(bytes));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
function ringsOf(geometry) {
  let index=indexByGeometry.get(geometry);
  if(index)return index;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  index=polygons.map(rings=>{
    let w=Infinity,s=Infinity,e=-Infinity,n=-Infinity;
    for(const [lon,lat] of rings[0]){w=Math.min(w,lon);e=Math.max(e,lon);s=Math.min(s,lat);n=Math.max(n,lat);}
    return {rings,w,s,e,n};
  });
  indexByGeometry.set(geometry,index);
  return index;
}
function insideArea(code,point) {
  const f=featuresByCode.get(code);
  if(!f||!point)return false;
  const [lat,lon]=point,[w,s,e,n]=f.bbox;
  if(lon<w||lon>e||lat<s||lat>n)return false;
  return ringsOf(exact.get(code)||f.geometry).some(p=>lon>=p.w&&lon<=p.e&&lat>=p.s&&lat<=p.n&&
    inPolygon(p.rings[0],point)&&!p.rings.slice(1).some(h=>inPolygon(h,point)));
}
function ensureGeometry(code) {
  if(!featuresByCode.has(code)||exact.has(code))return;
  if(!requests.has(code)){
    const task=readVector(code).then(g=>{
      exact.set(code,g);
      if(code===region)render();
      scheduleCartography();
    }).catch(err=>{console.warn(err);}).finally(()=>requests.delete(code));
    requests.set(code,task);
  }
}
function countryStyle(code) {
  const selected=region===code||(areas[region]&&code==='CHN');
  const sat=layer==='sat';
  return {color:selected?'#9ddfc7':sat?'#c3ccc4':'#759497',weight:selected?1.6:map.getZoom()>=5?1.15:.75,
    opacity:selected?.95:sat?.7:.78,fillColor:selected?'#58bfa2':'#425b59',fillOpacity:sat?0:selected?.17:.085,
    smoothFactor:.38,bubblingMouseEvents:false};
}
function showShape(code,geometry,path) {
  if(shownGeometry.get(code)===geometry)return;
  const depth=geometry.type==='MultiPolygon'?2:1;
  path.setLatLngs(L.GeoJSON.coordsToLatLngs(geometry.coordinates,depth));
  shownGeometry.set(code,geometry);
}
function scheduleCartography(){
  clearTimeout(scheduleCartography.timer);
  scheduleCartography.timer=setTimeout(refreshCartography,60);
}
function refreshCartography(){
  if(!map||!relief||$('mapPane').hidden)return;
  const viewport=map.getBounds().pad(.1),z=map.getZoom();
  configureStreets(z);
  const attribution=lang==='zh-Hans'?'Natural Earth · 中国边界视角':lang==='zh-Hant'?'Natural Earth · 中國邊界視角':'Natural Earth · China boundary view';
  if(lastAttribution!==attribution){
    if(lastAttribution)map.attributionControl.removeAttribution(lastAttribution);
    map.attributionControl.addAttribution(attribution);lastAttribution=attribution;
  }
  for(const f of countryFeatures){
    const code=f.properties.iso, p=countryLayers.get(code);
    if(!p)continue;
    if(z>=3.75&&viewport.intersects(leafletBounds(f)))ensureGeometry(code);
    const geom=z>=3.75&&exact.has(code)?exact.get(code):f.geometry;
    showShape(code,geom,p);p.setStyle(countryStyle(code));
    if(z>=9&&p.getTooltip())p.unbindTooltip();
    else if(z<9&&!p.getTooltip())p.bindTooltip(()=>make('span',countryName(f)),{sticky:true});
  }
  if(areas[region])ensureGeometry(region);
  const child=areas[region]?region:'';
  const token=child+(exact.has(child)?'/exact':'');
  if(token!==selectedShape){
    if(areaOverlay){areaOverlay.remove();areaOverlay=null;}
    if(child)areaOverlay=L.geoJSON(exact.get(child)||featuresByCode.get(child).geometry,{
      interactive:false,style:{color:'#9ce5ce',weight:1.1,dashArray:'3 4',fillOpacity:.11,fillColor:'#80d0b4'}
    }).addTo(map);
    selectedShape=token;
  }
  if(layer==='sat'){if(map.hasLayer(relief))relief.remove();}else if(!map.hasLayer(relief))relief.addTo(map);
  for(const [code,bounds] of Object.entries(terrainFootprints)){
    const visible=layer!=='sat'&&z<11&&z>=5&&viewport.intersects(L.latLngBounds(bounds));
    if(visible&&!terrainInsets.has(code)){
      const image=L.imageOverlay('atlas/terrain-'+code+'.webp',bounds,{
        pane:'tilePane',zIndex:2,interactive:false,attribution:'Mapzen terrain · USGS / NOAA'
      }).addTo(map);
      terrainInsets.set(code,image);
    }else if(!visible&&terrainInsets.has(code)){
      terrainInsets.get(code).remove();terrainInsets.delete(code);
    }
  }
  paintWater(viewport,z);
}
function paintWater(viewport,z){
  if(!physicalData)return;
  if(z>=4.5&&!adminRequested){
    adminRequested=true;
    readVector('admin1').then(features=>{physicalData.push(...features);scheduleCartography();})
      .catch(err=>{adminRequested=false;console.warn(err);});
  }
  const west=viewport.getWest(),east=viewport.getEast(),north=viewport.getNorth(),south=viewport.getSouth();
  const desired=new Set();
  if(layer!=='sat'&&z<10){
    for(const f of physicalData){
      if(z+.5<f.properties.z)continue;
      const [w,s,e,n]=f.bbox;
      if(w>east||e<west||s>north||n<south)continue;
      desired.add(f);
      if(shownWater.has(f))continue;
      const lake=f.geometry.type.includes('Polygon');
      const path=L.geoJSON(f,{pane:'hydrography',interactive:false,smoothFactor:.55,
        style:f.properties.admin?{color:'#adbaab',weight:.8,opacity:.55,dashArray:'3 3'}:
              lake?{color:'#52808d',weight:.5,fillColor:'#123849',fillOpacity:.9}
                  :{color:'#548fa4',weight:z<5?.7:1.05,opacity:.72}});
      path.addTo(physicalLayer);shownWater.set(f,path);
    }
  }
  for(const [f,path] of shownWater)if(!desired.has(f)){physicalLayer.removeLayer(path);shownWater.delete(f);}
}
function setupCartography(){
  map.attributionControl.addAttribution('<a href="https://www.geonames.org/">GeoNames</a> · <a href="https://www.openstreetmap.org/copyright">© OSM</a>');
  map.createPane('streetDetail');
  map.getPane('streetDetail').style.cssText='z-index:415;pointer-events:none';
  map.createPane('hydrography');
  map.getPane('hydrography').style.cssText='z-index:410;pointer-events:none';
  physicalLayer=L.layerGroup().addTo(map);
  relief=L.tileLayer('atlas/relief-{z}-{x}-{y}.webp',{maxNativeZoom:3,maxZoom:10,
    noWrap:true,zIndex:0,keepBuffer:1,updateWhenIdle:true,bounds:[[-85.051129,-180],[85.051129,180]]}).addTo(map);
  L.geoJSON(countryFeatures,{style:f=>countryStyle(f.properties.iso),onEachFeature:(f,p)=>{
    const code=f.properties.iso;countryLayers.set(code,p);shownGeometry.set(code,f.geometry);
    p.on('dblclick',e=>{
      if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);
      const ll=[e.latlng.lat,e.latlng.lng];
      const area=code==='CHN'&&Object.keys(areas).find(key=>insideArea(key,ll));
      if(map.getZoom()>=9||region===(area||code))map.setZoomAround(e.latlng,Math.min(19,map.getZoom()+1));
      else setRegion(area||code);
    });
  }}).addTo(map);
  L.control.scale({position:'bottomleft',imperial:false,maxWidth:95}).addTo(map);
  map.on('moveend zoomend',scheduleCartography);
  map.on('zoomend',nearbyNames);
  Promise.all([readVector('lakes'),readVector('rivers')]).then(([lakes,rivers])=>{
    physicalData=lakes.concat(rivers);scheduleCartography();
  }).catch(console.warn);
  readVector('places').then(data=>{cityData=data;drawMap();}).catch(console.warn);
}
const districtData=new Map(), districtRequests=new Set();
function paintDistricts(z,viewport,place){
  if(z<8)return;
  const cell=(v,origin,max)=>Math.max(0,Math.min(max,Math.floor((v+origin)/15)));
  for(let x=cell(viewport.getWest(),180,23);x<=cell(viewport.getEast(),180,23);x++){
    for(let y=cell(viewport.getSouth(),90,11);y<=cell(viewport.getNorth(),90,11);y++){
      const key=x+'-'+y;
      if(!districtCells.has(key))continue;
      if(!districtData.has(key)){
        if(!districtRequests.has(key)){
          districtRequests.add(key);
          readVector('districts/'+key).then(rows=>{districtData.set(key,rows);drawMap();})
            .catch(console.warn).finally(()=>districtRequests.delete(key));
        }
        continue;
      }
      for(const [level,lat,lon,name,zh] of districtData.get(key)){
        if(z<(level===2?8:level===3?9:12))continue;
        const label=lang.startsWith('zh')&&zh?zh:name;
        place([lat,lon],label,'district-label',Math.min(230,Math.max(44,label.length*(lang.startsWith('zh')?13:7)+12)));
      }
    }
  }
}
function paintPlaceLabels(z,viewport,occupied){
  function place(ll,text,cls,width){
    if(!viewport.contains(ll))return;
    const p=map.latLngToContainerPoint(ll),half=width/2;
    if(occupied.some(d=>Math.abs(d.x-p.x)<(d.half+half)&&Math.abs(d.y-p.y)<18))return;
    occupied.push({x:p.x,y:p.y,half});
    L.marker(ll,{interactive:false,keyboard:false,zIndexOffset:-900,icon:L.divIcon({
      className:cls,html:make('span',text),iconSize:[width,18],iconAnchor:[half,9]})}).addTo(labels);
  }
  if(z>=6){
    const names=[[25.74333,123.47333,'钓鱼岛','釣魚島','Diaoyu Dao'],[25.92333,123.68167,'黄尾屿','黃尾嶼','Huangwei Yu'],
      [25.92167,124.55833,'赤尾屿','赤尾嶼','Chiwei Yu'],[25.73,123.54167,'北小岛','北小島','Bei Xiaodao'],[25.72333,123.55,'南小岛','南小島','Nan Xiaodao']];
    for(const [lat,lon,zh,hant,en] of names)place([lat,lon],lang==='zh-Hans'?zh:lang==='zh-Hant'?hant:en,'area-label',lang.startsWith('zh')?60:95);
  }
  paintDistricts(z,viewport,place);
  if(z>=9&&streets&&!streetFailures.size)return;
  if(z>=3.5)for(const [code,a] of Object.entries(areas))place([a.lat,a.lon],areaName(code),'area-label',lang.startsWith('zh')?62:115);
  if(z>=2.25)for(const f of features){
    if(z<3.5&&f.properties.rank>3)continue;
    place([f.properties.lat,f.properties.lon],countryName(f),'country-label',85);
  }
  if(z<4)return;
  for(const [min,lat,lon,en,zh,hant] of cityData){
    if(z<min+.75)continue;
    const name=lang==='zh-Hans'?zh||en:lang==='zh-Hant'?hant||zh||en:en;
    place([lat,lon],name,'city-label',Math.min(130,Math.max(40,name.length*(lang.startsWith('zh')?13:7)+12)));
  }
}
