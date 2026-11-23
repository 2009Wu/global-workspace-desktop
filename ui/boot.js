'use strict';
const detailView=new URLSearchParams(location.search).get('view')==='detail';
const mapView=['main','map'].includes(new URLSearchParams(location.search).get('view')||'main');
const overviewImage=mapView?new Image():null;
if(overviewImage){overviewImage.fetchPriority='high';overviewImage.src='atlas/globe-1024.webp'}
const overviewReady=overviewImage?overviewImage.decode().catch(()=>{}):Promise.resolve();
const scripts=[
  ...(detailView?['atlas/countries.js']:['vendor/leaflet.js','vendor/protomaps-leaflet.js','world.js']),
  'i18n.js','map-themes.js','disclosures.js','official.js','flash.js','feeds.js',
  ...(detailView?[]:['atlas/terrain.js','atlas/districts/index.js','streets.js']),
  'local-time.js','locations.js','cartography.js',...(detailView?[]:['satellite.js','globe.js','scene.js']),
  'reporting.js','translation.js',...(detailView?['article.js']:[]),'app.js'
];
for(const url of scripts){
  const script=document.createElement('script');script.async=false;script.src=url;document.head.append(script);
}
