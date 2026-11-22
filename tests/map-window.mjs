import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function checkMap(page, until, root) {
  const evalInApp=page.ev;
  async function select(code) {
    await evalInApp('(()=>{const s=document.getElementById("region");s.value='+JSON.stringify(code)+';s.dispatchEvent(new Event("change"));})()');
    await until(()=>evalInApp('region==='+JSON.stringify(code)));
  }
  assert.equal(await evalInApp('document.querySelectorAll("#region option[value=TWN]").length'),0);
  assert.equal(await evalInApp('document.querySelector("#region option[value=\\\"CN-TW\\\"]").parentElement.label.includes("中国")'),true);
  for(const [code,points] of [['CN-TW',[[25.04,121.565],[22.63,120.30]]],['CN-AKS',[[35.20,80]]],['CN-ZAN',[[27.59,91.86],[27.10,93.62]]]]) {
    await select(code);
    await until(()=>evalInApp('exact.has('+JSON.stringify(code)+')&&exact.has("CHN")&&!!areaOverlay'));
    for(const ll of points) {
      const p=JSON.stringify(ll);
      assert.equal(await evalInApp('matchesRegion({location:'+p+'})&&insideArea("CHN",'+p+')&&!insideArea("IND",'+p+')'),true,code+' containment');
    }
    assert.equal(await evalInApp('map.getBounds().contains('+JSON.stringify(points[0])+')'),true);
  }
  await select('IND');
  await until(()=>evalInApp('exact.has("IND")'));
  assert.ok(await evalInApp('matchesRegion({location:[27.33,88.61]})&&!matchesRegion({location:[27.59,91.86]})'));
  assert.ok(await evalInApp('regionCode("TWN")==="CN-TW"&&upgradeRecord({iso:"TWN"}).iso==="CHN"'));
  await select('CHN');
  assert.ok(await evalInApp('matchesRegion({location:[35.2,80]})&&matchesRegion({location:[25.04,121.565]})&&matchesRegion({location:[27.59,91.86]})'));
  await evalInApp('map.setView([23.72,121.02],7,{animate:false});true');
  await until(()=>evalInApp('!map._animatingZoom && exact.has("CHN") && !!terrainInsets.get("CN-TW")?.getElement()?.naturalWidth'));
  const xy=await evalInApp('(()=>{const p=map.latLngToContainerPoint([23.72,121.02]),r=map.getContainer().getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y};})()');
  for(const clickCount of [1,2])for(const type of ['mousePressed','mouseReleased'])await page.call('Input.dispatchMouseEvent',{type,button:'left',clickCount,...xy});
  await until(()=>evalInApp('region==="CN-TW"'));
  await select('CN-ZAN');
  await until(()=>evalInApp('shownWater.size>0&&cityData.length>7000&&document.querySelector(".city-label")&&document.querySelector(".leaflet-tile-loaded[src*=relief]")'));
  await until(()=>evalInApp('!map._animatingZoom && !map._panAnim?._inProgress && !relief.isLoading() && Array.from(shownWater.keys()).some(f=>f.properties.admin) && exact.has("CN-ZAN") && terrainInsets.get("CN-ZAN")?.getElement()?.naturalWidth>1000'));
  await new Promise(resolve=>setTimeout(resolve,650));
  const clip=await evalInApp('(()=>{const r=document.querySelector("#mapPane").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()');
  await page.call('Page.captureScreenshot',{format:'png',clip}).then(r=>fs.writeFileSync(path.join(root,'regional-map.png'),Buffer.from(r.data,'base64')));
  await select('001');
}
