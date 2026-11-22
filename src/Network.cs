using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
internal static class Net {
    internal static readonly HttpClient Http=new HttpClient{Timeout=TimeSpan.FromSeconds(40)};
    static readonly HttpClient NoRedirect=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false}){Timeout=TimeSpan.FromSeconds(40)};
    static Net(){NoRedirect.DefaultRequestHeaders.UserAgent.ParseAdd("GlobalWorkspace/"+Build.Version);Http.MaxResponseContentBufferSize=16000000;Http.DefaultRequestHeaders.UserAgent.ParseAdd("GlobalWorkspace/"+Build.Version);}
    public static async Task<string> Get(string url,string token=null,bool fr=false,bool ship=false,bool strict=false){
        using(var req=new HttpRequestMessage(HttpMethod.Get,url)){if(token!=null)req.Headers.TryAddWithoutValidation(ship?"x-api-key":"Authorization",ship?token:"Bearer "+token);if(url.StartsWith("https://meri.digitraffic.fi/"))req.Headers.TryAddWithoutValidation("Digitraffic-User","GlobalWorkspace-Desktop");if(fr)req.Headers.TryAddWithoutValidation("Accept-Version","v1");
        using(var res=await (token==null&&!strict?Http:NoRedirect).SendAsync(req,HttpCompletionOption.ResponseHeadersRead)){res.EnsureSuccessStatusCode();using(var s=await res.Content.ReadAsStreamAsync())using(var memory=new MemoryStream()){
          var b=new byte[32768];int n;while((n=await ReadChunk(s,b))>0){if(memory.Length+n>9000000)throw new IOException("来源响应过大");memory.Write(b,0,n);}return Encoding.UTF8.GetString(memory.ToArray()).TrimStart('\uFEFF');
        }}}
    }
    internal static async Task<int> ReadChunk(Stream input,byte[] buffer){
      using(var timeout=new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(30))){
        using(timeout.Token.Register(()=>input.Dispose())){return await input.ReadAsync(buffer,0,buffer.Length,timeout.Token);}
      }
    }
    public static async Task<object> Article(string link){
        Uri u;
        string[] hosts={"www.bbc.co.uk","www.bbc.com","news.un.org","www.aljazeera.com","www.france24.com","www.crisisgroup.org","reliefweb.int"};
        if(!Uri.TryCreate(link,UriKind.Absolute,out u)||u.Scheme!="https"||!u.IsDefaultPort||u.UserInfo!=""||!hosts.Contains(u.IdnHost))throw new ArgumentException("Unsupported publisher");
        var html=await Get(u.AbsoluteUri,null,false,false,true);
        var ld=Regex.Matches(html,@"<script\b[^>]{0,500}application/ld\+json[^>]{0,100}>(.*?)</script>",RegexOptions.Singleline|RegexOptions.IgnoreCase)
            .Cast<Match>().Select(m=>m.Groups[1].Value).Where(s=>s.Length<180000).Take(6).ToArray();
        var excerpts=new List<string>();
        if(u.IdnHost=="www.bbc.co.uk"||u.IdnHost=="www.bbc.com"){
            foreach(Match m in Regex.Matches(html,@"<p\b[^>]{0,400}(?:-Paragraph\b|sc-[^>]*\bparagraph\b)[^>]*>(.*?)</p>",RegexOptions.Singleline|RegexOptions.IgnoreCase)){
                string s=WebUtility.HtmlDecode(Regex.Replace(m.Groups[1].Value,"<[^>]+>"," ")).Trim();
                if(s.Length>=45&&s.Length<=600)excerpts.Add(s);
                if(excerpts.Count==3)break;
            }
        }
        return new {ld=ld,excerpts=excerpts};
    }
    public static async Task<string> Translate(string target,string text){
        if(!Regex.IsMatch(target,@"^(zh-CN|zh-TW|en|hi|es|ar|arz|fr|bn|pt|id|ur|ru|de|ja|pcm|mr|vi|te|sw|tr)$")||String.IsNullOrWhiteSpace(text)||text.Length>1400)throw new ArgumentException("Translation input");
        if(target=="pcm"||target=="arz")text=await Translate("en",text);
        if(target=="arz"){
            using(var body=new StringContent(C.Json.Serialize(new {format="text",content=text,source_language="en",target_language="arz"}),Encoding.UTF8,"application/json"))
            using(var response=await Http.PostAsync("https://translate.wmcloud.org/api/translate",body)){
                response.EnsureSuccessStatusCode();
                return C.Str(C.Obj(await response.Content.ReadAsStringAsync()),"translation");
            }
        }
        if(target=="pcm"){
            const string endpoint="https://nithub-ai-ehn-english-to-nigerian-pidgin-translator.hf.space/gradio_api/call/translate";
            using(var body=new StringContent(C.Json.Serialize(new {data=new[]{"BBGM Model (EN to PCM)",text}}),Encoding.UTF8,"application/json"))
            using(var response=await Http.PostAsync(endpoint,body)){
                response.EnsureSuccessStatusCode();
                string job=C.Str(C.Obj(await response.Content.ReadAsStringAsync()),"event_id");
                if(!Regex.IsMatch(job,@"^[0-9a-f]{32}$"))throw new InvalidDataException("Translation job unavailable");
                string stream=await Get(endpoint+"/"+job);
                var complete=Regex.Match(stream,@"event: complete\r?\ndata:\s*(\[[^\r\n]*\])");
                if(!complete.Success)throw new InvalidDataException("Translation unavailable");
                return C.Json.Deserialize<string[]>(complete.Groups[1].Value).FirstOrDefault();
            }
        }
        var raw=await Get("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl="+target+"&q="+Uri.EscapeDataString(text));
        var responseData=C.Json.DeserializeObject(raw) as object[];
        var chunks=responseData==null?null:responseData[0] as object[];
        if(chunks==null)throw new InvalidDataException("Translation unavailable");
        return String.Concat(chunks.OfType<object[]>().Where(a=>a.Length>0).Select(a=>a[0] as string));
    }
    static string KeyPath(string id){if(id!="fr24"&&id!="x"&&id!="github"&&id!="ships")throw new ArgumentException("未知服务");return Path.Combine(C.User,id+".key");}
    public static void SetKey(string id,string key){var f=KeyPath(id);if(key==""){File.Delete(f);return;}C.Atomic(f,Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(key),null,DataProtectionScope.CurrentUser)));}
    internal static string Key(string id){var f=KeyPath(id);if(!File.Exists(f))throw new InvalidOperationException("需要在设置中配置访问凭据");return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(File.ReadAllText(f)),null,DataProtectionScope.CurrentUser));}
    public static bool HasKey(string id){return File.Exists(KeyPath(id));}
    static async Task<string> Baltic(){var both=await Task.WhenAll(Get("https://meri.digitraffic.fi/api/ais/v1/vessels"),Get("https://meri.digitraffic.fi/api/ais/v1/locations"));return "{\"meta\":"+both[0]+",\"positions\":"+both[1]+"}";}
    public static Task<string> Feed(string id,string arg){
        switch(id){
        case "adsb":case "ships":{
           if(!Regex.IsMatch(arg,@"^-?\d+(\.\d+)?,-?\d+(\.\d+)?$"))throw new ArgumentException("坐标无效");var pair=arg.Split(',');
           if(id=="ships")return Get("https://api.datalastic.com/api/v0/vessel_inradius?type=Cargo&radius=30&lat="+pair[0]+"&lon="+pair[1],Key("ships"),false,true);
           return Get("https://api.adsb.lol/v2/point/"+pair[0]+"/"+pair[1]+"/150");}
        case "baltic":return Baltic();
        case "france":return Get("https://www.france24.com/en/rss");
        case "aj":return Get("https://www.aljazeera.com/xml/rss/all.xml");
        case "metar":return Get("https://aviationweather.gov/api/data/metar?ids=KJFK,KLAX,KORD,KSEA,CYYZ,MMMX,SBGR,SCEL,EGLL,LFPG,EDDF,EHAM,LEMD,OMDB,OTHH,VIDP,VABB,ZBAA,ZSPD,VHHH,RJTT,RJAA,RKSI,WSSS,YSSY,NZAA,FAOR,HKJK,HECA&format=json");
        case "buoy":return Get("https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt");
        case "ferry":return Get("https://api-v3.mbta.com/vehicles?filter%5Broute_type%5D=4");
        case "fx":return Get("https://api.frankfurter.dev/v1/latest?base=USD");
        case "crypto":return Get("https://api.exchange.coinbase.com/products/BTC-USD/ticker");
        case "cloud":return Get("https://status.cloud.google.com/incidents.json");
        case "kev":return Get("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json");
        case "quake":return Get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson");
        case "gdacs":return Get("https://www.gdacs.org/xml/rss.xml");
        case "unpeace":return Get("https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml");
        case "shippingnews":case "ukrnews":{
            string theme=id=="shippingnews"?"\"Strait of Hormuz\" (shipping OR trade OR insurance)":"Ukraine (civilians OR \"front line\" OR \"territorial control\" OR \"peace talks\" OR displacement)";
            string sites=" (site:reuters.com OR site:apnews.com OR site:bbc.com OR site:un.org OR site:france24.com OR site:lloydslist.com OR site:imo.org OR site:aljazeera.com) when:14d";
            return Get("https://news.google.com/rss/search?q="+Uri.EscapeDataString(theme+sites)+"&hl=en-US&gl=US&ceid=US:en");}
        case "transits":return Get("https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query?where=portid%3D%27chokepoint6%27&outFields=date,n_tanker,n_cargo,n_total&orderByFields=date%20DESC&resultRecordCount=14&returnGeometry=false&f=json");
        case "crisis":return Get("https://www.crisisgroup.org/rss.xml");
        case "relief":return Get("https://reliefweb.int/updates/rss.xml");
        case "bbc":return Get("https://feeds.bbci.co.uk/news/world/rss.xml");
        case "un":return Get("https://news.un.org/feed/subscribe/en/news/all/rss.xml");
        case "eonet":return Get("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60");
        case "tg":if(!Regex.IsMatch(arg,@"^[A-Za-z][A-Za-z0-9_]{3,31}$"))throw new ArgumentException("频道名称无效");return Get("https://t.me/s/"+arg);
        case "x":return Get("https://api.x.com/2/tweets/search/recent?query="+Uri.EscapeDataString(arg.Length==0?"(from:Reuters OR from:AP) -is:retweet":arg.Substring(0,Math.Min(350,arg.Length)))+"&max_results=15&tweet.fields=created_at&expansions=attachments.media_keys&media.fields=url,preview_image_url,type,variants",Key("x"));
        case "fr24":if(!Regex.IsMatch(arg,@"^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$"))throw new ArgumentException("地图范围无效");
            return Get("https://fr24api.flightradar24.com/api/live/flight-positions/light?bounds="+arg+"&operating_as=AAL,UAL,DAL,BAW,AFR,DLH,ANA,JAL,CCA,CES,SIA,QFA,ACA,UAE&limit=100",Key("fr24"),true);
        default:throw new ArgumentException("未知来源");}
    }
}

