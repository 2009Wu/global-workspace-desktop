'use strict';

// The ordinary map opens immediately. Load the WebGL city renderer on first use.
let mapLibrary;
function loadCityLibrary(){
 if(mapLibrary)return mapLibrary;
 const css=document.createElement('link');
 css.rel='stylesheet';css.href='vendor/maplibre-gl.css';document.head.append(css);
 mapLibrary=new Promise((resolve,reject)=>{
  const file=document.createElement('script');file.src='vendor/maplibre-gl-csp.js';
  file.onload=()=>{maplibregl.setWorkerUrl(new URL('vendor/maplibre-gl-csp-worker.js',location.href).href);maplibregl.addProtocol('mosaic',mosaicProtocol);resolve()};
  file.onerror=()=>{css.remove();file.remove();mapLibrary=null;reject(Error(t('error')))};
  document.head.append(file);
 });
 return mapLibrary;
}
function cityNameExpression(){
 const code=lang==='zh-Hans'?'zh-Hans':lang==='zh-Hant'?'zh-Hant':lang;
 return ['coalesce',['get','name:'+code],['get','name:'+code.split('-')[0]],['get','name'],['get','ref'],''];
}
function viewpointLabels(){
 const at=(xy,name,region=false)=>({type:'Feature',geometry:{type:'Point',coordinates:xy},properties:{name,region}});
 return {type:'FeatureCollection',features:[...Object.entries(areas).map(([id,a])=>at([a.lon,a.lat],viewpointName(id),true)),...countryFeatures.map(f=>at([f.properties.lon,f.properties.lat],countryName(f)))]};
}
function cityStyle(){
 const vector=(id,type,sourceLayer,paint,minzoom=0)=>({id,type,source:'tiles','source-layer':sourceLayer,paint,minzoom});
 const road=vector('roads','line','transportation',{'line-color':['match',['get','class'],['motorway','trunk','primary'],'#c0a674','#768a90'],'line-width':['interpolate',['linear'],['zoom'],7,.5,13,1.1,18,2.7]},6);
 const label=(id,sourceLayer,minzoom,layout)=>({...vector(id,'symbol',sourceLayer,{'text-color':'#e0e7e8','text-halo-color':'#182730','text-halo-width':1.4},minzoom),
  layout:{'text-field':cityNameExpression(),'text-font':['Noto Sans Regular'],'text-size':12,...layout}});
 const collection=features=>({type:'FeatureCollection',features});
 return {version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources:{land:{type:'geojson',data:collection(countryFeatures),attribution:'Natural Earth'},
   tiles:{type:'vector',url:'https://tiles.openfreemap.org/planet',attribution:streetCredits},
   'region-points':{type:'geojson',data:viewpointLabels()},
   events:{type:'geojson',data:collection([])}},
  layers:[{id:'sea',type:'background',paint:{'background-color':'#142b39'}},
   {id:'land',type:'fill',source:'land',paint:{'fill-color':'#30444b'}},
   {id:'borders',type:'line',source:'land',paint:{'line-color':'#6c878d','line-width':.8}},
   vector('green','fill','landcover',{'fill-color':'#304f49'},7),
   vector('water','fill','water',{'fill-color':'#173c50'}),
   road,
   {id:'region-names',type:'symbol',source:'region-points',minzoom:3,layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':14,'text-padding':6},paint:{'text-color':'#fff2cd','text-halo-color':'#283735','text-halo-width':2}},
   label('places','place',0,{'text-size':['interpolate',['linear'],['zoom'],2,11,14,15]}),
   label('roadNames','transportation_name',12,{'symbol-placement':'line'}),
   {id:'incidents',type:'circle',source:'events',paint:{'circle-radius':6,'circle-color':['get','color'],'circle-stroke-color':'#15242e','circle-stroke-width':2}},
   {id:'incidentTypes',type:'symbol',source:'events',minzoom:5,layout:{'text-field':['get','symbol'],'text-size':10,'text-font':['Noto Sans Regular'],'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#111d24'}}
  ]};
}
function initCityScene(){
 const wrap=$('mapWrap'),toggle=$('sceneToggle'),street=$('streetView');
 const container=make('div');container.id='cityScene';container.hidden=true;wrap.append(container);
 const picker=make('div');picker.id='streetPicker';picker.hidden=true;picker.tabIndex=0;wrap.append(picker);
 const hint=make('span');picker.append(hint);
 let scene=null,opening=false,records=new Map(),dataKey='',imageryKey=null;
 const buildingControl=$('buildingsToggle');
 let modelsOpen=false,autoModel=true,modelLayer='';
 function modelBounds(){
  if($('dialog').open||document.hidden)return '';
  const r=container.getBoundingClientRect();
  return [r.left/innerWidth,r.top/innerHeight,r.right/innerWidth,r.bottom/innerHeight].join(',');
 }
 function sendBounds(){if(modelsOpen)rpc('cityBounds',modelBounds()).catch(e=>notice(e.message))}
 function closeModels(restore=false){
  if(!modelsOpen)return;
  const instance=scene,original=scene?.getCenter();modelsOpen=false;rpc('cityClose',restore?'camera':'').then(c=>{
   if(restore&&scene===instance&&!modelsOpen&&Array.isArray(c)&&c.length===2&&scene.getCenter().lng===original.lng&&scene.getCenter().lat===original.lat){
    scene.jumpTo({center:c});followMapCenter(c[1],c[0]);
   }
  }).catch(e=>notice(e.message));updateBuildings();updateAerialControls();
 }
 async function openModels(){
  if(!scene||modelsOpen)return;autoModel=false;modelsOpen=true;modelLayer=layer;
  const c=scene.getCenter(),range=Math.max(200,40000000*Math.cos(c.lat*Math.PI/180)/2**scene.getZoom());
  const camera=[c.lat,((c.lng+540)%360)-180,Math.min(20000000,range),scene.getBearing()].join(',');
  pick(false);updateBuildings();updateAerialControls();
  try{await rpc('cityOpen',camera,modelBounds());sendBounds()}catch(e){closeModels();notice(e.message)}
 }
 function updateBuildings(){
  buildingControl.hidden=!scene;
  buildingControl.textContent=modelsOpen?(lang==='zh-Hant'?'返回地圖':lang==='zh-Hans'?'返回地图':'Return to map'):(lang.startsWith('zh')?(lang==='zh-Hant'?'實景建築':'实景建筑'):'3D buildings');
  buildingControl.setAttribute('aria-pressed',String(modelsOpen));
 }
 buildingControl.onclick=()=>modelsOpen?closeModels(true):openModels();
 new ResizeObserver(sendBounds).observe(container);window.addEventListener('resize',sendBounds);
 new MutationObserver(sendBounds).observe($('dialog'),{attributes:true,attributeFilter:['open']});
 document.addEventListener('visibilitychange',sendBounds);
 const roads=$('roadsToggle'),aerial=$('aerialToggle');
 const zh=()=>lang.startsWith('zh');
 function updateAerialControls(){
  const overlay=readLocal('desk:aerial-roads',false),sat=layer==='sat',topo=layer==='military';
  roads.hidden=aerial.hidden=!scene||!sat||modelsOpen;street.hidden=modelsOpen;
  roads.textContent=zh()?(lang==='zh-Hant'?'道路標註':'道路标注'):t('map')+' · OSM';
  aerial.textContent=zh()?(lang==='zh-Hant'?'俯視':'俯视'):'Top view';
  roads.setAttribute('aria-pressed',String(overlay));
  if(!scene?.getLayer('roads'))return;
  for(const id of ['roads','roadNames'])scene.setLayoutProperty(id,'visibility',(topo||(sat&&!overlay))?'none':'visible');
  scene.setLayoutProperty('green','visibility',topo?'none':'visible');
  scene.setLayoutProperty('water','visibility',topo?'none':'visible');
  scene.setLayoutProperty('places','visibility',topo?'none':'visible');
  scene.setFilter('region-names',topo?['==',['get','region'],true]:null);
  scene.setFilter('borders',topo?['==',['get','iso'],'CHN']:null);
  scene.setPaintProperty('borders','line-color',topo?'#872d54':'#6c878d');
  scene.setPaintProperty('borders','line-width',topo?1.7:.8);
  scene.setLayoutProperty('places','text-padding',sat?18:4);
  scene.setFilter('places',['match',['get','class'],['city','town',...(sat?[]:['village','suburb','neighbourhood','hamlet'])],true,false]);
  scene.setPaintProperty('roads','line-opacity',sat?.53:1);
 }
 roads.onclick=()=>{localStorage.setItem('desk:aerial-roads',JSON.stringify(roads.getAttribute('aria-pressed')!=='true'));updateAerialControls()};
 aerial.onclick=()=>scene?.easeTo({pitch:0,bearing:0});
 const labels=()=>{
  updateBuildings();updateAerialControls();
  street.textContent=t('streetView');
  street.title=t('streetView')+' · Google Maps';
  toggle.title=scene?(zh()?'返回原地图':'Return to previous map'):(zh()?'进入三维地图 · 右键拖动旋转或倾斜':'Open 3D map · right-drag to rotate or tilt');
  toggle.ariaLabel=toggle.title;toggle.setAttribute('aria-pressed',String(!!scene));
  hint.textContent=zh()?'点选街道查看街景 · Esc 取消':'Select a street for Street View · Esc to cancel';
  picker.ariaLabel=hint.textContent;
  scene?.getSource('region-points')?.setData(viewpointLabels());
  if(scene?.getLayer('places'))for(const id of ['places','roadNames'])scene.setLayoutProperty(id,'text-field',cityNameExpression());
 };
 function pick(active){picker.hidden=!active;street.setAttribute('aria-pressed',String(active));if(active)picker.focus();else if(document.activeElement===picker)street.focus()}
 function choose(point){
  let target;
  if(scene)target=scene.unproject([point.x,point.y]);
  else if(desktopGlobe.visible){const ll=desktopGlobe.spherePoint(point);if(ll)target=L.latLng(ll)}
  else target=map.containerPointToLatLng(point);
  if(!target){notice(hint.textContent);return}
  const coords=[target.lat,((target.lng+540)%360)-180].map(n=>n.toFixed(6)).join(',');
  pick(false);rpc('streetView',coords,t('streetView')).catch(e=>notice(e.message));
 }
 picker.onclick=e=>{const rect=picker.getBoundingClientRect();choose(L.point(e.clientX-rect.left,e.clientY-rect.top))};
 picker.onkeydown=e=>{if(e.key==='Escape')pick(false);else if(e.key==='Enter'){e.preventDefault();choose(L.point(picker.clientWidth/2,picker.clientHeight/2))}};
 street.onclick=()=>pick(picker.hidden);
 function update(rows){
  if(!scene?.getSource('events'))return;
  const located=rows.filter(e=>e.location?.length===2);
  const key=JSON.stringify(located.map(e=>[e.id,e.location,e.severity,e.layer]));
  records=new Map(located.map(e=>[e.id,e]));if(dataKey===key)return;dataKey=key;
  scene.getSource('events').setData({type:'FeatureCollection',features:located.map(e=>({type:'Feature',
   geometry:{type:'Point',coordinates:[e.location[1],e.location[0]]},
   properties:{id:e.id,color:colors[e.severity]||colors[0],symbol:glyph[e.layer]||'·'}}))});
 }
 let terrainView='';
 function settleCityView(){
  if(!scene||modelsOpen||(!autoModel&&layer!=='sat')||!scene.isSourceLoaded('tiles'))return;
  const c=scene.getCenter(),zoom=scene.getZoom();
  const key=[Math.floor(c.lng*150),Math.floor(c.lat*150),Math.floor(zoom)].join('/');
  if(key===terrainView)return;terrainView=key;
  let nearby=0;
  if(zoom>=14){
   const span=.006/Math.max(.2,Math.cos(c.lat*Math.PI/180));
   for(const feature of scene.querySourceFeatures('tiles',{sourceLayer:'building'})){
    const g=feature.geometry,point=g.type==='MultiPolygon'?g.coordinates[0]?.[0]?.[0]:g.coordinates[0]?.[0];
    if(point&&Math.abs(c.lat-point[1])<.006&&Math.abs(c.lng-point[0])<span&&++nearby>=16)break;
   }
  }
  if(autoModel&&nearby>=16)openModels();
  if(layer!=='sat'||!scene.getSource('elevation'))return;
  const source=nearby>=16?'city-ground':'elevation';
  if(scene.getTerrain()?.source===source)return;
  // A coarser elevation mesh preserves hills while reducing roof-scale relief in urban imagery.
  if(!scene.getSource(source))scene.addSource(source,{type:'raster-dem',tiles:[terrainDEM],encoding:'terrarium',tileSize:256,maxzoom:11,attribution:'Terrain Tiles · Mapzen / AWS Open Data'});
  scene.setTerrain({source,exaggeration:1});
 }
 function syncImagery(){
  if(!scene?.getLayer('green'))return;
  if(modelsOpen&&modelLayer!==layer)closeModels();
  updateBuildings();updateAerialControls();
  const key=layer==='military'?'military':layer==='terrain'?'terrain':layer!=='sat'?'':imageryMode==='daily'?sessionDate:'mosaic';
  if(key===imageryKey)return;imageryKey=key;terrainView='';
  if(scene.getLayer('photo')){scene.removeLayer('photo');scene.removeSource('photo')}
  const elevated=['terrain','sat','military'].includes(layer);
  if(elevated&&!scene.getSource('elevation'))scene.addSource('elevation',{type:'raster-dem',tiles:[terrainDEM],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'Terrain Tiles · Mapzen / AWS Open Data'});
  scene.setTerrain(elevated?{source:'elevation',exaggeration:1}:null);
  if(scene.getLayer('shading'))scene.removeLayer('shading');
  if(layer==='terrain')scene.addLayer({id:'shading',type:'hillshade',source:'elevation',paint:{'hillshade-shadow-color':'#243947','hillshade-highlight-color':'#e2d4af','hillshade-exaggeration':.65}},'roads');
  if(layer==='military'){
   scene.addSource('photo',{type:'raster',tiles:[topoURL],tileSize:256,maxzoom:17,attribution:topoCredits});
   scene.addLayer({id:'photo',type:'raster',source:'photo'},'borders');return;
  }
  if(layer!=='sat')return;
  const mosaic=key==='mosaic';
  const url=mosaic?'mosaic://tiles/{z}/{y}/{x}':'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/'+key+'/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg';
  scene.addSource('photo',{type:'raster',tiles:[url],tileSize:256,maxzoom:mosaic?19:9,attribution:mosaic?'Esri · Vantor, Earthstar Geographics, GIS User Community':'NASA GIBS · MODIS Terra'});
  scene.addLayer({id:'photo',type:'raster',source:'photo'},'roads');
 }
 function leave(){
  if(!scene)return;
  closeModels();const center=scene.getCenter(),level=scene.getZoom();scene.remove();scene=null;
  dataKey='';imageryKey=null;records.clear();container.hidden=true;wrap.classList.remove('using-city');
  desktopGlobe.updateVisibility();desktopGlobe.restoreCamera(center,level);labels();drawMap();
 }
 async function enter(){
  if(opening)return;opening=true;toggle.disabled=true;
  try{
   await loadCityLibrary();
   const c=map.getCenter(),camera=desktopGlobe.visible?desktopGlobe.camera():{center:[c.lng,c.lat],zoom:map.getZoom()-1};
   autoModel=true;container.hidden=false;
   scene=new maplibregl.Map({container,style:cityStyle(),...camera,pitch:45,maxPitch:68,maxZoom:19,renderWorldCopies:false,
    attributionControl:{compact:true},canvasContextAttributes:{antialias:true}});
   wrap.classList.add('using-city');desktopGlobe.updateVisibility();
   scene.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
   scene.on('moveend',event=>{if(event.originalEvent){const c=scene.getCenter();followMapCenter(c.lat,c.lng,scene.getZoom()<2)}});
   const instance=scene;
   scene.on('load',async()=>{
    syncImagery();labels();update(allRows());
    const detailed=new Map(await Promise.all(['CHN','IND','JPN'].map(async id=>[id,exact.get(id)||await readVector(id)])));
    if(scene===instance)scene.getSource('land').setData({type:'FeatureCollection',features:countryFeatures.map(f=>detailed.has(f.properties.iso)?{...f,geometry:detailed.get(f.properties.iso)}:f)});
   });
   scene.on('idle',settleCityView);
   scene.on('click','incidents',e=>{const item=records.get(e.features[0].properties.id);if(item)selectEvent(item,false)});
   scene.on('mousemove',e=>{$('coords').textContent=e.lngLat.lat.toFixed(3)+'° / '+e.lngLat.lng.toFixed(3)+'°'});
   let warned=false;
   scene.on('error',e=>{if(!warned){warned=true;notice(t('map')+' · '+t('error'));console.warn(e.error)}});
   labels();notice(zh()?'右键拖动可旋转或倾斜；放大到街区可查看立体建筑。':'Right-drag to rotate or tilt. Zoom into a neighborhood to see buildings.');
  }catch(e){if(scene)leave();container.hidden=true;notice('3D · '+t('error'));console.warn(e)}
  finally{opening=false;toggle.disabled=false}
 }
 toggle.onclick=()=>{pick(false);if(scene)leave();else enter()};
 new ResizeObserver(()=>scene?.resize()).observe(container);
 labels();
 return {get active(){return !!scene},labels,update,syncImagery,
  locate(e){closeModels();scene?.easeTo({center:[e.location[1],e.location[0]],zoom:regionalPoint(e)?(e.anchor==='city'?11:6):15})},
  frameRegion(){closeModels();const c=map.getCenter();scene?.easeTo({center:[c.lng,c.lat],zoom:map.getZoom()-1})}};
}
