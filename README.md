# 世界情报收集处

Windows x64 桌面应用。地图、事件列表、简报可以独立开窗；双击地图上的国家进入国家视图。拖动面板间的分隔线调整布局。收藏、窗口尺寸和设置跟随当前 Windows 用户保存。

## 安装

1. 从本仓库的 [最新正式版](https://github.com/2009Wu/global-workspace-desktop/releases/latest) 下载 `GlobalWorkspace-Windows-x64.zip`。同一 Release 提供 ZIP 校验值。
2. 解压整个 ZIP，在解压目录里双击 `Install.exe`。安装器校验文件后启动主窗口，并在当前用户的桌面创建快捷方式。
3. Windows 10/11 x64 需安装 Microsoft Edge WebView2 Runtime 和 .NET Framework 4.7.2 或更高版本。依赖 SDK 随源码提供。下载的 Windows 程序没有 Authenticode 发布者签名。

## 查看事件

左侧选择八种图层，地图上方选择全球、大洲或国家。输入关键词或选择严重度可以缩小列表范围。地图数字表示附近聚合的记录数量。点击标记或列表查看简报，从「事件详情」打开小窗，核对来源链接、媒体和已观察到的更改。首次采集开始记录变化。来源提供的照片或视频可在详情窗口查看；媒体服务需要联网。地图和已缓存的简报支持断网查看。

颜色表示来源警报等级或该类观测的分级。灰色表示尚未定级。USGS 使用 PAGER 等级，GDACS 使用机构警报，METAR 使用飞行天气类别。国家新闻中的地名匹配用「≈」标记国家级关联。缺少位置的数据仍列在全球列表。区域筛选使用地理范围，国家筛选使用 Natural Earth 国界和已标注的国家关联。

| 图层 | 接入内容与覆盖 |
|---|---|
| 航空 | 全球主要机场的 NOAA METAR。adsb.lol 提供查询中心 150 海里内已识别的民航班号；洲级缩放选用代表机场。缩放地图后刷新可查询当前中心。可选 Flightradar24 按地图范围获取支持的商业航司样本。 |
| 海上 | NOAA NDBC 海洋站、波士顿 MBTA 运营渡轮、Fintraffic 波罗的海客货船 AIS。可选 Datalastic 查询中心 30 海里内货船。各源的接收覆盖不同。 |
| 金融 | Frankfurter 转发机构参考汇率，按来源日期展示。汇率标记位于货币代表地区。Coinbase BTC/USD 使用成交时间。 |
| 网络安全 | CISA 已知遭利用漏洞目录，Google Cloud 服务可用性事件及受影响区域。服务中断以供应商描述呈现。 |
| 灾害 | USGS 地震，GDACS 地震、洪水、风暴等预警。 |
| 政治与地缘政治 | BBC World、UN News、France 24 和 Al Jazeera 世界新闻。可选 X 搜索、Telegram 公开频道预览。标题和摘要可按界面语言显示译文，详情页可展开原文。 |
| 冲突动态 | 联合国和平与安全、国际危机组织、ReliefWeb 与国际媒体公开报道。专题入口聚焦霍尔木兹海峡民用贸易通航，以及乌克兰人道影响和城市级局势报道。IMF PortWatch 提供最近 14 个有数据日期的商船航次、货船和油轮汇总。表中日期为统计日，总量以来源统计口径为准。 |
| 卫星 | 默认使用 Esri World Imagery 高清拼接底图，叠加区县、道路及 NASA EONET 地理事件。切换到「按日观测 · NASA」可按日期查看 MODIS Terra 影像。 |

「数据源」显示各来源连接状态和本地取数时间。新闻发布时间、观测时间、汇率日期显示在记录内。公开报道和社交帖子均附来源。新闻先匹配报道指明的城市或海域，再匹配明确的国家位置。城市标记和海域标记使用代表点。媒体对控制权、归责或停战的说法均保留来源。冲突专题随来源刷新，保留本机最近收录的部分报道（最长 30 天、每个专题来源最多补留至 120 条）。详情在本机先显示已有记录，随后按发布者提供的内容补充署名、更新时间和来源摘录，列出同地或标题高度相关的其他报道。不同来源可能独立报道同一事件。

## 地图数据

全球边界使用 Natural Earth 的 1:10,000,000 中国视角数据。全球概览使用简化线条，放大后读取当前视野的精细轮廓。地图配有河流、湖泊、省级行政线、按比例尺显示的城市和地形晕渲。台湾、阿克赛钦、藏南另附按高程生成的区域山体阴影。高程取自 [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)，署名见 ui/atlas/terrain-attribution.txt。这些地理图层随包安装，可离线查看。比例尺表示源图的制图尺度。

放大到城市后可逐级查看区县、社区和道路，最大缩放级别为 19。GeoNames 的区县标签已随包安装。联网后，OpenFreeMap 提供 OpenStreetMap 道路、建筑轮廓、街道名称及有数据的地方行政界线。各地覆盖和地名语言取决于来源。卫星图层沿用相同的地名、道路和事件坐标。高清模式按视野读取[全球卫星与航空影像](https://goto.arcgisonline.com/maps/World_Imagery)。不同地区的拍摄日期与原始分辨率可能不同，高缩放级别缺图时显示同一区域较低分辨率的影像。日期选择器仅用于 NASA 按日观测模式。在线街道加载失败时，地图提供重试入口。

点击单个事件标记可查看来源地名、来源报告的坐标和时间。数字聚合标记可展开选择具体事件。简报与独立详情窗均有「查看位置」入口。近距离地图上可查看附近的道路标注。按新闻标题、汇率或云服务区域设置的参考点会单独标明，缺少来源位置时会直接提示。

在地区菜单选择「中国」浏览全国，或从中国分组选择「台湾」「阿克赛钦」「藏南」「钓鱼岛及其附属岛屿」。钓鱼岛、黄尾屿、赤尾屿等使用独立海岸多边形，制作来源见 tools/data/SOURCES.md。点位筛选使用对应区域多边形。这套底图按指定制图视角表达边界，来源新闻保留原文。边界数据来源和视角定义见 [Natural Earth](https://www.naturalearthdata.com/about/disputed-boundaries-policy/)。构建工具 tools/Build-Map.py 记录源地址、输入校验值和处理方式。

## 语言与捐赠

语言下拉菜单按 2026 年总使用者规模选取二十种语言。中文同时支持简体、繁体，因此共有 21 项。阿拉伯语、埃及阿拉伯语及乌尔都语使用从右至左的界面。翻译覆盖主界面和常用操作。屏幕内的报道标题与摘要按当前语言异步翻译，译文按原文和目标语言在本机缓存。公开报道文本会发送给在线翻译服务。常用语言使用 Google 翻译，埃及阿拉伯语使用 Wikimedia MinT，尼日利亚皮钦语使用 NIT Hub 的英语新闻翻译模型；后两者以英文作中间语言。服务不可用时显示原文。航班号、台站观测代码和原始数值保持来源格式。翻译可能改变细微语气，详情提供原文对照。

主窗口、独立详情窗顶栏和设置页的咖啡按钮均可打开 [Little Wang 的 Ko-fi](https://ko-fi.com/little_wang)。简体显示「帮小王买杯咖啡」，繁体显示「幫小王買杯咖啡」。其他界面语言表达“请我喝咖啡”。

## 连接账户

设置页可填写自己的 Flightradar24、Datalastic、X 或 GitHub 访问凭据。凭据用 Windows DPAPI 按当前用户加密，仅在本机保存。付费服务按用户自己的订阅计费。Telegram 输入允许公开预览的频道名。X 可自定义搜索条件。只有添加凭据后，相关按量服务才开始取数。

从 [GitHub 最新正式版](https://github.com/2009Wu/global-workspace-desktop/releases/latest) 下载 Windows 安装包。仓库已公开，下载和应用内检查更新均无需登录 GitHub 或填写令牌。

## 更新与恢复

固定产品 ID、仓库、附件名、应用版本集中在 `product.json`。启动后异步查询 GitHub 最新正式版。右下角提示和设置页共用一个安装流程。下载 ZIP 后先校验 ZIP 大小和 SHA-256，再校验产品、版本、每个文件的路径和摘要。GitHub HTTPS 和发布者账户构成更新源的信任边界。

安装位置是当前用户 LocalAppData 下的 `LittleWang/GlobalWorkspace`。根目录中的启动器读取活动版本。更新进程等待应用退出，把完整的托管文件写到独立版本目录，保留上个版本，并原子切换活动版本。新界面加载成功后确认安装。中断时从桌面快捷方式重开即可恢复。设置、收藏和缓存都位于独立的 `user` 目录；用户导出的 JSON 由用户选择保存位置。

## 构建、测试和发版

在 Windows 上检出本仓库，在 PowerShell 执行：

```powershell
.\tools\Build.ps1 -Release
node .\tests\update-e2e.mjs
```

验收脚本需要 Node.js 22 或以上和交互式 Windows 桌面。它在系统临时目录构建两个独立测试版本，运行假 GitHub 服务，操作真正的 Windows 客户端和更新进程。测试快捷方式放在临时桌面目录，测试产品 ID 与实际应用隔离。程序不包含本地测试服务地址。

后续版本先改 `product.json` 的版本号，提交并推送到仓库的 main 分支。在已登录 GitHub CLI 的 Windows 机器上运行 `.\tools\Publish.ps1 -NotesFile <更新说明路径>`。脚本生成匹配的 `vX.Y.Z` 标签和 Release，上传 Windows ZIP、同名 `.sha256` 和 `update.json` 后发布。相同的正式版本不能覆盖。已安装的旧版通过固定地址发现更新。

新闻城市索引取自 GeoNames 的 cities15000.zip（CC BY 4.0），2026-11-22 版本的 SHA-256 为 a15729cf99546631212e7c9bbb9ef0965d7a4bf213c39a891b279004c73f4da1。tools/Build-News-Places.py 生成压缩地名索引。[GeoNames](https://www.geonames.org/export/) · [IMF PortWatch](https://portwatch.imf.org/) · [埃及阿语翻译](https://translate.wmcloud.org/docs) · [尼日利亚皮钦语翻译](https://huggingface.co/spaces/NITHUB-AI/EHN-EnglisH-to-Nigerian-Pidgin-Translator)

## 数据与组件署名

地图轮廓使用 [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) 公有领域数据。地图控件使用 [Leaflet](https://leafletjs.com/) 1.9.4，许可证随包附带。WebView2 SDK 1.0.4314.35 的微软许可和 NOTICE 随包提供。民航位置来自 [adsb.lol](https://www.adsb.lol/docs/open-data/api)，对应数据采用 ODbL 1.0；芬兰水域 AIS 来自 [Fintraffic / Digitraffic](https://www.digitraffic.fi/en/marine-traffic/)，使用 CC BY 4.0。卫星瓦片来源为 NASA GIBS / EOSDIS；事件与媒体仍归各来源。新闻原始链接在详情页可打开。

