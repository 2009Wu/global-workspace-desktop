'use strict';
function initDesktopGlobe(){
const local=(zh,en)=>lang.startsWith('zh')?zh:en;
const globe=make('div');globe.id='globeSurface';$('mapWrap').append(globe);
globe.innerHTML='<canvas id="sphere" aria-label="可旋转地球，使用方向键旋转，加减键缩放" tabindex="0"></canvas><div id="mapText"></div><div id="worldPins"></div><div id="globeTools"><button title="放大" aria-label="放大">＋</button><button title="缩小" aria-label="缩小">−</button><button title="回到初始视角" aria-label="回到初始视角">⌖</button></div><div id="globeAttribution">Natural Earth · GeoNames</div>';
const canvas=$('sphere'),ctx=canvas.getContext('2d',{alpha:true}),tau=Math.PI*2,rad=Math.PI/180;
const tex=document.createElement('canvas');tex.width=1024;tex.height=512;
const tg=tex.getContext('2d',{willReadFrequently:true});let tw=tex.width,th=tex.height;
if(overviewImage?.naturalWidth)tg.drawImage(overviewImage,0,0);
else{tg.fillStyle='#152936';tg.fillRect(0,0,tw,th)}
let detailedImage=null;
const qualityModes={
 auto:{name:'自动',gl:1.4,cpu:.66,fps:30},
 smooth:{name:'优先流畅',gl:.85,cpu:.48,fps:20},
 sharp:{name:'优先清晰',gl:2,cpu:.85,fps:40}
};
let quality=settings.mapQuality==='smooth'?'smooth':'auto';
let lastGlobeKey='',lastView='',movingUntil=0,settledTimer=0;
function createSphereRenderer(){
 const surface=document.createElement('canvas');surface.setAttribute('aria-hidden','true');
 surface.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
 const gl=surface.getContext('webgl',{alpha:true,depth:false,stencil:false,antialias:false,failIfMajorPerformanceCaveat:true,powerPreference:'high-performance'});
 if(!gl)return null;
 let program,uniforms,ready=false;
 function setup(){
  function shader(kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
  const vertex=shader(gl.VERTEX_SHADER,'attribute vec2 xy;void main(){gl_Position=vec4(xy,0.,1.);}');
  const fragment=shader(gl.FRAGMENT_SHADER,`
   precision highp float;
   uniform vec2 center;
   uniform vec2 tilt;
   uniform float radius;
   uniform float longitude;
   uniform sampler2D atlas;
   void main(){
    vec2 d=(gl_FragCoord.xy-center)/radius;
    float z2=1.-dot(d,d);
    if(z2<0.)discard;
    float z=sqrt(z2);
    float latitude=asin(clamp(d.y*tilt.y+z*tilt.x,-1.,1.));
    float delta=atan(d.x,z*tilt.y-d.y*tilt.x);
    vec2 uv=vec2(fract(.5+longitude+delta/6.28318530718),.5-latitude/3.14159265359);
    float light=.82+.18*z+.11*d.y-.07*d.x+.32*pow(1.-z,5.);
    float rim=1.-smoothstep(0.,2.3,z2*radius);
    vec3 color=mix(texture2D(atlas,uv).rgb*light,vec3(.34,.55,.60),rim*.6);
    float opacity=clamp(z2*radius*.82,0.,1.);
    gl_FragColor=vec4(color*opacity,opacity);
   }`);
  program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const attr=gl.getAttribLocation(program,'xy');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);
  for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.LINEAR);
  upload(detailedImage||tex);if(gl.getError()!==gl.NO_ERROR)throw Error('Map texture unavailable');
  uniforms=Object.fromEntries(['center','tilt','radius','longitude'].map(k=>[k,gl.getUniformLocation(program,k)]));ready=true;surface.hidden=false;
 }
 function upload(image){
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
  if(image===detailedImage){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR)}
 }
 try{setup()}catch{return null}
 globe.insertBefore(surface,canvas);
 surface.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;surface.hidden=true;lastGlobeKey='';refreshGlobe()});
 surface.addEventListener('webglcontextrestored',()=>{try{setup()}catch{ready=false}lastGlobeKey='';refreshGlobe()});
 return {upload,maxSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),get ready(){return ready},draw(g,d){
  const w=Math.round(g.w*d),h=Math.round(g.h*d);if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h}
  gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uniforms.center,g.cx*d,h-g.cy*d);gl.uniform2f(uniforms.tilt,Math.sin(lat*rad),Math.cos(lat*rad));gl.uniform1f(uniforms.radius,g.r*d);gl.uniform1f(uniforms.longitude,lon/360);
  gl.drawArrays(gl.TRIANGLES,0,3);
 }};
}
const gpuGlobe=createSphereRenderer();let pixels;
async function loadDetailedSurface(){
 const preferred=gpuGlobe?.maxSize>=8192?8192:4096;
 for(const size of new Set([preferred,4096])){
  try{
   const image=new Image();image.src='atlas/globe-'+size+'.webp';await image.decode();
   detailedImage=image;
   if(gpuGlobe?.ready)gpuGlobe.upload(image);
   globe.dataset.texture=String(size);lastGlobeKey='';refreshGlobe();return;
  }catch(error){console.warn('Globe atlas',size,error)}
 }
}
function paintSurface(g){
 const view=[g.w,g.h,g.r,lon,lat].join('/'),mode=qualityModes[quality],gpu=gpuGlobe?.ready;
 if(lastView!==view&&!gpu){movingUntil=performance.now()+120;clearTimeout(settledTimer);settledTimer=setTimeout(refreshGlobe,140)}
 lastView=view;
 const d=gpu?Math.min(devicePixelRatio,mode.gl):Math.min(devicePixelRatio,performance.now()<movingUntil?mode.cpu:Math.min(1.35,mode.cpu+.52));
 const k=view+'/'+d+'/'+!!gpu;if(lastGlobeKey===k)return;lastGlobeKey=k;
 canvas.style.opacity=gpu?'0':'1';
 if(gpu){gpuGlobe.draw(g,d);return}
 if(detailedImage&&tex.dataset.detail!=='1'){
  tw=tex.width=4096;th=tex.height=2048;tg.drawImage(detailedImage,0,0,tw,th);
  pixels=null;shape='';tex.dataset.detail='1';
 }
 if(!pixels)pixels=tg.getImageData(0,0,tw,th).data;
 paintCPU(g,d)
}
let lon=110,lat=30,zoom=1,raf=0,shape='',output,texRow,texX,lights,alpha,geo,anim=0;const pinLayer=$('worldPins');
function refreshGlobe(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;paint()})}
function stateGeo(){let w=globe.clientWidth,h=globe.clientHeight;return {w,h,r:Math.min(w*.489,h*.466)*zoom,cx:w*.495,cy:h*.498}}
function project(la,lo){const p=la*rad,d=(lo-lon)*rad,c=Math.cos(p),a=lat*rad;return {x:geo.cx+geo.r*c*Math.sin(d),y:geo.cy-geo.r*(Math.sin(p)*Math.cos(a)-c*Math.cos(d)*Math.sin(a)),z:Math.sin(p)*Math.sin(a)+c*Math.cos(d)*Math.cos(a)}}
function paintCPU(geo,d){
 const {w,h,r,cx,cy}=geo;
 const W=Math.round(w*d),H=Math.round(h*d);
 const cacheKey=[W,H,r,lat].join('/');if(cacheKey!==shape){
  shape=cacheKey;canvas.width=W;canvas.height=H;output=ctx.createImageData(W,H);texRow=new Int32Array(W*H);texRow.fill(-1);texX=new Uint16Array(W*H);lights=new Float32Array(W*H);alpha=new Uint8Array(W*H);
  const s=Math.sin(lat*rad),c=Math.cos(lat*rad);
  for(let py=0;py<H;py++){const y=(cy-(py+.5)/d)/r;const end=Math.sqrt(Math.max(0,1-y*y));if(!end)continue;
    for(let px=Math.max(0,Math.floor((cx-end*r)*d));px<Math.min(W,Math.ceil((cx+end*r)*d));px++){const x=((px+.5)/d-cx)/r,z2=1-y*y-x*x;if(z2<0)continue;const z=Math.sqrt(z2),a=py*W+px;const phi=Math.asin(Math.max(-1,Math.min(1,y*c+z*s))),delta=Math.atan2(x,z*c-y*s);texRow[a]=Math.min(th-1,Math.floor((.5-phi/Math.PI)*th))*tw;texX[a]=Math.floor((.5+delta/tau)*tw)%tw;lights[a]=.82+.18*z+.11*y-.07*x+.32*Math.pow(1-z,5);alpha[a]=Math.min(255,z2*r*d*145)}
  }
 }
 const delta=Math.round(lon/360*tw)+tw,p=output.data;for(let i=0;i<texRow.length;i++){if(texRow[i]<0)continue;const pos=(texRow[i]+(texX[i]+delta)%tw)*4,k=i*4,q=lights[i];p[k]=pixels[pos]*q;p[k+1]=pixels[pos+1]*q;p[k+2]=pixels[pos+2]*q;p[k+3]=alpha[i]}
 ctx.putImageData(output,0,0);ctx.setTransform(d,0,0,d,0,0);ctx.beginPath();ctx.arc(cx,cy,r,0,tau);ctx.strokeStyle='rgba(125,178,186,.42)';ctx.lineWidth=.9;ctx.stroke();ctx.setTransform(1,0,0,1,0,0);
}
let firstPaint=true,firstDetail=true;
function paint(){if(globe.hidden)return;
 geo=stateGeo();const {w,h,cx}=geo;if(!w||!h)return;paintSurface(geo);
 paintLabels();
 for(const el of pinLayer.querySelectorAll('.spherePin')){const point=project(+el.dataset.lat,+el.dataset.lon);el.hidden=point.z<(el.classList.contains('spherePin')?.08:.24)||point.x<9||point.y<9||point.x>w-9||point.y>h-9;el.style.left=Math.round(point.x*devicePixelRatio)/devicePixelRatio+'px';el.style.top=Math.round(point.y*devicePixelRatio)/devicePixelRatio+'px'}
 const tip=$('sphereCall');if(tip&&focused?.location){const a=project(...focused.location);tip.hidden=a.z<.15||a.x<4||a.y<4||a.x>w-4||a.y>h-4;const twid=tip.offsetWidth||165,hi=tip.offsetHeight||65;tip.style.left=Math.max(8,Math.min(w-twid-8,a.x>cx?a.x-twid-18:a.x+18))+'px';tip.style.top=Math.max(8,Math.min(h-hi-8,a.y-hi-13))+'px'}
 $('coords').textContent=Math.abs(lat).toFixed(1)+'° '+(lat<0?'S':'N')+'　'+Math.abs(lon).toFixed(1)+'° '+(lon<0?'W':'E');
 atlasLayer.position();
 if(firstPaint){performance.mark('globe-first-frame');firstPaint=false}
 if(firstDetail&&detailedImage){performance.mark('globe-detail-frame');firstDetail=false}
}
const labelCanvas=document.createElement('canvas'),labels=labelCanvas.getContext('2d');
$('mapText').append(labelCanvas);
let labelKey='',countryLocale='',countryLabels=[],placesByRank=[],placeSource;
const labelWidths=new Map();
const oceanNames=[[9,160,'太平洋','Pacific Ocean'],[-23,78,'印度洋','Indian Ocean'],[0,-33,'大西洋','Atlantic Ocean']];
function paintLabels(){
 const {w,h,r}=geo,d=Math.min(devicePixelRatio,2);
 const key=[w,h,d,r,lat,lon,lang,cityData.length].join('/');
 if(key===labelKey)return;labelKey=key;
 const width=Math.round(w*d),height=Math.round(h*d);
 if(labelCanvas.width!==width||labelCanvas.height!==height){
  labelCanvas.width=width;labelCanvas.height=height;
  labelCanvas.style.width=w+'px';labelCanvas.style.height=h+'px';
 }
 // Erase all glyphs in backing pixels before applying this frame's projection.
 labels.setTransform(1,0,0,1,0,0);
 labels.clearRect(0,0,width,height);
 labels.setTransform(d,0,0,d,0,0);
 labels.lineJoin='round';labels.lineWidth=1.6;labels.textBaseline='middle';
 const occupied=new Set();
 function label(la,lo,name,city=false){
  const p=project(la,lo);
  if(p.z<.23||p.x<8||p.x>w-8||p.y<12||p.y>h-12)return;
  const x=Math.round((p.x+(city?5:0))*d)/d,y=Math.round(p.y*d)/d,widthKey=(city?'c':'r')+name;
  let width=labelWidths.get(widthKey);
  if(width===undefined){width=labels.measureText(name).width;labelWidths.set(widthKey,width)}
  const left=x-(city?0:width/2),right=left+width;
  if(left<4||right>w-4)return;
  const cells=[];
  for(let i=Math.floor((left-3)/20);i<=Math.floor((right+3)/20);i++)
   for(let j=Math.floor((p.y-7)/14);j<=Math.floor((p.y+7)/14);j++){
    const k=i+','+j;if(occupied.has(k))return;cells.push(k);
   }
  cells.forEach(k=>occupied.add(k));labels.textAlign=city?'left':'center';
  labels.strokeStyle='#13212bdd';labels.strokeText(name,x,y);labels.fillText(name,x,y);
  if(city){labels.beginPath();labels.arc(p.x,p.y,1.55,0,tau);labels.fill()}
 }
 labels.font='600 12px "Segoe UI","Microsoft YaHei UI",sans-serif';labels.fillStyle='#d4e0df';
 if(countryLocale!==lang){
  countryLocale=lang;labelWidths.clear();
  countryLabels=features.map(f=>({...f.properties,label:countryName(f)}));
 }
 if(zoom>=1.35)for(const [code,a] of Object.entries(areas))label(a.lat,a.lon,viewpointName(code));
 for(const p of countryLabels)if(p.rank<=(zoom<1.35?3:6))label(p.lat,p.lon,p.label);
 labels.fillStyle='#859fae';
 for(const [la,lo,zh,en] of oceanNames)label(la,lo,local(zh,en));
 labels.font='11px "Segoe UI","Microsoft YaHei UI",sans-serif';labels.fillStyle='#a6bdc6';
 const level=Math.log2(tau*r/256);
 let count=0;
 if(placeSource!==cityData){placeSource=cityData;placesByRank=cityData.slice().sort((a,b)=>a[0]-b[0]||b[6]-a[6])}
 if(zoom>=1.15)for(const [min,la,lo,en,zh,hant,,names] of placesByRank){
  if(min>level+.15)break;
  const prev=occupied.size;
  label(la,lo,names?.[lang]||(lang==='zh-Hans'?zh||en:lang==='zh-Hant'?hant||zh||en:en),true);
  if(prev!==occupied.size)count++;
 }
 labelCanvas.dataset.cities=String(count);
}
function focusAt(la,lo,z=zoom){stopWheel();cancelAnimationFrame(anim);const from=[lat,lon,zoom],dl=((lo-lon+540)%360)-180,start=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:430;function step(t){const f=Math.min(1,(t-start)/duration),v=1-Math.pow(1-f,3);lat=from[0]+(la-from[0])*v;lon=((from[1]+dl*v+540)%360)-180;zoom=from[2]+(z-from[2])*v;refreshGlobe();if(f<1)anim=requestAnimationFrame(step)}anim=requestAnimationFrame(step)}
function home(){focusAt(30,110,1)}
// The scale is a continuous Mercator zoom level on the flat map and log2(radius)
 // on the globe. Each wheel event retargets the same animation.
let gesture=null,zoomFrame=0;
const minSphere=Math.log2(.65),seam=Math.log2(3.15);
function wheelLevels(event){
 const units=event.deltaMode===1?16:event.deltaMode===2?400:1;
 return Math.max(-1.2,Math.min(1.2,-event.deltaY*units/(event.ctrlKey?90:430)));
}
function spherePoint(point){
 const g=stateGeo(),x=(point.x-g.cx)/g.r,y=(g.cy-point.y)/g.r,z2=1-x*x-y*y;
 if(z2<.03)return null;
 const z=Math.sqrt(z2),tilt=lat*rad;
 return [Math.asin(y*Math.cos(tilt)+z*Math.sin(tilt))/rad,
         lon+Math.atan2(x,z*Math.cos(tilt)-y*Math.sin(tilt))/rad];
}
function holdSphere(anchor,point){
 if(!anchor)return;
 const g=stateGeo(),x=(point.x-g.cx)/g.r,y=(g.cy-point.y)/g.r,z2=1-x*x-y*y;
 if(z2<.02)return;
 const z=Math.sqrt(z2),sinTilt=Math.sin(anchor[0]*rad)/Math.hypot(y,z);
 if(Math.abs(sinTilt)>1)return;
 const phase=Math.atan2(y,z),angle=Math.asin(sinTilt);
 const candidates=[angle-phase,Math.PI-angle-phase,-Math.PI-angle-phase];
 const tilt=candidates.reduce((a,b)=>Math.abs(a-lat*rad)<Math.abs(b-lat*rad)?a:b);
 lat=Math.max(-85,Math.min(85,tilt/rad));
 lon=((anchor[1]-Math.atan2(x,z*Math.cos(lat*rad)-y*Math.sin(lat*rad))/rad+540)%360)-180;
}
function flatCenter(anchor,point,level){
 return map.unproject(map.project(anchor,level).subtract(point.subtract(map.getSize().divideBy(2))),level);
}
function stopWheel(){
 cancelAnimationFrame(zoomFrame);zoomFrame=0;
 const ended=gesture;gesture=null;
 if(ended?.flat)map._moveEnd(true);
}
function zoomStep(time){
 zoomFrame=0;
 if(!gesture)return;
 const g=gesture,dt=Math.min(64,Math.max(1,time-g.time));g.time=time;
 const current=g.flat?map.getZoom():Math.log2(zoom);
 const fraction=1-Math.exp(-dt/56);
 const next=reduceMotion.matches||Math.abs(g.target-current)<.001?g.target:current+(g.target-current)*fraction;
 if(g.flat){
  // Use the same continuous camera update as the bundled Leaflet pinch handler.
  const returning=detailMode&&g.target<detailZoom&&next<=detailZoom;
  const level=returning?detailZoom:next;
  map._move(flatCenter(g.anchor,g.point,level),level,{pinch:true,round:false});
  if(returning){
   const c=map.getCenter(),anchor=L.latLng(g.anchor);
   detailMode=false;g.flat=false;map._moveEnd(true);
   lat=c.lat;lon=c.lng;zoom=2**seam;
   g.target=Math.max(minSphere,seam+g.target-detailZoom);
   g.anchor=[anchor.lat,anchor.lng];updateVisibility();holdSphere(g.anchor,g.point);
   drawMap();paint();
  }
 }else{
  zoom=2**Math.min(next,seam);holdSphere(g.anchor,g.point);paint();
  if(next>=seam&&g.target>seam){
   const geoScale=Math.log2(tau*stateGeo().r*Math.cos(lat*rad)/256);
   detailZoom=Math.max(map.getMinZoom(),geoScale);
   detailMode=true;updateVisibility();map.invalidateSize();
   const anchor=g.anchor||[lat,lon],point=g.anchor?g.point:map.getSize().divideBy(2);
   const center=flatCenter(anchor,point,detailZoom);
   map.setView(center,detailZoom,{animate:false});
   g.flat=true;g.point=point;g.anchor=anchor;g.target=detailZoom+g.target-seam;
   map._moveStart(true,false);drawMap();
  }
 }
 if(gesture&&Math.abs(g.target-(g.flat?map.getZoom():Math.log2(zoom)))>.00001)zoomFrame=requestAnimationFrame(zoomStep);
 else {stopWheel();const c=g.flat?map.getCenter():{lat,lng:lon};followMapCenter(c.lat,c.lng,!g.flat&&zoom<1);}
}
function queueZoom(delta,point,flat){
 if(!delta)return;
 cancelAnimationFrame(anim);
 const scale=flat?map.getZoom():Math.log2(zoom);
 if(!gesture||gesture.flat!==flat){
  stopWheel();if(flat){map.stop();map._moveStart(true,false)}
  gesture={flat,target:scale,time:performance.now()};
 }
 gesture.point=point;
 gesture.anchor=flat?map.containerPointToLatLng(point):spherePoint(point);
 gesture.target=Math.max(flat?map.getMinZoom():minSphere,Math.min(flat?map.getMaxZoom():seam+2,gesture.target+delta));
 if(!zoomFrame)zoomFrame=requestAnimationFrame(zoomStep);
}
function zoomBy(f){const g=stateGeo();queueZoom(Math.log2(f),L.point(g.cx,g.cy),false)}
const mapDiv=map.getContainer();
map.scrollWheelZoom.disable();
mapDiv.addEventListener('wheel',event=>{
 if(visible)return;event.preventDefault();queueZoom(wheelLevels(event),map.mouseEventToContainerPoint(event),true);
},{passive:false});
mapDiv.addEventListener('pointerdown',stopWheel,{capture:true});
const tools=$('globeTools').children;tools[0].onclick=()=>zoomBy(1.18);tools[1].onclick=()=>zoomBy(1/1.18);tools[2].onclick=home;
let drag=null;canvas.onpointerdown=e=>{stopWheel();cancelAnimationFrame(anim);drag=[e.clientX,e.clientY,lon,lat];canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;const scale=64/stateGeo().r;lon=((drag[2]-(e.clientX-drag[0])*scale+540)%360)-180;lat=Math.max(-85,Math.min(85,drag[3]+(e.clientY-drag[1])*scale));refreshGlobe()};canvas.onpointerup=e=>{if(drag&&Math.hypot(e.clientX-drag[0],e.clientY-drag[1])>4)followMapCenter(lat,lon);drag=null};canvas.onpointercancel=()=>drag=null;
globe.addEventListener('wheel',e=>{e.preventDefault();const rect=globe.getBoundingClientRect();queueZoom(wheelLevels(e),L.point(e.clientX-rect.left,e.clientY-rect.top),false)},{passive:false});canvas.onkeydown=e=>{const moves={ArrowLeft:[0,-12],ArrowRight:[0,12],ArrowUp:[9,0],ArrowDown:[-9,0]};if(moves[e.key]){e.preventDefault();const [dy,dx]=moves[e.key];focusAt(Math.max(-85,Math.min(85,lat+dy)),lon+dx)}if(e.key==='+'||e.key==='=')zoomBy(1.18);if(e.key==='-')zoomBy(1/1.18)};

let requested=readLocal('desk:mapProjection','globe')!=='flat',visible=false,focused=null,markerKey='',groups=[];
let detailMode=false,detailZoom=0;
map.on('zoomend',()=>{
 if(detailMode&&layer!=='sat'&&map.getZoom()<detailZoom-.25){
  const c=map.getCenter();lat=c.lat;lon=c.lng;
  const radius=Math.min(map.getSize().x*.489,map.getSize().y*.466);
  zoom=Math.max(.65,Math.min(3.15,256*2**map.getZoom()/(tau*radius*Math.max(.08,Math.cos(lat*rad)))));
  detailMode=false;updateVisibility();refreshGlobe();drawMap();
 }
});
const toggle=button('',()=>switchProjection(!visible));toggle.id='projectionToggle';
$('resetMap').after(toggle);
function switchProjection(useGlobe){
 stopWheel();detailMode=false;requested=useGlobe;try{localStorage.setItem('desk:mapProjection',JSON.stringify(useGlobe?'globe':'flat'))}catch{}
 const center=[lat,lon];updateVisibility();
 if(!visible){map.invalidateSize();if(focused?.location)openLocation(focused);else map.setView(center,Math.max(2,Math.round(zoom+1)),{animate:false})}
 else if(map.getZoom()>3){const c=map.getCenter();focusAt(c.lat,c.lng,1.1)}
 drawMap();
}
let lastLanguage='';
function updateVisibility(){
 if(lastLanguage!==lang){lastLanguage=lang;labelKey='';refreshGlobe();if($('netToggle'))$('netToggle').textContent=$('netToggle').getAttribute('aria-pressed')==='true'?local('网络连线　开','Network arcs · on'):local('网络连线　关','Network arcs · off')}
 const on=!cityScene?.active&&requested&&!detailMode&&!['sat','terrain','military'].includes(layer);
 if(!on&&!relief)setupCartography();
 if(visible!==on&&gesture&&layer==='sat')stopWheel();globe.hidden=!on;visible=on;$('mapWrap').classList.toggle('using-globe',on);
 toggle.hidden=cityScene?.active||['sat','terrain','military'].includes(layer);const zh=lang.startsWith('zh');toggle.textContent=on?(zh?'切换平面地图':'Flat map'):(zh?'切换球面地图':'Globe');
 if($('netToggle'))$('netToggle').hidden=!on;
 quality=settings.mapQuality==='smooth'?'smooth':'auto';
 return on;
}
function regionFocus(){
 if(!visible)return;if(region==='001'){home();return}
 if(regions[region]){const [a,b]=regions[region][0];focusAt(a,b,1.08);return}
 const f=featuresByCode.get(region);if(f){const c=L.latLngBounds(leafletBounds(f)).getCenter();focusAt(c.lat,c.lng,1.35)}
}
function pinRecords(records){
 const mapped=records.filter(e=>e.location&&(e.id===selected?.id||layer!=='all'||mode==='saved'||(!['buoy','fx','ferry','fr24','crypto','adsb','baltic','ships'].includes(e.feed)&&(e.feed!=='metar'||e.severity>=3))));
 const key=JSON.stringify([layer,lang,selected?.id,focused?.id,mapped.map(e=>[e.id,e.location,e.title,e.severity])]);
 if(key===markerKey)return;markerKey=key;const cells=new Map();
 for(const e of mapped){const [a,b]=e.location;const k=Math.floor(a/6)+','+Math.floor(b/7);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(e)}
 groups=[...cells.values()];pinLayer.replaceChildren();
 for(const group of groups){
  const e=group.find(e=>e.id===selected?.id)||group.reduce((a,b)=>a.severity>=b.severity?a:b);
  const p=button(group.length>1?String(group.length):glyph[e.layer],()=>{
   if(group.length===1){selectEvent(e,true);return}
   openSheet(t('events'));const body=$('dialogBody');for(const item of group)body.append(translated(button('',()=>{$('dialog').close();selectEvent(item,true)},'sourcebutton'),item.title,item));observeTranslations();
  },'spherePin'+(selected?.id===e.id?' chosen':''));
  p.dataset.lat=e.location[0];p.dataset.lon=e.location[1];p.title=e.title;p.setAttribute('aria-label',e.title);p.style.setProperty('--signal',colors[e.severity]);pinLayer.append(p);
 }
 if(focused&&focused.id===selected?.id&&mapped.some(e=>e.id===focused.id)){
  const tip=button('',()=>showStory(focused));tip.id='sphereCall';
  tip.append(make('small',t(focused.layer)+' · '+t(levelNames[focused.severity])),translated(make('strong'),focused.title,focused),make('span',focused.source+' · '+eventTime(focused)));
  pinLayer.append(tip);observeTranslations();
 }
 refreshGlobe();
}
function locate(e){focused=e;focusAt(e.location[0],e.location[1],1.12);pinRecords(allRows());refreshGlobe()}
function openSheet(title){const d=$('dialog');d.dataset.page='globe';$('dialogTitle').textContent=title;$('dialogBody').replaceChildren();if(!d.open)d.showModal()}

const atlasCatalog={"probes":{"6307":{"id":6307,"city":"Amsterdam","cc":"NL","lat":52.3702157,"lon":4.8951679},"6313":{"id":6313,"city":"Frankfurt am Main","cc":"DE","lat":50.1281415,"lon":8.6011068},"6331":{"id":6331,"city":"Berlin","cc":"DE","lat":52.523444,"lon":13.3224154},"6342":{"id":6342,"city":"Apeldoorn","cc":"NL","lat":52.24703,"lon":6.001603},"6349":{"id":6349,"city":"Porto Alegre","cc":"BR","lat":-30.0688963,"lon":-51.1206198},"6370":{"id":6370,"city":"Tokyo","cc":"JP","lat":35.6896342,"lon":139.69281953},"6373":{"id":6373,"city":"Kansas City","cc":"US","lat":39.1008094,"lon":-94.5811036},"6379":{"id":6379,"city":"Durham","cc":"US","lat":35.9347588,"lon":-78.8794301},"6380":{"id":6380,"city":"Accra","cc":"GH","lat":5.6037168,"lon":-0.1869644},"6382":{"id":6382,"city":"Slough","cc":"GB","lat":51.5105384,"lon":-0.5950406},"6392":{"id":6392,"city":"Dubai","cc":"AE","lat":25.0282605,"lon":55.1856957},"6398":{"id":6398,"city":"Monterrey","cc":"MX","lat":25.76602539,"lon":-100.1931493},"6410":{"id":6410,"city":"Sao Paulo","cc":"BR","lat":-23.6451486,"lon":-46.730636},"6420":{"id":6420,"city":"Mexico City","cc":"MX","lat":19.40016385,"lon":-99.2743234},"6425":{"id":6425,"city":"Tokyo","cc":"JP","lat":35.7312536,"lon":139.7194156},"6427":{"id":6427,"city":"Sydney","cc":"AU","lat":-33.9117762,"lon":151.1929422},"6446":{"id":6446,"city":"London","cc":"GB","lat":51.5232113,"lon":-0.1011476},"6456":{"id":6456,"city":"Toronto","cc":"CA","lat":43.6508826,"lon":-79.3617799},"6477":{"id":6477,"city":"Singapore","cc":"SG","lat":1.2952528,"lon":103.7900091},"6485":{"id":6485,"city":"Santiago de Chile","cc":"CL","lat":-33.4183565,"lon":-70.5993464},"6487":{"id":6487,"city":"Singapore","cc":"SG","lat":1.2951763,"lon":103.7880297},"6493":{"id":6493,"city":"Vancouver","cc":"CA","lat":49.28102296,"lon":-123.11780971},"6503":{"id":6503,"city":"Sydney","cc":"AU","lat":-33.9117762,"lon":151.1929422},"6521":{"id":6521,"city":"Bandung","cc":"ID","lat":-6.866414,"lon":107.5927806},"6553":{"id":6553,"city":"Santiago","cc":"CL","lat":-34.1602376,"lon":-70.7593244},"6569":{"id":6569,"city":"Johannesburg","cc":"ZA","lat":-26.137891,"lon":28.1976125},"6633":{"id":6633,"city":"Tostado","cc":"AR","lat":-29.2318102,"lon":-61.7703431},"6639":{"id":6639,"city":"Hong Kong","cc":"HK","lat":22.45343,"lon":114.187189},"6641":{"id":6641,"city":"Seoul","cc":"KR","lat":37.4820962,"lon":126.8797332},"6681":{"id":6681,"city":"Jakarta","cc":"ID","lat":-6.2094736,"lon":106.8207808},"6730":{"id":6730,"city":"Almaty","cc":"KZ","lat":43.2082184,"lon":76.8996132},"6745":{"id":6745,"city":"Nur-Sultan","cc":"KZ","lat":51.1674269,"lon":71.4186237},"6779":{"id":6779,"city":"Johannesburg","cc":"ZA","lat":-26.1365724,"lon":28.2021014},"6792":{"id":6792,"city":"Seoul","cc":"KR","lat":37.5776394,"lon":126.8886338},"6798":{"id":6798,"city":"Dubai","cc":"AE","lat":25.6251285,"lon":55.8088856},"6803":{"id":6803,"city":"Auckland","cc":"NZ","lat":-36.8493458,"lon":174.7654121},"6818":{"id":6818,"city":"Taipei","cc":"TW","lat":25.073509,"lon":121.577712},"6868":{"id":6868,"city":"Oslo","cc":"NO","lat":59.9158102,"lon":10.7414967},"6882":{"id":6882,"city":"Nairobi","cc":"KE","lat":-1.3281445,"lon":36.8666473},"6904":{"id":6904,"city":"Auckland","cc":"NZ","lat":-36.8493077,"lon":174.7654655},"6905":{"id":6905,"city":"Bangkok","cc":"TH","lat":13.7267124,"lon":100.5146131},"6907":{"id":6907,"city":"Taipei","cc":"TW","lat":25.0329694,"lon":121.5654177},"6953":{"id":6953,"city":"Delhi","cc":"IN","lat":28.5428603,"lon":77.2401945},"6954":{"id":6954,"city":"Mumbai","cc":"IN","lat":19.0696137,"lon":72.871348},"7099":{"id":7099,"city":"Bahía Blanca","cc":"AR","lat":-38.7183177,"lon":-62.2663478},"7171":{"id":7171,"city":"Førde","cc":"NO","lat":61.4535792,"lon":5.8496685},"7292":{"id":7292,"city":"Hong Kong","cc":"HK","lat":22.3193039,"lon":114.1693611},"7369":{"id":7369,"city":"Nairobi","cc":"KE","lat":-1.3106691,"lon":36.8250274},"7799":{"id":7799,"city":"Accra","cc":"GH","lat":5.5742522,"lon":-0.1944746},"7854":{"id":7854,"city":"Bangkok","cc":"TH","lat":13.6636378,"lon":100.6517408}},"targets":[{"id":6918,"city":"Singapore","cc":"SG","lat":1.3240179,"lon":103.8915812,"msm":28394566,"ip":"139.162.3.33"},{"id":6929,"city":"Melbourne","cc":"AU","lat":-37.8215067,"lon":145.3145861,"msm":29086437,"ip":"27.131.108.126"},{"id":6313,"city":"Frankfurt am Main","cc":"DE","lat":50.1281415,"lon":8.6011068,"msm":10103385,"ip":"185.138.143.34"},{"id":6349,"city":"Porto Alegre","cc":"BR","lat":-30.0688963,"lon":-51.1206198,"msm":11688943,"ip":"200.132.1.32"},{"id":6379,"city":"Durham","cc":"US","lat":35.9347588,"lon":-78.8794301,"msm":15393461,"ip":"104.225.3.74"},{"id":6935,"city":"Johannesburg","cc":"ZA","lat":-26.138037,"lon":28.1975446,"msm":29099610,"ip":"102.130.49.144"},{"id":7433,"city":"Tsuchiura","cc":"JP","lat":36.0709709,"lon":140.1997431,"msm":84216561,"ip":"43.228.174.199"}]};
const atlasArchive=[];
const atlasLayer=(()=>{
 const svgNS='http://www.w3.org/2000/svg',make=name=>document.createElementNS(svgNS,name);
 const field=make('svg');field.id='atlasField';field.setAttribute('aria-label','RIPE Atlas 网络测量线路');globe.insertBefore(field,$('mapText'));
 const bar=document.createElement('button');bar.id='netToggle';bar.setAttribute('aria-pressed','true');bar.textContent='网络连线　开';document.querySelector('.filterline').append(bar);

 const tile=document.createElement('button');tile.id='atlasStatus';tile.title=local('查看测量记录','View measurement records');globe.append(tile);
 const byProbe=atlasCatalog.probes,targets=atlasCatalog.targets;
 const lookup=new Map(targets.map(t=>[t.msm,t]));
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const text=(el,cls,value)=>{const n=document.createElement('span');n.className=cls;n.textContent=value;el.append(n);return n};
 const time=(ts,full=false)=>localStamp(ts*1000,full?'full':'clock');
 const now=()=>Date.now()/1000,ageLimit=15*60;
 const normalized=(arr,t)=>arr.filter(r=>r&&r.type==='ping'&&r.af===4&&r.msm_id===t.msm&&r.dst_addr===t.ip&&r.rcvd>0&&Number.isFinite(r.avg)&&r.avg>=0&&byProbe[r.prb_id]&&r.prb_id!==t.id&&Number.isFinite(r.timestamp)&&r.timestamp<=now()+30).map(r=>({from:r.prb_id,to:t.id,msm:t.msm,rtt:r.avg,ts:r.timestamp}));
 const key=r=>r.msm+'/'+r.from;
 const cacheName='globe.ripe.measurements.v1';
 let records=new Map(),enabled=true,connected=new Set(),busy=false,links=[],lastMode='',selected='',tip=null;
 function valid(r){return r&&byProbe[r.from]&&lookup.get(r.msm)?.id===r.to&&Number.isFinite(r.rtt)&&r.rtt>=0&&Number.isFinite(r.ts)&&r.ts<=now()+30}
 function merge(list){for(const r of list){if(!valid(r))continue;const k=key(r);if(!records.has(k)||records.get(k).ts<=r.ts)records.set(k,r)}}
 merge(atlasArchive);try{const saved=JSON.parse(localStorage.getItem(cacheName));if(Array.isArray(saved))merge(saved)}catch{}
 const live=r=>connected.has(r.msm)&&now()-r.ts<=ageLimit&&navigator.onLine;
 function sample(){
   const chosen=[];for(const t of targets){
    const candidates=[...records.values()].filter(r=>r.msm===t.msm&&byProbe[r.from].cc!==t.cc).sort((a,b)=>Number(live(b))-Number(live(a))||Math.floor(b.ts/900)-Math.floor(a.ts/900)||((a.from*73+t.id*47)%953)-((b.from*73+t.id*47)%953));
    const limit=21,cities=new Set(),countries=new Set();
    // Prefer distinct countries, then fill with other measured city pairs.
    for(const fresh of [true,false]){
     for(const newCountry of [true,false]){
      for(const r of candidates){
       const p=byProbe[r.from],city=p.cc+'/'+p.lat.toFixed(1)+'/'+p.lon.toFixed(1);
       if(live(r)!==fresh||cities.has(city)||(newCountry&&countries.has(p.cc)))continue;
       chosen.push(r);cities.add(city);countries.add(p.cc);
       if(cities.size===limit)break;
      }
      if(cities.size===limit)break;
     }
     if(cities.size===limit)break;
    }
   }return chosen
 }
 function vector(lat,lon){const a=lat*rad,b=lon*rad;return [Math.cos(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.sin(a)]}
 function geometry(r){const a=byProbe[r.from],b=lookup.get(r.msm),v=vector(a.lat,a.lon),u=vector(b.lat,b.lon),angle=Math.acos(Math.max(-1,Math.min(1,v.reduce((s,n,i)=>s+n*u[i],0)))),sin=Math.sin(angle);
  if(angle<.01||Math.abs(sin)<.00001)return [];
  const steps=Math.max(12,Math.ceil(48*angle/Math.PI));
  return Array.from({length:steps+1},(_,i)=>{
   const f=i/steps,p=Math.sin((1-f)*angle)/sin,q=Math.sin(f*angle)/sin;
   return [v[0]*p+u[0]*q,v[1]*p+u[1]*q,v[2]*p+u[2]*q,1+.075*Math.sin(f*Math.PI)*Math.min(1,angle)];
  });
 }
 function lineDetails(r){
  const a=byProbe[r.from],b=lookup.get(r.msm);selected=key(r);field.querySelectorAll('.netRoute').forEach(g=>g.classList.toggle('selected',g.dataset.key===selected));
  openSheet(local('网络测量详情','Network measurement'));const content=$('dialogBody'),heading=document.createElement('h3');heading.textContent=a.city+' → '+b.city;content.append(heading);
  const meta=document.createElement('dl');meta.className='netFacts';for(const [label,value] of [[local('测量来源','Source'),'RIPE Atlas · IPv4 Ping'],[local('观测状态','Status'),live(r)?local('近期实测','Recent measurements'):local('历史记录','Historical')],[local('探针 → 锚点','Probe → anchor'),a.cc+' #'+a.id+' → '+b.cc+' #'+b.id],[local('平均往返延迟','Average round-trip time'),r.rtt.toFixed(1)+' ms'],[local('测量时间','Measured at'),time(r.ts,true)]]){const k=document.createElement('dt'),v=document.createElement('dd');k.textContent=label;v.textContent=value;meta.append(k,v)}content.append(meta);
  const p=document.createElement('p');p.textContent=local('弧线连接两端的公开位置，光点沿探针发往锚点的方向移动。实际路由经过的地点和数据流量未知。','Arcs connect published endpoint locations. Dots indicate measurement direction. The actual packet route and traffic volume are unknown.');content.append(p);
  const source=document.createElement('a');source.href='https://atlas.ripe.net/measurements/'+b.msm+'/';source.target='_blank';source.rel='noopener';source.textContent=local('查看 RIPE Atlas 原始测量 ↗','View RIPE Atlas measurement ↗');content.append(source)
 }
 function list(){openSheet(local('全球网络测量','Global network measurements'));const page=$('dialogBody'),desc=document.createElement('p');desc.textContent=local('每 30 秒读取最近的公开观测。地图从各锚点分地区抽样展示，15 分钟内且已核实在线的测量会显示移动光点。','Recent observations are checked every 30 seconds. Dots move on sampled connections with verified measurements from the past 15 minutes.');page.append(desc);
  const all=[...records.values()].sort((a,b)=>b.ts-a.ts);for(const r of all){const b=document.createElement('button');b.className='networkRow';text(b,'',byProbe[r.from].city+' → '+lookup.get(r.msm).city);text(b,'mono',r.rtt.toFixed(0)+' ms　'+time(r.ts));b.onclick=()=>lineDetails(r);page.append(b)}}
 tile.onclick=list;
 function status(){const visible=links.map(l=>l.r),fresh=visible.filter(live),ts=Math.max(0,...visible.map(r=>r.ts));const mode=!enabled?local('图层已关闭','Layer off'):!navigator.onLine?local('离线快照','Offline snapshot'):busy&&!connected.size?local('连接数据源中','Connecting'):fresh.length?local('近期实测','Recent measurements'):local('历史快照','Past observations');
  tile.replaceChildren();text(tile,'state '+(fresh.length&&enabled?'good':''),'RIPE ATLAS');text(tile,'mode',mode+'　'+(enabled?visible.length:0)+local(' 条连线',' arcs'));if(ts)text(tile,'stamp',localStamp(ts*1000,'list'));
  updateClock();
 }
 function rebuild(){links=[];field.replaceChildren();const cutoff=sample();
  for(const r of cutoff){const samples=geometry(r);if(!samples.length)continue;const g=make('g'),path=make('path'),hit=make('path'),dot=make('circle');g.classList.add('netRoute');g.dataset.key=key(r);g.classList.toggle('recent',live(r));g.classList.toggle('selected',key(r)===selected);path.classList.add('route');hit.classList.add('hit');dot.classList.add('traveler');dot.setAttribute('r','1.85');g.append(path,hit,dot);field.append(g);hit.onclick=()=>lineDetails(r);
  const title=make('title');title.textContent=byProbe[r.from].city+' → '+lookup.get(r.msm).city+' · '+r.rtt.toFixed(1)+' ms';hit.append(title);links.push({r,path,hit,dot,samples,projected:[]})}position(true);status();lastMode=links.map(l=>+live(l.r)).join('')
 }
 let projection='';
 function position(force=false){
  if(globe.hidden||!geo||!enabled)return;
  const camera=[geo.w,geo.h,geo.r,lon,lat].join('/');
  if(!force&&camera===projection)return;
  projection=camera;field.setAttribute('viewBox','0 0 '+geo.w+' '+geo.h);
  const cl=Math.cos(lon*rad),sl=Math.sin(lon*rad),ca=Math.cos(lat*rad),sa=Math.sin(lat*rad);
  for(const line of links){
   let drawing=false,d='';
   for(let i=0;i<line.samples.length;i++){
    const [x,y,z,u]=line.samples[i],forward=x*cl+y*sl;
    const pt=line.projected[i]||(line.projected[i]={});
    pt.x=geo.cx+geo.r*(y*cl-x*sl)*u;
    pt.y=geo.cy-geo.r*(z*ca-forward*sa)*u;
    pt.z=z*sa+forward*ca;
    if(pt.z>=.012){d+=(drawing?'L':'M')+pt.x.toFixed(1)+' '+pt.y.toFixed(1);drawing=true}else drawing=false;
   }
   line.path.setAttribute('d',d);line.hit.setAttribute('d',d);
  }
 }
 let timer;function frame(){if(globe.hidden)return;if(document.hidden||!enabled||reduce.matches){for(const l of links)l.dot.style.display='none';return}
 const t=performance.now()/1000;for(const l of links){const pts=l.projected;if(!pts.length)continue;const f=((t/(3.5+l.r.from%6*.48)+l.r.from*.063+l.r.msm*.023)%1)*(pts.length-1),i=Math.floor(f),a=pts[i],b=pts[i+1],v=f-i;if(!a||!b||a.z<.012||b.z<.012||!live(l.r)){l.dot.style.display='none';continue}l.dot.style.display='';l.dot.setAttribute('cx',a.x+(b.x-a.x)*v);l.dot.setAttribute('cy',a.y+(b.y-a.y)*v)}
 }
 function motion(){clearInterval(timer);frame();if(enabled&&!document.hidden&&!reduce.matches)timer=setInterval(frame,42)}
 bar.onclick=()=>{enabled=!enabled;field.style.display=enabled?'':'none';bar.setAttribute('aria-pressed',String(enabled));bar.textContent='网络连线　'+(enabled?'开':'关');position(true);motion();status()};
 async function poll(){if(busy||!navigator.onLine){status();return}busy=true;status();const ids=Object.keys(byProbe).join(',');
  await Promise.all(targets.map(async t=>{try{const url='https://atlas.ripe.net/api/v2/measurements/'+t.msm+'/latest/?versions=1&probe_ids='+ids;const res=await fetch(url,{signal:AbortSignal.timeout(15000),credentials:'omit'});if(!res.ok)throw Error('API '+res.status);const data=await res.json();const rows=Array.isArray(data)?data:Object.values(data).flat();const batch=normalized(rows,t);
    for(const [k,r] of records){if(r.msm===t.msm)records.delete(k)}merge(batch);connected.add(t.msm)
   }catch{connected.delete(t.msm)}}));busy=false;try{localStorage.setItem(cacheName,JSON.stringify([...records.values()]))}catch{}rebuild();motion()}
 window.addEventListener('offline',()=>{connected.clear();rebuild();motion()});window.addEventListener('online',request);document.addEventListener('visibilitychange',()=>{motion();if(!document.hidden){status();if(!lastFetch||now()-lastFetch>=FEED_INTERVAL_MS/1000)request()}});
 reduce.addEventListener('change',motion);let lastFetch=0,networkRequest;
 function request(){
  if(networkRequest)return networkRequest;
  if(!navigator.onLine)return;
  lastFetch=now();networkRequest=poll().finally(()=>{networkRequest=null});return networkRequest;
 }
 rebuild();motion();request();setInterval(request,FEED_INTERVAL_MS);setInterval(()=>{if(document.hidden)return;if(lastMode!==links.map(l=>+live(l.r)).join(''))rebuild();else status()},1000);
 return {position,request,get count(){return links.length},get fresh(){return links.filter(l=>live(l.r)).length},get busy(){return busy},get records(){return records.size}}
})();

 loadDetailedSurface();new ResizeObserver(refreshGlobe).observe(globe);updateVisibility();refreshGlobe();return {camera:()=>({center:[lon,lat],zoom:Math.max(0,Math.log2(tau*stateGeo().r*Math.cos(lat*rad)/512))}),spherePoint,restoreCamera(center,level){stopWheel();cancelAnimationFrame(anim);lat=center.lat;lon=center.lng;const base=Math.min(globe.clientWidth*.489,globe.clientHeight*.466)||Math.min(map.getSize().x*.489,map.getSize().y*.466);const scale=512*2**level/(tau*base*Math.max(.08,Math.cos(lat*rad)));detailMode=requested&&scale>3.15;detailZoom=level+1+Math.log2(3.15/scale);zoom=Math.max(.65,Math.min(3.15,scale));updateVisibility();map.setView([lat,lon],level+1,{animate:false});refreshGlobe()},refreshNetwork:atlasLayer.request,updateVisibility,regionFocus,pinRecords,locate,redraw:refreshGlobe,get visible(){return visible},get renderer(){return gpuGlobe?.ready?'WebGL':'Canvas'},get fresh(){return atlasLayer.fresh}};
}
