// Run with Node 22+ on an interactive Windows desktop. All installs and shortcuts are isolated.
import fs from 'node:fs';
import os from 'node:os';
import {checkMap} from './map-window.mjs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gw-acceptance-')),home=path.join(root,'home');
const zip='GlobalWorkspace-Windows-x64.zip',versions=['0.1.0','0.1.1'];
const results=[];function pass(s){results.push(s);console.log('PASS '+s);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms=45000){const end=Date.now()+ms;let last;while(Date.now()<end){try{const x=await f();if(x)return x;}catch(e){last=e;}await sleep(180);}throw Error('Timed out: '+f.toString().slice(0,180)+' '+(last||''));}
const PS=(script,args=[])=>execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass',...script,...args],{encoding:'utf8',windowsHide:true});
let mode='none',zipRequests=0,port,cdpPort;const releaseDir=path.join(root,'0.1.1');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.endsWith('/releases/latest')){if(mode==='none'){res.writeHead(404).end();return;}
 const tag=mode==='same'?'0.1.0':'0.1.1';res.setHeader('Content-Type','application/json');res.end(JSON.stringify({tag_name:'v'+tag,draft:false,prerelease:mode==='pre',body:'更新验收 / release fixture',assets:[zip,zip+'.sha256','update.json'].map(name=>({name,browser_download_url:'http://127.0.0.1:'+port+'/assets/'+name}))}));return;}
 const name=pathname.split('/').at(-1);if(![zip,zip+'.sha256','update.json'].includes(name)){res.writeHead(404).end();return;}const data=fs.readFileSync(path.join(releaseDir,name));if(name===zip){zipRequests++;if(mode==='broken')data[Math.floor(data.length/2)]^=1;}res.end(data);});
async function listen(s,p=0){await new Promise(r=>s.listen(p,'127.0.0.1',r));return s.address().port;}
port=await listen(server);const tmpServer=http.createServer();cdpPort=await listen(tmpServer);await new Promise(r=>tmpServer.close(r));
const feed='http://127.0.0.1:'+port+'/repos/test/workspace/releases/latest';
const env={...process.env,ATLAS_TEST_HOME:home,ATLAS_TEST_PORT:String(cdpPort)};
const launch=exe=>{const p=spawn(exe,[],{env,detached:true,stdio:'ignore',windowsHide:true});p.unref();};
async function pages(){return (await (await fetch('http://127.0.0.1:'+cdpPort+'/json/list')).json()).filter(p=>p.type==='page');}
async function connect(view='main'){const target=await until(async()=>(await pages()).find(p=>p.url.endsWith('?view='+view)));const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let seq=0;const jobs=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data);const j=jobs.get(m.id);if(j){jobs.delete(m.id);m.error?j.reject(Error(m.error.message)):j.resolve(m.result);}};ws.onclose=()=>{for(const j of jobs.values())j.reject(Error('window closed'));jobs.clear();};
 const call=(method,params={})=>new Promise((resolve,reject)=>{let id=++seq;jobs.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const ev=async expr=>{const r=await call('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const click=async selector=>{const pt=await until(()=>ev('(()=>{let e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.disabled)return null;e.scrollIntoView({block:"center",inline:"nearest"});let r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return r.width&&r.height&&e.contains(document.elementFromPoint(x,y))?[x,y]:null;})()'));for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,x:pt[0],y:pt[1],button:'left',clickCount:1});};
 await until(()=>ev('typeof startDone!=="undefined" && startDone'));return {ev,click,call,ws};}
const read=f=>fs.readFileSync(f,'utf8');
const active=()=>read(path.join(home,'active.txt')).trim();
async function cleanJournal(){await until(()=>!fs.existsSync(path.join(home,'pending.json')));}
async function check(page){await page.click('#settings');await page.click('#dialogBody > button');await until(()=>page.ev('!state.busy && !!state.status'));await sleep(350);}
async function closeDialog(page){await page.click('#dismissDialog');}
function linkPath(){return fs.readdirSync(path.join(home,'test-desktop')).filter(n=>n.endsWith('.lnk'));}
function openLink(name){const full=path.join(home,'test-desktop',name);const child=spawn('powershell.exe',['-NoProfile','-Command','Start-Process -FilePath $env:GW_TEST_LINK'],{env:{...env,GW_TEST_LINK:full},windowsHide:true,stdio:'ignore'});child.unref();}
let a;
try{
 console.log('TEST_ROOT '+root);
 for(const v of versions)PS(['-File',path.join(project,'tools','Build.ps1')],['-TestVersion',v,'-TestFeed',feed,'-OutputDirectory',path.join(root,v)]);
 const extracted=path.join(root,'first');process.env.GW_TEST_ZIP=path.join(root,'0.1.0',zip);process.env.GW_TEST_EXTRACT=extracted;PS(['-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:GW_TEST_ZIP,$env:GW_TEST_EXTRACT)']);
 launch(path.join(extracted,'Install.exe'));a=await connect();await cleanJournal();
 assert.equal(active(),'0.1.0');assert.equal(await a.ev('document.querySelector("#toast").hidden'),true);assert.equal(linkPath().length,1);pass('first install, visible workspace, empty release feed and one shortcut');
 await until(()=>a.ev('document.querySelectorAll("#rows .row").length>0'),65000);
 await checkMap(a,until,root);pass('detailed map, terrain, cities, water, country and subregion filters, legacy Taiwan bookmarks');
 await a.click('#briefBody .actions button:last-child');await until(()=>fs.existsSync(path.join(home,'user','saved.json')));const bookmark=JSON.parse(read(path.join(home,'user','saved.json')))[0].id;
 await a.ev('document.querySelector("#language").value="zh-Hant"; document.querySelector("#language").dispatchEvent(new Event("change"));');await until(()=>read(path.join(home,'user','settings.json')).includes('zh-Hant'));
 assert.equal(await a.ev('document.querySelector("#language").options.length'),21);
 for(const lc of ['en','ar','ja','zh-Hans','zh-Hant']){await a.ev('document.querySelector("#language").value='+JSON.stringify(lc)+';document.querySelector("#language").dispatchEvent(new Event("change"))');await until(()=>a.ev('document.documentElement.lang==='+JSON.stringify(lc)));assert.equal(await a.ev('document.documentElement.dir'),lc==='ar'?'rtl':'ltr');}
 pass('21 language choices; English, Arabic RTL, Japanese and both Chinese interfaces switch immediately');
 for(const id of ['air','sea','money','cyber','disaster','politics','sat']){await a.click('[data-layer="'+id+'"]');await until(()=>a.ev('document.querySelectorAll("#rows .row").length>0'),45000);assert.equal(await a.ev('document.querySelector("#layerSelect").value'),id);}
 await a.click('[data-layer="all"]');await until(()=>a.ev('loading.size===0'),60000);await sleep(350);await a.click('#briefBody .actions button:first-child');const detail=await connect('detail');assert.ok(await detail.ev('document.querySelectorAll(".sourcebutton").length'));pass('seven populated source layers, saved event, non-modal detail window and persisted language');
 await a.call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(root,'workspace.png'),Buffer.from(r.data,'base64')));
 const original=linkPath()[0],renamed='My custom entry.lnk';fs.renameSync(path.join(home,'test-desktop',original),path.join(home,'test-desktop',renamed));
 mode='same';await check(a);assert.ok(await a.ev('!state.next'));await closeDialog(a);mode='pre';await check(a);assert.ok(await a.ev('!state.next'));await closeDialog(a);pass('same release and prerelease stay quiet');
 await new Promise(r=>server.close(r));await check(a);assert.ok(await a.ev('document.querySelector("#toast").hidden'));await closeDialog(a);await a.click('#savedTab');assert.ok(await a.ev('document.querySelector("#rows .row")!==null'));await a.click('#savedTab');await listen(server,port);pass('update endpoint offline, cached workspace and saved item usable');
 mode='broken';await check(a);await closeDialog(a);await until(()=>a.ev('!document.querySelector("#toast").hidden'));await a.click('#toast .toasthead button');assert.ok(await a.ev('document.querySelector("#toast").hidden'));await a.click('#settings');await a.click('#settingsUpdate [data-update]');await until(()=>a.ev('state.phase==="error"'));assert.equal(active(),'0.1.0');pass('dismissible toast, settings fallback, corrupt ZIP rejected and retry offered');
 mode='good';fs.writeFileSync(path.join(home,'test-stop.txt'),'after-switch');await a.click('#settingsUpdate [data-update]');await until(()=>active()==='0.1.1'&&fs.existsSync(path.join(home,'pending.json')));await sleep(400);fs.unlinkSync(path.join(home,'test-stop.txt'));openLink(renamed);a=await connect();await cleanJournal();assert.equal(active(),'0.1.0');assert.equal(await a.ev('version'),'0.1.0');pass('forced updater termination after activation; renamed shortcut recovered previous version');
 await until(()=>a.ev('!document.querySelector("#toast").hidden'));const count=zipRequests;await a.click('#toast .toasthead button');await a.click('#briefBody .actions button:first-child');const second=await connect('detail');await second.click('#settings');await a.click('#settings');
 const exportFile=path.join(home,'test-exports','workspace-events.json');await a.click('#dialogBody > button:last-child');await sleep(450);
 // Both independent WebViews invoke the normal update action while a native export dialog owns the current task.
 await Promise.all([a.click('#settingsUpdate [data-update]'),second.click('#settingsUpdate [data-update]')]);
 await until(()=>a.ev('state.phase==="restart"'),15000);assert.equal(active(),'0.1.0');assert.equal(zipRequests,count+1);
 PS(['-File',path.join(project,'tests','Save-TestExport.ps1')],['-Install',home,'-Destination',exportFile]);
 await until(()=>fs.existsSync(exportFile));assert.ok(JSON.parse(read(exportFile)).some(e=>e.id===bookmark));pass('two windows share one download; restart waits for genuine Save As export to finish');
 await until(()=>active()==='0.1.1');await cleanJournal();a=await connect();assert.equal(await a.ev('version'),'0.1.1');assert.equal(zipRequests,count+1);assert.deepEqual(linkPath(),[renamed]);assert.equal(await a.ev('lang'),'zh-Hant');await a.click('#savedTab');assert.ok(await a.ev('saved.some(e=>e.id==='+JSON.stringify(bookmark)+')'));await a.click('#briefBody .actions button:first-child');await connect('detail');pass('one-click genuine download, verification, installation, automatic new window and intact saved event/settings');
 await a.call('Browser.close').catch(()=>{});await sleep(800);
 // Closing Chromium alone does not always close the native form. Stop only this isolated test client.
 process.env.GW_TEST_HOME=home;
 PS(['-Command','Get-Process Client -ErrorAction SilentlyContinue | Where-Object {$_.Path -and $_.Path.StartsWith($env:GW_TEST_HOME+"\\")} | Stop-Process -Force']);fs.writeFileSync(path.join(home,'test-offline'),'offline');await new Promise(r=>server.close(r));openLink(renamed);a=await connect();assert.equal(await a.ev('version'),'0.1.1');await a.click('#savedTab');assert.ok(await a.ev('saved.length>0'));await a.click('#savedTab');assert.ok(await a.ev('Object.values(cache).some(c=>c.records.length>0)'));pass('renamed desktop shortcut cold-starts the new version offline, with cached data and saved records');
 console.log(JSON.stringify({passed:results,root},null,2));
}catch(e){
 if(a)try{console.error('FAIL STATE',await a.ev('JSON.stringify([view,layer,state,document.querySelector("#briefBody")?.innerText?.slice(-200),document.querySelector("dialog[open]")?.dataset.page])'));const shot=await a.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'failure.png'),Buffer.from(shot.data,'base64'));}catch{}
 throw e;
}finally{
 fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(results,null,2));process.env.GW_TEST_HOME=home;
 try{PS(['-Command','Get-Process Client,Maintenance -ErrorAction SilentlyContinue | Where-Object {$_.Path -and $_.Path.StartsWith($env:GW_TEST_HOME+"\\")} | Stop-Process -Force; exit 0']);}catch{}
 server.close();setTimeout(()=>process.exit(process.exitCode||0),1000).unref();
}

