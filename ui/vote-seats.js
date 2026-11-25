'use strict';

let memberAtlas={defaults:{},profiles:[]};
const periodNames={
 'USSR':['苏联','蘇聯'],'YUGOSLAVIA':['南斯拉夫','南斯拉夫'],'CZECHOSLOVAKIA':['捷克斯洛伐克','捷克斯洛伐克'],
 'BYELORUSSIAN SSR':['白俄罗斯苏维埃社会主义共和国','白俄羅斯蘇維埃社會主義共和國'],'UKRAINIAN SSR':['乌克兰苏维埃社会主义共和国','烏克蘭蘇維埃社會主義共和國'],
 'GERMAN DEMOCRATIC REPUBLIC':['德意志民主共和国','德意志民主共和國'],'GERMANY, FEDERAL REPUBLIC OF':['德意志联邦共和国','德意志聯邦共和國'],
 'DEMOCRATIC YEMEN':['民主也门','民主葉門'],'SOUTHERN YEMEN':['南也门','南葉門'],'SERBIA AND MONTENEGRO':['塞尔维亚和黑山','塞爾維亞與蒙特內哥羅'],
 'TANGANYIKA':['坦噶尼喀','坦噶尼喀'],'ZANZIBAR':['桑给巴尔','桑給巴爾'],'CEYLON':['锡兰','錫蘭'],'UPPER VOLTA':['上沃尔特','上沃爾特'],
 'DAHOMEY':['达荷美','達荷美'],'KHMER REPUBLIC':['高棉共和国','高棉共和國'],'DEMOCRATIC KAMPUCHEA':['民主柬埔寨','民主柬埔寨'],
 'BURMA':['缅甸','緬甸'],'IVORY COAST':['象牙海岸','象牙海岸'],'SWAZILAND':['斯威士兰','斯威士蘭'],'ZAIRE':['扎伊尔','扎伊爾'],
 'CENTRAL AFRICAN EMPIRE':['中非帝国','中非帝國'],'UNITED ARAB REPUBLIC':['阿拉伯联合共和国','阿拉伯聯合共和國'],
 'LIBYAN ARAB REPUBLIC':['阿拉伯利比亚共和国','阿拉伯利比亞共和國'],'LIBYAN ARAB JAMAHIRIYA':['阿拉伯利比亚民众国','阿拉伯利比亞民眾國'],
 'CONGO (LEOPOLDVILLE)':['刚果（利奥波德维尔）','剛果（利奧波德維爾）'],'CONGO (BRAZZAVILLE)':['刚果（布拉柴维尔）','剛果（布拉柴維爾）'],
 'FEDERATION OF MALAYA':['马来亚联合邦','馬來亞聯合邦'],'SIAM':['暹罗','暹羅'],'UNION OF SOUTH AFRICA':['南非联邦','南非聯邦'],
 'THE FORMER YUGOSLAV REPUBLIC OF MACEDONIA':['前南斯拉夫的马其顿共和国','前南斯拉夫的馬其頓共和國'],
 'UNITED REPUBLIC OF CAMEROON':['喀麦隆联合共和国','喀麥隆聯合共和國'],'PHILIPPINE REPUBLIC':['菲律宾共和国','菲律賓共和國'],
 'MALDIVE ISLANDS':['马尔代夫群岛','馬爾地夫群島'],'CZECH REPUBLIC':['捷克共和国','捷克共和國'],
 'SAINT CHRISTOPHER AND NEVIS':['圣克里斯托弗和尼维斯','聖克里斯多福及尼維斯']
};
function seatName(code,record=voteRecords.get(activeVote)){
 const raw=record?.memberNames?.[code]||memberAtlas.profiles[record?.roster]?.[code]||memberAtlas.defaults[code]||code;
 const old=periodNames[raw],f=voteMembers.get(code);
 if(old&&lang.startsWith('zh'))return old[lang==='zh-Hant'?1:0];
 if(lang==='en'||old||!f)return raw==='USSR'?raw:raw.toLowerCase().replace(/(^|[ (,-])\p{L}/gu,ch=>ch.toUpperCase()).replace(/\bSsr\b/g,'SSR');
 return countryName(f);
}
// Modern land outlines are keyed to the seat named on this roll call.
// Ukraine and Belarus had distinct UN seats, including during the Soviet era.
const sovietParts=new Set('RUS ARM AZE GEO KAZ KGZ MDA TJK TKM UZB EST LVA LTU'.split(' '));
const yugoslavParts={SVN:'1991-06-25',HRV:'1991-10-08',MKD:'1991-11-17',BIH:'1992-03-06'};
function landSeat(code,date){
 if(votingChoices.has(code))return code;
 if(votingChoices.has('SUN')&&sovietParts.has(code))return 'SUN';
 if(votingChoices.has('CSK')&&['CZE','SVK'].includes(code))return 'CSK';
 if(votingChoices.has('YUG')&&date<yugoslavParts[code])return 'YUG';
 if(['SRB','MNE','KOS'].includes(code)){
  if(votingChoices.has('SCG'))return 'SCG';
  if(votingChoices.has('YUG'))return 'YUG';
 }
 if(code==='SSD'&&date<'2011-07-09'&&votingChoices.has('SDN'))return 'SDN';
 if(code==='BGD'&&date>='1947-08-14'&&date<'1971-12-16'&&votingChoices.has('PAK'))return 'PAK';
 if(code==='ERI'&&date>='1952-09-15'&&date<'1993-05-24'&&votingChoices.has('ETH'))return 'ETH';
 if(code==='SYR'&&date>='1958-02-22'&&date<'1961-09-29'&&votingChoices.has('EGY'))return 'EGY';
 return code;
}
function historicalSeatMap(){return (voteRecords.get(activeVote)?.date||'9999')<'2015-01-01'}
