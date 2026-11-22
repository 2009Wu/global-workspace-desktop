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
  for(const [code,points] of [['CN-TW',[[25.04,121.565],[22.63,120.30]]],['CN-DIA',[[25.74333,123.47333],[25.92333,123.68167],[25.92167,124.55833]]],['CN-AKS',[[35.20,80]]],['CN-ZAN',[[27.59,91.86],[27.10,93.62]]]]) {
    await select(code);
    await until(()=>evalInApp('exact.has('+JSON.stringify(code)+')&&exact.has("CHN")&&!!areaOverlay'));
    for(const ll of points) {
      const p=JSON.stringify(ll);
      assert.equal(await evalInApp('matchesRegion({location:'+p+'})&&insideArea("CHN",'+p+')&&!insideArea("IND",'+p+')'),true,code+' containment');
    }
    assert.equal(await evalInApp('map.getBounds().contains('+JSON.stringify(points[0])+')'),true);
  }
  await select('JPN');
  await until(()=>evalInApp('exact.has("JPN")'));
  assert.ok(await evalInApp('!matchesRegion({location:[25.74333,123.47333]}) && !matchesRegion({location:[25.92167,124.55833]})'));
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
  assert.ok(await evalInApp('!insideArea("CN-DIA",[25.82,123.95])&&!insideArea("CN-DIA",[24.45,124.18])'));
  await select('001');
  await evalInApp(`window.testPainted=new Set();window.testFill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(s,...args){testPainted.add(s);return testFill.call(this,s,...args)};
    map.setView([39.91,116.407],11,{animate:false});true`);
  await until(()=>evalInApp('!!document.querySelector(".district-label") && !!streets'));
  for(const [lat,lon,road] of [[39.9074,116.4072,'街|路|胡同'],[40.7549,-73.984,'Street|Avenue|Broadway']]){
    await evalInApp('testPainted.clear();map.setView(['+lat+','+lon+'],16,{animate:false});true');
    await until(()=>evalInApp('Array.from(testPainted).some(s=>new RegExp('+JSON.stringify(road)+',"i").test(s))'),25000);
    assert.ok(await evalInApp('map.getPane("streetDetail").querySelectorAll("canvas.leaflet-tile-loaded").length>0'));
    if(lat>39&&lat<40){
      await new Promise(r=>setTimeout(r,500));
      const shot=await page.call('Page.captureScreenshot',{format:'png',clip});
      fs.writeFileSync(path.join(root,'street-map.png'),Buffer.from(shot.data,'base64'));
    }
  }
  await evalInApp('map.setZoom(19,{animate:false});true');
  await until(()=>evalInApp('map.getZoom()===19&&!streets.isLoading()&&!!streets.getContainer().querySelector("canvas.leaflet-tile-loaded")'));
  await page.call('Network.enable');
  await page.call('Network.setBlockedURLs',{urls:['*tiles.openfreemap.org/*']});
  try{
    await evalInApp('map.setView([48.86,2.35],12,{animate:false});true');
    await until(()=>evalInApp('!document.querySelector("#streetStatus").hidden&&!!document.querySelector(".district-label")'));
  }finally{await page.call('Network.setBlockedURLs',{urls:[]});}
  await page.click('#streetStatus');
  await until(()=>evalInApp('streets&&!streetFailures.size&&!streets.isLoading()&&document.querySelector("#streetStatus").hidden'));
  await evalInApp('map.setView([40.7549,-73.984],16,{animate:false});true');
  await evalInApp(`CanvasRenderingContext2D.prototype.fillText=testFill;
    cache.mapFixture={records:[record('metar','location-test','Acceptance station',Date.now(),[40.7549,-73.984],3,'',''),
      record('fx','reference-test','Test regional reference',Date.now(),[51.5,-.12],1,'','',{anchor:'currency'})]};
    render();true`);
  await page.click('.leaflet-marker-icon[title="Acceptance station"]');
  assert.ok(await evalInApp('document.querySelector(".location-card .geo-coords").textContent.includes("-73.984") && locationPopup.getLatLng().lat===40.7549'));
  await page.click('.leaflet-popup-close-button');
  await evalInApp(`openLocation(cache.mapFixture.records[1]);true`);
  await until(()=>evalInApp('locationPopup.isOpen() && !locationPopup.getElement().querySelector(".geo-coords") && map.getZoom()===5 && locationPopup.getElement().textContent.includes("区域参考点")'));
  assert.equal(await evalInApp('locationBlock({}).textContent'), '来源未提供位置');
  await evalInApp('map.closePopup();delete cache.mapFixture;render();true');
  await select('001');
}
