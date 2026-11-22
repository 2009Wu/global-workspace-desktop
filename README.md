# 全球情报工作台

Windows x64 桌面应用。项目暂用功能描述作为窗口标题。地图、事件列表、简报可以独立开窗；双击地图上的国家进入国家视图。拖动面板间的分隔线调整布局。收藏、窗口尺寸和设置跟随当前 Windows 用户保存。

## 安装

1. 登录有权限的 GitHub 账户，从本仓库 Releases 下载 `GlobalWorkspace-Windows-x64.zip`。同一 Release 提供 ZIP 校验值。
2. 解压整个 ZIP，在解压目录里双击 `Install.exe`。安装器校验文件后启动主窗口，并在当前用户的桌面创建快捷方式。
3. Windows 10/11 x64 需安装 Microsoft Edge WebView2 Runtime 和 .NET Framework 4.7.2 或更高版本。依赖 SDK 随源码提供。下载的 Windows 程序没有 Authenticode 发布者签名。

## 查看事件

左侧选择七种图层，地图上方选择全球、大洲或国家。输入关键词或选择严重度可以缩小列表范围。地图数字表示附近聚合的记录数量。点击标记或列表查看简报，从「事件详情」打开小窗，核对来源链接、媒体和已观察到的更改。首次采集开始记录变化。来源提供的照片或视频可在详情窗口查看；媒体服务需要联网。地图和已缓存的简报支持断网查看。

颜色表示来源警报等级或该类观测的分级。灰色表示尚未定级。USGS 使用 PAGER 等级，GDACS 使用机构警报，METAR 使用飞行天气类别。国家新闻中的地名匹配用「≈」标记国家级关联。缺少位置的数据仍列在全球列表。区域筛选使用地理范围，国家筛选使用 Natural Earth 国界和已标注的国家关联。

| 图层 | 接入内容与覆盖 |
|---|---|
| 航空 | 全球主要机场的 NOAA METAR。adsb.lol 提供查询中心 150 海里内已识别的民航班号；洲级缩放选用代表机场。缩放地图后刷新可查询当前中心。可选 Flightradar24 按地图范围获取支持的商业航司样本。 |
| 海上 | NOAA NDBC 海洋站、波士顿 MBTA 运营渡轮、Fintraffic 波罗的海客货船 AIS。可选 Datalastic 查询中心 30 海里内货船。各源的接收覆盖不同。 |
| 金融 | Frankfurter 转发机构参考汇率，按来源日期展示。汇率标记位于货币代表地区。Coinbase BTC/USD 使用成交时间。 |
| 网络安全 | CISA 已知遭利用漏洞目录，Google Cloud 服务可用性事件及受影响区域。服务中断以供应商描述呈现。 |
| 灾害 | USGS 地震，GDACS 地震、洪水、风暴等预警。 |
| 政治与地缘政治 | BBC World、UN News、France 24 和 Al Jazeera 世界新闻。可选 X 搜索、Telegram 公开频道预览。摘要和媒体保留原发布者语言。 |
| 卫星 | NASA GIBS 的 MODIS Terra 日影像及 NASA EONET 地理事件。日期控件切换观测日，云层、轨道覆盖和来源延迟会影响画面。 |

「数据源」显示各来源连接状态和本地取数时间。新闻发布时间、观测时间、汇率日期显示在记录内。公开报道和社交帖子均附来源。单条报道的地名匹配和严重度只用于筛选。不同来源可能独立报道同一事件。

## 地图数据

全球边界使用 Natural Earth 的 1:10,000,000 中国视角数据。全球概览使用简化线条，放大后读取当前视野的精细轮廓。地图配有河流、湖泊、省级行政线、按比例尺显示的城市和地形晕渲。台湾、阿克赛钦、藏南另附按高程生成的区域山体阴影。高程取自 [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)，署名见 ui/atlas/terrain-attribution.txt。这些地理图层随包安装，可离线查看。比例尺表示源图的制图尺度。

在地区菜单选择「中国」浏览全国，或从中国分组选择「台湾」「阿克赛钦」「藏南」。点位筛选使用对应区域多边形。这套底图按指定制图视角表达边界，来源新闻保留原文。边界数据来源和视角定义见 [Natural Earth](https://www.naturalearthdata.com/about/disputed-boundaries-policy/)。构建工具 tools/Build-Map.py 记录源地址、输入校验值和处理方式。

## 语言与捐赠

语言下拉菜单按 2026 年总使用者规模选取二十种语言。中文同时支持简体、繁体，因此共有 21 项。阿拉伯语、埃及阿拉伯语及乌尔都语使用从右至左的界面。翻译覆盖主界面和常用操作。外部文章、机构名称及底层诊断保留原文。

设置页的咖啡按钮打开 [Little Wang 的 Ko-fi](https://ko-fi.com/little_wang)。简体显示「帮小王买杯咖啡」，繁体显示「幫小王買杯咖啡」。其他界面语言表达“请我喝咖啡”。

## 连接账户

设置页可填写自己的 Flightradar24、Datalastic、X 或 GitHub 访问凭据。凭据用 Windows DPAPI 按当前用户加密，仅在本机保存。付费服务按用户自己的订阅计费。Telegram 输入允许公开预览的频道名。X 可自定义搜索条件。只有添加凭据后，相关按量服务才开始取数。

**当前仓库是私有的。** 若要自动获取后续版本，在设置页的 GitHub 一栏填写仅允许访问本仓库、具有 Contents 只读权限的 fine-grained token，保存后点击「检查更新」。私人仓库对未授权请求可能返回 404，主界面正常启动。应用内没有开发者的共享令牌。

## 更新与恢复

固定产品 ID、仓库、附件名、应用版本集中在 `product.json`。启动后异步查询 GitHub 最新正式版。右下角提示和设置页共用一个安装流程。下载 ZIP 后先校验 ZIP 大小和 SHA-256，再校验产品、版本、每个文件的路径和摘要。GitHub HTTPS、私有仓库权限和发布者账户构成更新源的信任边界。

安装位置是当前用户 LocalAppData 下的 `LittleWang/GlobalWorkspace`。根目录中的启动器读取活动版本。更新进程等待应用退出，把完整的托管文件写到独立版本目录，保留上个版本，并原子切换活动版本。新界面加载成功后确认安装。中断时从桌面快捷方式重开即可恢复。设置、收藏和缓存都位于独立的 `user` 目录；用户导出的 JSON 由用户选择保存位置。

## 构建、测试和发版

在 Windows 上检出本仓库，在 PowerShell 执行：

```powershell
.\tools\Build.ps1 -Release
node .\tests\update-e2e.mjs
```

验收脚本需要 Node.js 22 或以上和交互式 Windows 桌面。它在系统临时目录构建两个独立测试版本，运行假 GitHub 服务，操作真正的 Windows 客户端和更新进程。测试快捷方式放在临时桌面目录，测试产品 ID 与实际应用隔离。程序不包含本地测试服务地址。

后续版本先改 `product.json` 的版本号，提交并推送到私有仓库 main。在已登录 GitHub CLI 的 Windows 机器上运行 `.\tools\Publish.ps1 -NotesFile <更新说明路径>`。脚本生成匹配的 `vX.Y.Z` 标签和 Release，上传 Windows ZIP、同名 `.sha256` 和 `update.json` 后发布。相同的正式版本不能覆盖。已安装的旧版通过固定地址发现更新。

## 数据与组件署名

地图轮廓使用 [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) 公有领域数据。地图控件使用 [Leaflet](https://leafletjs.com/) 1.9.4，许可证随包附带。WebView2 SDK 1.0.4314.35 的微软许可和 NOTICE 随包提供。民航位置来自 [adsb.lol](https://www.adsb.lol/docs/open-data/api)，对应数据采用 ODbL 1.0；芬兰水域 AIS 来自 [Fintraffic / Digitraffic](https://www.digitraffic.fi/en/marine-traffic/)，使用 CC BY 4.0。卫星瓦片来源为 NASA GIBS / EOSDIS；事件与媒体仍归各来源。新闻原始链接在详情页可打开。

