'use strict';
// Terrarium encodes orthometric elevations in the RGB channels, in metres.
const jobs=new Map();
const ramp=[[-6000,19,44,63],[-1,47,86,103],[0,70,98,91],[400,79,104,81],[1400,128,122,88],[3000,159,142,117],[5500,204,205,195],[8000,235,238,234]];
function tint(h){
 let i=1;while(i<ramp.length-1&&h>ramp[i][0])i++;
 const a=ramp[i-1],b=ramp[i],f=Math.min(1,Math.max(0,(h-a[0])/(b[0]-a[0])));
 return [1,2,3].map(k=>a[k]+(b[k]-a[k])*f);
}
const palette=Array.from({length:1401},(_,i)=>tint(i*10-6000));
async function draw({id,z,x,y},signal){
 const res=await fetch('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+z+'/'+x+'/'+y+'.png',{signal});
 if(!res.ok)throw Error('Elevation '+res.status);
 const bmp=await createImageBitmap(await res.blob(),{colorSpaceConversion:'none'});
 const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(bmp,0,0);bmp.close();
 const pixels=ctx.getImageData(0,0,256,256),p=pixels.data,h=new Float32Array(65536);
 for(let i=0;i<h.length;i++){const j=4*i;h[i]=p[j]*256+p[j+1]+p[j+2]/256-32768;}
 const step=z<7?1000:z<9?250:z<11?100:z<13?50:20;
 const metres=156543.03/2**z/Math.cosh(Math.PI*(1-2*(y+.5)/2**z));
 const annotations=[];
 for(let row=0;row<256;row++)for(let col=0;col<256;col++){
  const i=row*256+col,v=h[i],east=h[col<255?i+1:i]-v,south=h[row<255?i+256:i]-v;
  const gradient=Math.hypot(east,south),shade=1+Math.max(-.38,Math.min(.38,(east+south*.55)/metres*.52));
  const level=Math.round(v/step),distance=Math.abs(v-level*step);
  const major=level%5===0,band=gradient*(major?.75:.42);
  const ink=z>=7&&level>0&&band>0?.5*Math.max(0,1-distance/band):0;
  const color=palette[Math.max(0,Math.min(1400,Math.round((v+6000)/10)))];
  for(let c=0;c<3;c++)p[i*4+c]=color[c]*shade*(1-ink);
  if(major&&level>0&&ink>.2&&col>30&&col<222&&row>25&&row<224&&annotations.length<3&&annotations.every(a=>Math.hypot(a[0]-col,a[1]-row)>100))
   annotations.push([col,row,level*step]);
 }
 ctx.putImageData(pixels,0,0);ctx.font='10px sans-serif';ctx.textAlign='center';ctx.lineWidth=2.5;
 for(const [cx,cy,m] of annotations){ctx.strokeStyle='#222e2c';ctx.fillStyle='#f2ebd4';ctx.strokeText(m+' m',cx,cy);ctx.fillText(m+' m',cx,cy);}
 const bytes=await (await canvas.convertToBlob()).arrayBuffer();if(!signal.aborted)postMessage({id,bytes},[bytes]);
}
onmessage=({data})=>{
 if(data.cancel){jobs.get(data.id)?.abort();return;}
 const ctrl=new AbortController();jobs.set(data.id,ctrl);
 draw(data,AbortSignal.any([ctrl.signal,AbortSignal.timeout(18000)])).catch(e=>{if(!ctrl.signal.aborted)postMessage({id:data.id,error:e.message})}).finally(()=>jobs.delete(data.id));
};
