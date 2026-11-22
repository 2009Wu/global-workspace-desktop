"""Bake regional hillshading from Mapzen Terrarium DEMs. Pass a build cache directory."""
import io
import json
import math
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
import time
from urllib.request import urlopen

import numpy as np
from PIL import Image

BASE = Path(__file__).resolve().parents[1] / "ui" / "atlas"
CACHE = Path(sys.argv[1])
CACHE.mkdir(parents=True, exist_ok=True)
ZOOM = 9
COUNT = 2**ZOOM
REGIONS = {"CN-TW":(117.4,20.8,123.6,27.4),"CN-AKS":(76.4,32.1,81.8,37.2),
           "CN-ZAN":(90,25.4,99,30.8)}
def tile_y(lat):
    return int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)*COUNT/2)
def latitude(row):
    return math.degrees(math.atan(math.sinh(math.pi*(1-2*row/COUNT))))
def load_tile(coords):
    x,y=coords
    target=CACHE/f"{ZOOM}-{x}-{y}.png"
    if not target.exists():
        for attempt in range(3):
            try:
                with urlopen(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{x}/{y}.png",timeout=25) as r:
                    data=r.read()
                Image.open(io.BytesIO(data)).verify()
                target.write_bytes(data)
                break
            except OSError:
                if attempt==2:raise
                time.sleep(1+attempt)
    rgb=np.asarray(Image.open(target).convert("RGB"),dtype=np.float32)
    return x,y,rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768

def bake(code,bbox):
    west,south,east,north=bbox
    x0,x1=[int((lon+180)/360*COUNT) for lon in (west,east)]
    y0,y1=tile_y(north),tile_y(south)
    h=np.empty(((y1-y0+1)*256,(x1-x0+1)*256),dtype=np.float32)
    coords=[(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for x,y,tile in pool.map(load_tile,coords):
            i,j=(y-y0)*256,(x-x0)*256
            h[i:i+256,j:j+256]=tile
    meters=40075017*math.cos(math.radians((north+south)/2))/(COUNT*256)
    dy,dx=np.gradient(h,meters)
    norm=np.sqrt(1+dx*dx+dy*dy)
    shade=np.clip((.5*dx+.45*dy+.74)/norm-.69,-.68,.5)
    elev=np.array([0,550,1600,3200,5100,7000])
    palette=np.array([[41,67,66],[50,76,68],[61,82,72],[76,87,77],[91,101,93],[144,153,143]])
    rgba=np.empty((*h.shape,4),dtype=np.uint8)
    for k in range(3):
        rgba[:,:,k]=np.clip(np.interp(h,elev,palette[:,k])+102*shade,0,255)
    rows,cols=h.shape
    edge_y=np.minimum(np.arange(rows),np.arange(rows)[::-1])[:,None]
    edge_x=np.minimum(np.arange(cols),np.arange(cols)[::-1])[None,:]
    rgba[:,:,3]=np.where(h>0,245*np.clip(np.minimum(edge_x,edge_y)/120,0,1),0)
    Image.fromarray(rgba).save(BASE/f"terrain-{code}.webp",quality=88,method=4)
    return [[latitude(y1+1),x0/COUNT*360-180],[latitude(y0),(x1+1)/COUNT*360-180]]

bounds={code:bake(code,box) for code,box in REGIONS.items()}
(BASE/"terrain.js").write_text("const terrainFootprints="+json.dumps(bounds,separators=(",",":"))+";\n",encoding="utf-8")
