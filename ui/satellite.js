'use strict';

const imageModeNames={
  'zh-Hans':['高清拼接影像','按日观测'],'zh-Hant':['高解析拼接影像','按日觀測'],
  en:['High-resolution mosaic','Daily observation'],hi:['उच्च रिज़ॉल्यूशन मोज़ेक','दैनिक अवलोकन'],
  es:['Mosaico de alta resolución','Observación diaria'],ar:['فسيفساء عالية الدقة','رصد يومي'],
  fr:['Mosaïque haute résolution','Observation quotidienne'],bn:['উচ্চ রেজোলিউশনের মোজাইক','দৈনিক পর্যবেক্ষণ'],
  pt:['Mosaico de alta resolução','Observação diária'],id:['Mosaik resolusi tinggi','Pengamatan harian'],
  ur:['اعلیٰ ریزولیوشن موزیک','روزانہ مشاہدہ'],ru:['Мозаика высокого разрешения','Снимок за день'],
  de:['Hochauflösendes Mosaik','Tagesaufnahme'],ja:['高解像度モザイク','日別観測'],
  pcm:['Sharp picture mosaic','Daily observation'],mr:['उच्च रिझोल्यूशन मोझॅक','दैनिक निरीक्षण'],
  vi:['Ảnh ghép độ phân giải cao','Quan trắc theo ngày'],te:['అధిక రిజల్యూషన్ మొజాయిక్','రోజువారీ పరిశీలన'],
  sw:['Picha unganishi zenye mwonekano wa juu','Uchunguzi wa kila siku'],tr:['Yüksek çözünürlüklü mozaik','Günlük gözlem']
};
const worldImageService='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
let imageryMode='mosaic', activeImageryKey='';
function applyImageryMode(value){imageryMode=value==='daily'?'daily':'mosaic';}

const coverageBlocks=new Map();
async function mosaicCoverage(z,x,y,signal){
  const size=Math.min(16,2**z),left=x-x%size,top=y-y%size;
  const key=[z,top,left,size,size].join('/');
  let block=coverageBlocks.get(key);
  if(!block){
    // Shared coverage requests outlive the individual tiles that use them.
    block=fetch(worldImageService+'/tilemap/'+key+'?f=json',{signal:AbortSignal.timeout(6000)})
      .then(response=>response.ok?response.json():null)
      .catch(()=>null);
    coverageBlocks.set(key,block);
    if(coverageBlocks.size>192)coverageBlocks.delete(coverageBlocks.keys().next().value);
  }
  const result=await block;signal.throwIfAborted();
  if(!result?.valid||!result.location){if(coverageBlocks.get(key)===block)coverageBlocks.delete(key);return undefined;}
  const box=result.location,dx=x-box.left,dy=y-box.top;
  if(dx>=0&&dx<box.width&&dy>=0&&dy<box.height)return result.data[dy*box.width+dx];
}
async function mosaicPhoto(coords,signal){
  const timeout=AbortSignal.any([signal,AbortSignal.timeout(15000)]);
  for(let z=coords.z;z>=0;z--){
    const factor=2**(coords.z-z),x=Math.floor(coords.x/factor),y=Math.floor(coords.y/factor);
    if(z>=16&&await mosaicCoverage(z,x,y,timeout)===0)continue;
    let response;
    try{response=await fetch(worldImageService+'/tile/'+z+'/'+y+'/'+x+'?blankTile=false',{signal:timeout});}
    catch(error){
      // A missing CDN image can return a 404 without a CORS header.
      if(!timeout.aborted&&await mosaicCoverage(z,x,y,timeout)===0)continue;
      throw error;
    }
    if(response.status===404||response.headers.get('blank-tile')==='true')continue;
    if(!response.ok)throw Error('Imagery '+response.status);
    const image=await response.blob();
    if(factor===1)return {image,z};
    const bitmap=await createImageBitmap(image);
    try{
      timeout.throwIfAborted();
      const canvas=new OffscreenCanvas(256,256),size=bitmap.width/factor;
      canvas.getContext('2d').drawImage(bitmap,(coords.x%factor)*size,(coords.y%factor)*size,size,size,0,0,256,256);
      return {image:await canvas.convertToBlob(),z};
    }finally{bitmap.close();}
  }
  throw Error('Imagery unavailable');
}
async function mosaicProtocol(request,controller){
  const match=/^mosaic:\/\/tiles\/(\d+)\/(\d+)\/(\d+)$/.exec(request.url);
  if(!match)throw Error('Invalid imagery tile');
  const {image}=await mosaicPhoto({z:+match[1],y:+match[2],x:+match[3]},controller.signal);
  return {data:await image.arrayBuffer()};
}

const MosaicLayer=L.GridLayer.extend({
  createTile(coords, done){
    const tile=document.createElement('canvas');
    tile.width=tile.height=256;
    const request=new AbortController();
    tile.cancelImagery=()=>request.abort();
    this.paintImage(tile,coords,request.signal).then(()=>{
      if(!request.signal.aborted)done(null,tile);
    }).catch(error=>{if(!request.signal.aborted)done(error,tile);});
    return tile;
  },
  async paintImage(tile,coords,signal){
    const {image,z}=await mosaicPhoto(coords,signal);
    const bitmap=await createImageBitmap(image);
    try{
      if(signal.aborted)return;
      tile.getContext('2d').drawImage(bitmap,0,0);tile.dataset.nativeZoom=z;
    }finally{bitmap.close();}
  }
});

function imageryControls(){
  const menu=$('imageryMode'),names=imageModeNames[lang==='arz'?'ar':lang]||imageModeNames.en;
  menu.options[0].text=names[0]+' · Esri';menu.options[1].text=names[1]+' · NASA';
  menu.value=imageryMode;menu.ariaLabel=t('sat');menu.hidden=layer!=='sat';
  $('imagery').hidden=menu.hidden||imageryMode!=='daily';$('imagery').value=sessionDate;
  $('imageryRetry').textContent=t('sat')+' · '+t('error')+' · '+t('retry');
}
function satLayer(){
  imageryControls();
  cityScene?.syncImagery();
  if(!map||$('mapPane').hidden)return;
  const key=layer==='military'?'military':layer==='terrain'?'terrain':layer!=='sat'?'':imageryMode==='daily'?'daily/'+sessionDate:'mosaic';
  scheduleCartography();
  if(activeImageryKey===key)return;
  activeImageryKey=key;$('imageryRetry').hidden=true;
  if(satellite){satellite.remove();satellite=null;}
  if(!key)return;
  if(key==='military'){
   satellite=L.tileLayer(topoURL,{maxNativeZoom:17,maxZoom:19,noWrap:true,attribution:topoCredits}).addTo(map);
   satellite.on('tileerror',()=>{if(layer==='military'){$('imageryRetry').textContent='OpenTopoMap · '+t('retry');$('imageryRetry').hidden=false;}});
   return;
  }
  if(key==='terrain'){satellite=L.tileLayer(reliefURL,{maxNativeZoom:13,maxZoom:19,attribution:'Esri World Shaded Relief'}).addTo(map);return;}
  const mosaic=imageryMode==='mosaic';
  const next=mosaic?new MosaicLayer({maxNativeZoom:19,maxZoom:19,noWrap:true,
    attribution:'<a href="https://goto.arcgisonline.com/maps/World_Imagery">Esri World Imagery</a> · Vantor, Earthstar Geographics, GIS User Community'}):
    L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/'+sessionDate+'/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
      {maxNativeZoom:9,maxZoom:19,noWrap:true,attribution:'NASA GIBS · MODIS Terra '+sessionDate});
  const failed=new Set();
  next.on('tileerror',({tile})=>{failed.add(tile);if(satellite===next)$('imageryRetry').hidden=false;});
  next.on('tileunload',({tile})=>{tile.cancelImagery?.();failed.delete(tile);if(satellite===next)$('imageryRetry').hidden=!failed.size;});
  satellite=next;next.addTo(map);
}
