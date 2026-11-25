# 城市标注和岛屿海岸线

## 区县

离线区县标注使用 2026-11-22 的 GeoNames allCountries.zip，SHA-256 为 `c06d910efc08398c1743fea0820927d1323964d547a1b2723cf49c78013f0b10`。Build-Districts.py 提取行政单位名称与代表点并分区压缩。数据遵循 CC BY 4.0。[GeoNames 下载与授权](https://www.geonames.org/export/)

## 钓鱼岛及其附属岛屿

diaoyu-land.geojson 为 © OpenStreetMap contributors 的海岸线摘录，按 ODbL 1.0 提供。2026-11-22 使用 OSM API /api/0.6/map.json 获取以下经纬度范围。保留 natural=coastline 的 way，以原始节点串连并闭合为多边形。海岸轮廓仅用于陆地命中测试和绘图。[OpenStreetMap 署名与许可](https://www.openstreetmap.org/copyright)

| 西、南、东、北 | 提取范围 |
|---|---|
| 123.42,25.69,123.60,25.81 | 钓鱼岛、北小岛、南小岛及周围岛礁 |
| 123.65,25.90,123.72,25.95 | 黄尾屿及周围岛礁 |
| 124.52,25.89,124.60,25.95 | 赤尾屿及周围岛礁 |

岛名、主要岛屿标注点和筛选验证采用国家海洋局公布的坐标。应用按指定中国制图视角组织地区菜单。[钓鱼岛及其部分附属岛屿地理坐标](https://www.fmprc.gov.cn/diaoyudao/chn/zrhj/201510/t20151009_8520998.htm)

## 在线街道

OpenFreeMap 的 planet TileJSON 提供全球 OpenMapTiles 矢量瓦片。客户端按当前视野加载并在本地绘制。图层使用来源已有的多语名称，缺少译名时显示原名。[OpenFreeMap](https://openfreemap.org/quick_start/) · [OpenMapTiles](https://openmaptiles.org/) · [OpenStreetMap](https://www.openstreetmap.org/copyright)

渲染器为 protomaps-leaflet 5.1.0，发行文件与 BSD 授权一起保存在 ui/vendor。[Protomaps Leaflet](https://github.com/protomaps/protomaps-leaflet)

行政区多语别名取自 GeoNames 的带语言标识的备用名称，使用 CC BY 4.0。越南、泰国及老挝补充匹配了 Wikidata 的中文标签，使用 CC0。简繁异体通过 OpenCC 转换。[GeoNames](https://download.geonames.org/export/dump/) · [Wikidata](https://www.wikidata.org/)

地形使用 Esri World Shaded Relief 和 Terrain Tiles 的 Terrarium 高程瓦片。三维卫星影像按一倍高程绘制。军事图的国家轮廓叠加北约公布的成员和加入年份。[Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) · [北约成员与加入年份](https://www.nato.int/en/about-us/organization/nato-member-countries)


Capital names and IANA time zones in atlas/capitals.json are derived from GeoNames countryInfo, allCountries and alternateNamesV2, licensed under CC BY 4.0 (https://www.geonames.org/ and https://creativecommons.org/licenses/by/4.0/). Regenerate with tools/Build-Capitals.py.

United Nations Dag Hammarskjöld Library, *United Nations General Assembly Voting Data*, version 6 (15 October 2026), United Nations, downloaded 23 November 2026 UTC from https://digitallibrary.un.org/record/4060887 . The offline archive includes all 5,730 validated roll calls in the CSV (1946–2026). Labels use each roll call’s ms_name, including former seats. Land polygons use modern Natural Earth outlines as geographic approximations of voting seats. Separate Ukrainian and Byelorussian votes take precedence over the Soviet seat. Source CSV: https://digitallibrary.un.org/record/4060887/files/2026_10_15_votes_ga.csv . The recent records and translated titles come from the UN Digital Library MARCXML export: https://digitallibrary.un.org/search?p=930__a%3AVOT%20AND%20791__b%3AA%2F%20AND%20591__a%3ARECORDED*&of=xm&rg=40&sf=year&so=d . Rebuild with tools/Build-Votes.py. UN source terms and documentation: https://digitallibrary.un.org/record/4060887/files/2026_10_15_votes_ga_1.md .

The German and Yemeni dividing lines in ui/atlas/vote-splits.json are adapted from the German Democratic Republic and North Yemen polygons in Seshat Global History Databank, *Cliopatria* v0.0.1 (https://doi.org/10.5281/zenodo.13363121), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). The outlines were clipped to Natural Earth land, complemented, rounded and simplified. Tanganyika/Zanzibar use mainland and island polygons from the same Natural Earth atlas. Regenerate with tools/Build-Vote-Borders.py and the tagged cliopatria.geojson.zip. Membership history: https://www.un.org/en/about-us/growth-in-un-membership .

News region reference points and localized names in ui/atlas/news-regions.gz use Natural Earth 1:10m Admin 1 States and Provinces, public domain. https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
