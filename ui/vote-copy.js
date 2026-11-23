'use strict';
const voteLanguages={
 'zh-Hans':'联合国投票地图|决议|赞成|反对|弃权|未投票|无表决记录|选择国家|表决记录|决议原文',
 'zh-Hant':'聯合國投票地圖|決議|贊成|反對|棄權|未投票|無表決紀錄|選擇國家|表決紀錄|決議原文',
 en:'UN voting map|Resolution|Yes|No|Abstained|Did not vote|No voting record|Choose a country|Voting record|Resolution text',
 es:'Mapa de votación de la ONU|Resolución|A favor|En contra|Abstención|Sin voto|Sin registro|Elegir país|Registro de votación|Texto de la resolución',
 fr:'Carte des votes de l’ONU|Résolution|Pour|Contre|Abstention|Sans vote|Aucun enregistrement|Choisir un pays|Relevé du vote|Texte de la résolution',
 de:'UN-Abstimmungskarte|Resolution|Ja|Nein|Enthaltung|Nicht abgestimmt|Kein Eintrag|Land wählen|Abstimmungsergebnis|Resolutionstext',
 ja:'国連投票マップ|決議|賛成|反対|棄権|投票せず|記録なし|国を選択|投票記録|決議原文',
 ar:'خريطة التصويت الأممي|القرار|موافق|معارض|ممتنع|لم يصوت|لا يوجد سجل|اختر بلداً|سجل التصويت|نص القرار',
 arz:'خريطة تصويت الأمم المتحدة|القرار|موافق|رافض|ممتنع|ما صوّتش|مفيش سجل|اختار بلد|سجل التصويت|نص القرار',
 pt:'Mapa de votação da ONU|Resolução|A favor|Contra|Abstenção|Não votou|Sem registro|Escolher país|Registro de votação|Texto da resolução',
 ru:'Карта голосований ООН|Резолюция|За|Против|Воздержался|Не голосовал|Нет записи|Выбрать страну|Итоги голосования|Текст резолюции',
 hi:'संयुक्त राष्ट्र मतदान मानचित्र|प्रस्ताव|पक्ष में|विरुद्ध|मतदान से विरत|मत नहीं दिया|कोई रिकॉर्ड नहीं|देश चुनें|मतदान रिकॉर्ड|प्रस्ताव का पाठ',
 bn:'জাতিসংঘের ভোট মানচিত্র|প্রস্তাব|পক্ষে|বিপক্ষে|বিরত|ভোট দেয়নি|রেকর্ড নেই|দেশ নির্বাচন|ভোটের রেকর্ড|প্রস্তাবের পাঠ',
 id:'Peta pemungutan suara PBB|Resolusi|Setuju|Menolak|Abstain|Tidak memilih|Tidak ada catatan|Pilih negara|Catatan suara|Teks resolusi',
 ur:'اقوام متحدہ کا ووٹنگ نقشہ|قرارداد|حق میں|مخالفت میں|ممتنع|ووٹ نہیں دیا|کوئی ریکارڈ نہیں|ملک منتخب کریں|ووٹنگ ریکارڈ|قرارداد کا متن',
 pcm:'UN voting map|Resolution|Yes|No|Abstain|No vote|No record|Choose country|Voting record|Resolution text',
 mr:'संयुक्त राष्ट्र मतदान नकाशा|ठराव|बाजूने|विरुद्ध|तटस्थ|मत दिले नाही|नोंद नाही|देश निवडा|मतदानाची नोंद|ठरावाचा मजकूर',
 vi:'Bản đồ bỏ phiếu Liên Hợp Quốc|Nghị quyết|Tán thành|Phản đối|Bỏ phiếu trắng|Không bỏ phiếu|Không có hồ sơ|Chọn quốc gia|Biên bản biểu quyết|Văn bản nghị quyết',
 te:'ఐక్యరాజ్యసమితి ఓటింగ్ పటం|తీర్మానం|అనుకూలం|వ్యతిరేకం|తటస్థం|ఓటు వేయలేదు|నమోదు లేదు|దేశాన్ని ఎంచుకోండి|ఓటింగ్ రికార్డు|తీర్మాన పాఠం',
 sw:'Ramani ya kura za Umoja wa Mataifa|Azimio|Ndiyo|Hapana|Imejizuia|Haikupiga kura|Hakuna rekodi|Chagua nchi|Rekodi ya kura|Matini ya azimio',
 tr:'BM oylama haritası|Karar|Evet|Hayır|Çekimser|Oy kullanmadı|Kayıt yok|Ülke seçin|Oylama kaydı|Karar metni'
};
const voteKeys='voteMap resolution voteYes voteNo voteAbstain voteAbsent voteMissing voteCountry voteRecord voteText'.split(' ');
for(const [locale,line] of Object.entries(voteLanguages)){
 const labels=line.split('|');voteKeys.forEach((key,i)=>dictionaries[locale][key]=labels[i]);
}

const voteHistoryLabels={
 'zh-Hans':'历史记录|最近看过|历次表决|显示更多','zh-Hant':'歷史紀錄|最近看過|歷次表決|顯示更多',
 en:'History|Recently viewed|Past votes|Show more',es:'Historial|Vistos recientemente|Votaciones anteriores|Ver más',
 fr:'Historique|Consultations récentes|Votes passés|Afficher plus',de:'Verlauf|Zuletzt angesehen|Frühere Abstimmungen|Mehr anzeigen',
 ja:'履歴|最近見た決議|過去の採決|さらに表示',ar:'السجل|شوهد مؤخرًا|التصويتات السابقة|عرض المزيد',arz:'السجل|اتشافت قريب|التصويتات اللي فاتت|عرض أكتر',
 pt:'Histórico|Vistos recentemente|Votações anteriores|Ver mais',ru:'История|Недавно просмотренные|Прошлые голосования|Показать ещё',
 hi:'इतिहास|हाल ही में देखे गए|पिछले मतदान|और दिखाएँ',bn:'ইতিহাস|সম্প্রতি দেখা|আগের ভোট|আরও দেখুন',
 id:'Riwayat|Baru dilihat|Pemungutan suara terdahulu|Tampilkan lagi',ur:'تاریخچہ|حال ہی میں دیکھے گئے|سابقہ ووٹنگ|مزید دکھائیں',
 pcm:'History|Wetin you don view|Past votes|Show more',mr:'इतिहास|अलीकडे पाहिलेले|पूर्वीचे मतदान|आणखी दाखवा',
 vi:'Lịch sử|Đã xem gần đây|Các lần biểu quyết|Xem thêm',te:'చరిత్ర|ఇటీవల చూసినవి|గత ఓట్లు|మరిన్ని చూపించు',
 sw:'Historia|Zilizotazamwa karibuni|Kura za awali|Onyesha zaidi',tr:'Geçmiş|Son görüntülenenler|Geçmiş oylamalar|Daha fazla göster'
};
for(const [locale,line] of Object.entries(voteHistoryLabels)){
 const [voteHistory,voteVisits,voteArchive,voteMore]=line.split('|');
 Object.assign(dictionaries[locale],{voteHistory,voteVisits,voteArchive,voteMore});
}


