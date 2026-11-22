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
    // A 404 denotes missing native coverage. Crop the matching quadrant of a
    // coarser tile so the photograph remains aligned with the event coordinates.
    const timeout=AbortSignal.any([signal,AbortSignal.timeout(15000)]);
    for(let z=coords.z;z>=0;z--){
      const factor=2**(coords.z-z),x=Math.floor(coords.x/factor),y=Math.floor(coords.y/factor);
      const response=await fetch(worldImageService+'/tile/'+z+'/'+y+'/'+x+'?blankTile=false',{signal:timeout});
      if(response.status===404)continue;
      if(!response.ok)throw Error('Imagery '+response.status);
      const bitmap=await createImageBitmap(await response.blob());
      try{
        if(signal.aborted)return;
        const size=bitmap.width/factor;
        tile.getContext('2d').drawImage(bitmap,(coords.x%factor)*size,(coords.y%factor)*size,size,size,0,0,256,256);
        tile.dataset.nativeZoom=z;
      }finally{bitmap.close();}
      return;
    }
    throw Error('Imagery unavailable');
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
  if(!map||$('mapPane').hidden)return;
  const key=layer!=='sat'?'':imageryMode==='daily'?'daily/'+sessionDate:'mosaic';
  scheduleCartography();
  if(activeImageryKey===key)return;
  activeImageryKey=key;$('imageryRetry').hidden=true;
  if(satellite){satellite.remove();satellite=null;}
  if(!key)return;
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
