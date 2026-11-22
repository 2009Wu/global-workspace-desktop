'use strict';

const streetCredits = '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>';
let streets, streetStyle, streetRequest, streetURL, streetRetryAt=0;
const streetFailures=new Set();

function streetStyleRules(imagery) {
  const v=protomapsL;
  const line=(dataLayer,options,filter,minzoom=9)=>({dataLayer,minzoom,filter,symbolizer:new v.LineSymbolizer(options)});
  const polygon=(dataLayer,fill,filter,minzoom=9)=>({dataLayer,minzoom,filter,symbolizer:new v.PolygonSymbolizer({fill})});
  const primary=(_z,f)=>['motorway','trunk','primary'].includes(f.props.class);
  const localBoundary=(_z,f)=>Number(f.props.admin_level)>=5&&!Number(f.props.maritime)&&!Number(f.props.disputed);
  const labelProps=()=>['name:'+lang,'name:'+lang.split('-')[0],'name','name:en','ref'];
  const text={labelProps,font:'500 12px "Segoe UI", "Microsoft YaHei UI", sans-serif',fill:imagery?'#fff':'#e7ecdf',stroke:imagery?'#152226':'#20323a',width:imagery?4:3};
  const paintRules=imagery?[]:[
    polygon('landcover','#29463e',(_z,f)=>['wood','grass'].includes(f.props.class)),
    polygon('park','#2a493e'),polygon('water','#123b50'),
    line('waterway',{color:'#427287',width:z=>z>14?2.5:1}),
    polygon('building','#46515a',undefined,15)
  ];
  paintRules.push(line('transportation',{color:imagery?'#e2e6df':'#6d7e80',opacity:imagery?.55:1,width:z=>imagery?(z>=15?1.4:.9):(z>=16?3.3:z>=13?1.8:1)}),
    line('transportation',{color:imagery?'#ffe39e':'#c2ac78',opacity:imagery?.85:1,width:z=>imagery?(z>=15?2:1.3):(z>=15?4:z>=12?2.6:1.4)},primary),
    line('boundary',{dash:[5,4],dashColor:'#ab9fab',dashWidth:1.4},localBoundary));
  const lineNames=(dataLayer,minzoom,filter)=>({dataLayer,minzoom,filter,symbolizer:new v.LineLabelSymbolizer({...text,repeatDistance:225})});
  const labelRules=[
    {dataLayer:'place',filter:(_z,f)=>!['country','state','continent','island'].includes(f.props.class),
      symbolizer:new v.CenteredTextSymbolizer({...text,font:'600 14px "Segoe UI", "Microsoft YaHei UI", sans-serif'})},
    lineNames('boundary',9,localBoundary),lineNames('transportation_name',11,primary),
    lineNames('transportation_name',13,(_z,f)=>!primary(_z,f))
  ];
  return {paintRules,labelRules};
}
function streetStatus(){
  const box=$('streetStatus');
  box.hidden=map.getZoom()<9||!(streetRetryAt||streetFailures.size);
  box.textContent='OpenFreeMap · '+t('error')+' · '+t('retry');
  box.onclick=()=>{streetRetryAt=0;streetURL=null;streetStyle=null;streetFailures.clear();refreshCartography();};
}
async function configureStreets(z){
  const desired=lang+'/'+(layer==='sat'?'imagery':'street');
  if(streets&&streetStyle!==desired){streets.remove();streets=null;streetFailures.clear();}
  streetStatus();
  if(z<9||streets||streetRequest||Date.now()<streetRetryAt)return;
  streetRequest=true;
  try{
    if(!streetURL){
      const response=await fetch('https://tiles.openfreemap.org/planet',{signal:AbortSignal.timeout(9000)});
      if(!response.ok)throw Error('TileJSON '+response.status);
      const metadata=await response.json();
      streetURL=metadata.tiles?.find(url=>url.startsWith('https://tiles.openfreemap.org/')&&url.includes('{z}/{x}/{y}'));
      if(!streetURL)throw Error('TileJSON URL');
    }
    if(map.getZoom()<9||desired!==lang+'/'+(layer==='sat'?'imagery':'street'))return;
    const imagery=layer==='sat';
    const detail=protomapsL.leafletLayer({url:streetURL,minZoom:9,maxZoom:19,maxDataZoom:14,levelDiff:1,
      pane:'streetDetail',noWrap:true,attribution:streetCredits,tileDelay:1,
      ...streetStyleRules(imagery)});
    detail.on('tileload',({tile,coords})=>{
      const c=detail.views.get('').dataTileForDisplayTile(coords).dataTile;
      if(!imagery&&!streetFailures.has([c.z,c.x,c.y].join('/')))tile.style.backgroundColor='#26383e';
    });
    detail.on('load',nearbyNames);
    const source=detail.views.get('').tileCache.source, get=source.get.bind(source);
    source.get=async(coords,size)=>{
      const key=[coords.z,coords.x,coords.y].join('/');
      try{const data=await get(coords,size);if(streets===detail){streetFailures.delete(key);streetStatus();}return data;}
      catch(error){if(error.name!=='AbortError'&&streets===detail){streetFailures.add(key);streetStatus();}throw error;}
    };
    streets=detail;streetStyle=desired;streetRetryAt=0;detail.addTo(map);
  }catch(err){streetRetryAt=Date.now()+15000;console.warn('Street detail:',err);}
  finally{streetRequest=false;streetStatus();if(map.getZoom()>=9&&!streets&&!streetRetryAt)scheduleCartography();}
}
