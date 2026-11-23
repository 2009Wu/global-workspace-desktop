'use strict';
const msg=document.getElementById('msg');
const watchdog=setTimeout(()=>{msg.textContent='正在加载更清晰的建筑纹理…'},25000);
require(['esri/Map','esri/Basemap','esri/views/SceneView','esri/layers/TileLayer','esri/layers/IntegratedMeshLayer','esri/geometry/Point','esri/core/reactiveUtils'],
 async (Map,Basemap,SceneView,TileLayer,IntegratedMeshLayer,Point,reactive)=>{
 try{
  const [lat,lon,range,bearing]=location.hash.slice(1).split(',').map(Number);
  const layers=[1,3,4].map(id=>new IntegratedMeshLayer({url:'https://www.historygis.udd.gov.taipei/arcgis/rest/services/Hosted/mesh_20250'+id+'/SceneServer/layers/0',copyright:'臺北市政府都市發展局'}));
  const basemap=new Basemap({baseLayers:[new TileLayer({url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'})]});
  const map=new Map({basemap,ground:'world-elevation',layers});
  const view=new SceneView({map,container:'scene',center:[lon,lat],zoom:16,environment:{atmosphereEnabled:false,starsEnabled:false}});
  window.cityCenter=()=>view.center?[view.center.longitude,view.center.latitude]:null;
  await view.when();
  await view.goTo({target:new Point({longitude:lon,latitude:lat}),scale:Math.max(1200,range*4),heading:bearing,tilt:58},{animate:false});
  const views=await Promise.all(layers.map(l=>view.whenLayerView(l)));
  await reactive.whenOnce(()=>!view.updating&&views.some(v=>!v.suspended));
  clearTimeout(watchdog);msg.textContent='';document.body.dataset.ready='true';
 }catch(e){clearTimeout(watchdog);msg.textContent='实景模型加载失败。可点击「返回地图」重试。';console.warn(e)}
});
