'use strict';
let terrainWorker,terrainJob=0;
const terrainJobs=new Map(),topoCredits='Elevation · Mapzen / AWS Terrain Tiles · Natural Earth';
function terrainTile(coords,signal){
 if(!terrainWorker){
  terrainWorker=new Worker('topography-worker.js');
  terrainWorker.onmessage=({data})=>terrainJobs.get(data.id)?.(data);
  terrainWorker.onerror=()=>{for(const done of terrainJobs.values())done({error:'Terrain renderer unavailable'});terrainWorker.terminate();terrainWorker=null};
 }
 return new Promise((resolve,reject)=>{
  signal.throwIfAborted();const id=++terrainJob;
  const abort=()=>{terrainWorker?.postMessage({id,cancel:true});terrainJobs.delete(id);reject(signal.reason)};
  terrainJobs.set(id,({bytes,error})=>{signal.removeEventListener('abort',abort);terrainJobs.delete(id);if(error)reject(Error(error));else resolve(bytes)});
  signal.addEventListener('abort',abort,{once:true});terrainWorker.postMessage({id,x:coords.x,y:coords.y,z:coords.z});
 });
}
async function terrainProtocol(request,controller){
 const match=/^relief:\/\/tiles\/(\d+)\/(\d+)\/(\d+)$/.exec(request.url);
 if(!match)throw Error('Invalid terrain tile');
 return {data:await terrainTile({z:+match[1],x:+match[2],y:+match[3]},controller.signal)};
}
const ContourLayer=L.GridLayer.extend({
 createTile(coords,done){
  const tile=document.createElement('canvas');tile.width=tile.height=256;
  const ctrl=new AbortController();tile.cancelTerrain=()=>ctrl.abort();
  terrainTile(coords,ctrl.signal).then(async bytes=>{
   if(ctrl.signal.aborted)return;
   const image=await createImageBitmap(new Blob([bytes]));try{if(!ctrl.signal.aborted){tile.getContext('2d').drawImage(image,0,0);done(null,tile)}}finally{image.close()}
  }).catch(err=>{if(!ctrl.signal.aborted)done(err,tile)});
  return tile;
 }
});
