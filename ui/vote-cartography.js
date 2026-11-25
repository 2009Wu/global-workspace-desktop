'use strict';

// All detail comes from the same offline atlas as the main map.
function addVoteCartography(map){
 const water=L.layerGroup().addTo(map),visibleWater=new Map();
 const geometryCache=new Map(),detailed=new Set();
 let revision=0,overview;
 const waterData=new Map(),loading=new Set();
 function drawWater(){
  const viewport=map.getBounds().pad(.05),zoom=map.getZoom();
  const wanted=new Set();
  for(const name of ['lakes','rivers']){
   const isLake=name==='lakes';
   if(!isLake&&zoom<3)continue;
   if(!waterData.has(name)&&!loading.has(name)){
    loading.add(name);
    readVector(name).then(data=>{waterData.set(name,data);drawWater()})
     .catch(console.warn).finally(()=>loading.delete(name));
   }
   for(const f of waterData.get(name)||[]){
    if(f.properties.z>zoom+.5||!viewport.intersects(leafletBounds(f)))continue;
    wanted.add(f);
    if(visibleWater.has(f))continue;
    const style=isLake?{stroke:false,fillColor:'#172b38',fillOpacity:.97}:
     {fill:false,color:'#244858',weight:.85,opacity:.57};
    const path=L.geoJSON(f,{pane:'voteWater',interactive:false,smoothFactor:.28,style});
    water.addLayer(path);visibleWater.set(f,path);
   }
  }
  for(const [f,path] of visibleWater)if(!wanted.has(f)){water.removeLayer(path);visibleWater.delete(f)}
 }

 async function refine(){
  const current=++revision,viewport=map.getBounds().pad(.05);
  const zoomed=map.getZoom()>=2.65,queue=[];
  for(const f of features){
   const code=voteIso(f),path=votePaths.get(code);
   if(zoomed&&viewport.intersects(leafletBounds(f))){
    if(!detailed.has(code))queue.push(f);
   }else{
    detailed.delete(code);
    showShape(code,overview?.[f.properties.iso]||f.geometry,path);
   }
  }
  async function next(){
   while(current===revision&&queue.length){
    const f=queue.shift(),code=voteIso(f);
    if(!geometryCache.has(code))geometryCache.set(code,readVector(f.properties.iso));
    try{
     const geometry=await geometryCache.get(code);
     if(current!==revision)return;
     showShape(code,geometry,votePaths.get(code));detailed.add(code);
    }catch(error){geometryCache.delete(code);console.warn(error)}
   }
  }
  await Promise.all(Array.from({length:Math.min(3,queue.length)},next));
 }
 map.createPane('voteRelief').style.cssText='z-index:405;pointer-events:none';
 map.createPane('voteWater').style.cssText='z-index:410;pointer-events:none';
 const relief=L.tileLayer('atlas/vote-relief/{z}-{x}-{y}.webp',{pane:'voteRelief',noWrap:true,
  bounds:[[-90,-180],[90,180]],minZoom:-1,minNativeZoom:0,maxNativeZoom:2,maxZoom:7,
  updateWhenIdle:true,keepBuffer:1}).addTo(map);
 L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
 const redraw=()=>{
  relief.setOpacity(.60*Math.min(1,Math.max(0,(7-map.getZoom())/2)));
  drawWater();refine();
 };
 map.on('moveend resize',redraw);
 redraw();
 readVector('vote-overview').then(data=>{overview=data;refine()}).catch(console.warn);
}
