'use strict';
const workspaceWords={
 'zh-Hans':'我的工作台|保存或管理布局…|布局名称|保存当前布局|更新此布局|删除布局',
 'zh-Hant':'我的工作台|儲存或管理配置…|配置名稱|儲存目前配置|更新此配置|刪除配置',
 en:'My workspaces|Save or manage layouts…|Layout name|Save current layout|Update layout|Delete layout',
 fr:'Mes espaces|Gérer les dispositions…|Nom|Enregistrer la disposition|Mettre à jour|Supprimer',
 de:'Arbeitsbereiche|Layouts verwalten…|Name|Layout speichern|Aktualisieren|Löschen',
 ja:'ワークスペース|レイアウトの保存と管理…|名前|現在の配置を保存|配置を更新|削除',
 es:'Mis espacios|Gestionar diseños…|Nombre|Guardar diseño actual|Actualizar diseño|Eliminar',
 ru:'Рабочие области|Управление раскладками…|Название|Сохранить раскладку|Обновить|Удалить',
 ar:'مساحات العمل|إدارة التخطيطات…|الاسم|حفظ التخطيط الحالي|تحديث التخطيط|حذف',
 pt:'Meus espaços|Gerir layouts…|Nome|Guardar layout atual|Atualizar layout|Eliminar',
 hi:'कार्यस्थान|लेआउट प्रबंधित करें…|नाम|मौजूदा लेआउट सहेजें|अपडेट करें|हटाएँ',
 bn:'কর্মক্ষেত্র|বিন্যাস পরিচালনা…|নাম|বর্তমান বিন্যাস সংরক্ষণ|আপডেট|মুছুন',
 id:'Ruang kerja|Kelola tata letak…|Nama|Simpan tata letak|Perbarui|Hapus',
 ur:'ورک اسپیس|لے آؤٹ کا انتظام…|نام|موجودہ لے آؤٹ محفوظ کریں|تازہ کریں|حذف کریں',
 pcm:'My workspace|Manage layouts…|Layout name|Save this layout|Update layout|Delete layout',
 mr:'कार्यक्षेत्रे|मांडणी व्यवस्थापित करा…|नाव|सध्याची मांडणी जतन करा|अद्यतनित करा|हटवा',
 vi:'Không gian làm việc|Quản lý bố cục…|Tên bố cục|Lưu bố cục hiện tại|Cập nhật|Xóa',
 te:'కార్యస్థలాలు|లేఅవుట్ల నిర్వహణ…|పేరు|ప్రస్తుత లేఅవుట్ సేవ్ చేయి|నవీకరించు|తొలగించు',
 sw:'Sehemu za kazi|Dhibiti mipangilio…|Jina|Hifadhi mpangilio|Sasisha|Futa',
 tr:'Çalışma alanlarım|Düzenleri yönet…|Düzen adı|Geçerli düzeni kaydet|Güncelle|Sil'
};
function workspaceText(i){return (workspaceWords[lang==='arz'?'ar':lang]||workspaceWords.en).split('|')[i];}
let workspaceNames=[],restoreQueue=Promise.resolve();
function captureWorkspace(){
 if(!startDone)return null;
 const state={layer,region,eventType,minLevel,filter,mode,sessionDate,imageryMode,sizeX,sizeY,
   order:paneOrder(),sortByPublication,selectedId:selected?.id};
 if(map){const c=map.getCenter();state.map={lat:c.lat,lng:c.lng,zoom:map.getZoom(),globe:desktopGlobe.workspaceCamera(),scene:cityScene.camera()};}
 return state;
}
function queueWorkspaceRestore(state){
 restoreQueue=restoreQueue.then(()=>restoreWorkspace(state)).catch(noticeError);return restoreQueue;
}
async function restoreWorkspace(s){
 if(cityScene?.active)cityScene.leave();
 layer=paneTypes.includes(s.layer)?s.layer:'all';region=regionCode(s.region);
 eventType=validEventType(s.eventType);minLevel=s.minLevel;filter=s.filter||'';mode=s.mode==='saved'?'saved':'events';
 sizeX=s.sizeX;sizeY=s.sizeY;sessionDate=s.sessionDate;applyImageryMode(s.imageryMode);sortByPublication=!!s.sortByPublication;
 selected=s.selectedId?Object.values(cache).flatMap(c=>c.records||[]).find(e=>e.id===s.selectedId)||null:null;
 if(view==='main'){
   const order=paneOrder();
   if(s.order.length===order.length&&order.every(id=>s.order.includes(id))){
     s.order.forEach((id,i)=>{const old=paneOrder()[i];if(old!==id)swapPanes($(id),$(old));});
     localStorage.setItem('desk:paneOrder',JSON.stringify(s.order));
   }
   localStorage.setItem(sortPreference,JSON.stringify(sortByPublication));persistSession();
 }
 $('publicationSort').setAttribute('aria-pressed',String(sortByPublication));$('query').value=filter;
 layouts();configureMenus();satLayer();
 if(map&&s.map){
   ensureGeometry(region);map.closePopup();map.stop();map.invalidateSize({pan:false});
   map.setView([s.map.lat,s.map.lng],s.map.zoom,{animate:false});
   desktopGlobe.applyWorkspaceCamera(s.map.globe);
   if(s.map.scene)await cityScene.restore(s.map.scene);
 }
 render();
}
function paintWorkspaceMenu(){
 const menu=$('workspacePresets');if(!menu)return;
 menu.replaceChildren(new Option(workspaceText(0),''));menu.ariaLabel=workspaceText(0);
 workspaceNames.forEach((name,i)=>menu.add(new Option(name,String(i))));
 menu.add(new Option(workspaceText(1),'manage'));
}
function manageWorkspaces(){
 const body=showDialog('workspaces','settings');$('dialogTitle').textContent=workspaceText(0);
 const form=make('form'),name=make('input'),label=make('label',workspaceText(2)),save=make('button',workspaceText(3),'action');
 name.id='workspaceName';name.maxLength=60;name.required=true;name.autocomplete='off';
 label.htmlFor=name.id;save.type='submit';form.className='workspace-form';form.append(label,name,save);body.append(form);
 const refreshAction=()=>{save.disabled=!name.value.trim();save.textContent=workspaceText(workspaceNames.includes(name.value.trim())?4:3);};
 name.oninput=refreshAction;refreshAction();
 form.onsubmit=async event=>{
   event.preventDefault();if(save.disabled)return;save.disabled=true;
   try{workspaceNames=await rpc('workspaceSave',name.value.trim());paintWorkspaceMenu();$('dialog').close();}
   catch(error){noticeError(error);refreshAction();}
 };
 for(const preset of workspaceNames){
   const row=make('div','','workspace-entry');
   row.append(button(preset,()=>{name.value=preset;refreshAction();name.focus();}),button(workspaceText(5),async()=>{
     if(!window.confirm(workspaceText(5)+' · '+preset+'?'))return;
     workspaceNames=await rpc('workspaceDelete',preset);paintWorkspaceMenu();manageWorkspaces();
   }));
   body.append(row);
 }
 name.focus();
}
function wireWorkspaceMenu(){
 const menu=make('select');menu.id='workspacePresets';menu.disabled=true;
 $('refreshAll').before(menu);paintWorkspaceMenu();
 menu.onchange=async()=>{
   const choice=menu.value;menu.value='';
   if(choice==='manage'){manageWorkspaces();return;}
   if(choice==='')return;
   menu.disabled=true;
   try{await rpc('workspaceApply',workspaceNames[Number(choice)]);}
   catch(error){noticeError(error);}
   finally{menu.disabled=false;}
 };
}
