'use strict';
const detailView=new URLSearchParams(location.search).get('view')==='detail';
const scripts=[
  ...(detailView?['atlas/countries.js']:['vendor/leaflet.js','vendor/protomaps-leaflet.js','world.js']),
  'i18n.js','feeds.js',
  ...(detailView?[]:['atlas/terrain.js','atlas/districts/index.js','streets.js']),
  'locations.js','cartography.js',...(detailView?[]:['satellite.js']),
  'reporting.js','translation.js',...(detailView?['article.js']:[]),'app.js'
];
for(const url of scripts){
  const script=document.createElement('script');script.async=false;script.src=url;document.head.append(script);
}
