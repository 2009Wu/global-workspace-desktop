'use strict';
const detailView=new URLSearchParams(location.search).get('view')==='detail';
const lightView=detailView||['country','timeline'].includes(new URLSearchParams(location.search).get('view'));
const mapView=['main','map'].includes(new URLSearchParams(location.search).get('view')||'main');
const overviewImage=mapView?new Image():null;
if(overviewImage){overviewImage.fetchPriority='high';overviewImage.src='atlas/globe-1024.webp'}
const overviewReady=overviewImage?overviewImage.decode().catch(()=>{}):Promise.resolve();
const scripts=[
  ...(lightView?['atlas/countries.js']:['vendor/leaflet.js','vendor/protomaps-leaflet.js','world.js']),
  'i18n.js','country-copy.js','vote-copy.js','map-themes.js','disclosures.js','official.js','flash.js','feeds.js',
  ...(lightView?[]:['atlas/terrain.js','atlas/districts/index.js','streets.js']),
  'local-time.js','locations.js','cartography.js',...(lightView?[]:['satellite.js','globe.js','scene.js']),
  'reporting.js','reading-performance.js','translation.js','chronicle.js','workspaces.js',...(detailView?['article.js']:[]),'country.js',...(new URLSearchParams(location.search).get('view')==='votes'?['votes.js','vote-seats.js','vote-cartography.js','vote-history.js']:[]),'app.js'
];
for(const url of scripts){
  const script=document.createElement('script');script.async=false;script.src=url;document.head.append(script);
}
