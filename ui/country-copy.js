'use strict';
const countryCopy={
 'zh-Hans':'国家概览|首都时间|近 24 小时的重要事件|外交部原文|即将举行的公开会议|窗口置顶|选择国家|暂无已接入的外交部来源|举办地',
 'zh-Hant':'國家概覽|首都時間|近 24 小時的重要事件|外交部原文|即將舉行的公開會議|視窗置頂|選擇國家|暫無已接入的外交部來源|舉辦地',
 en:'Country overview|Capital time|Top events in the last 24 hours|Foreign ministry statements|Upcoming public meetings|Always on top|Choose a country|No ministry source connected|Host venue',
 fr:'Aperçu du pays|Heure de la capitale|Faits marquants des dernières 24 h|Communiqués du ministère|Réunions publiques à venir|Toujours au premier plan|Choisir un pays|Aucune source ministérielle connectée|Lieu',
 es:'Resumen del país|Hora en la capital|Noticias destacadas de las últimas 24 h|Comunicados de Exteriores|Próximas reuniones públicas|Siempre visible|Elegir país|Sin fuente ministerial conectada|Sede',
 de:'Länderübersicht|Zeit in der Hauptstadt|Wichtige Ereignisse der letzten 24 Stunden|Mitteilungen des Außenministeriums|Anstehende öffentliche Sitzungen|Immer im Vordergrund|Land auswählen|Keine Ministeriumsquelle angebunden|Tagungsort',
 ja:'国別概要|首都の現地時刻|過去24時間の主な出来事|外務省の発表|今後の公開会合|常に手前に表示|国を選択|外務省の情報源は未登録です|開催地',
 pt:'Visão geral do país|Hora na capital|Destaques das últimas 24 h|Comunicados do ministério|Próximas reuniões públicas|Sempre visível|Escolher país|Sem fonte ministerial ligada|Local',
 ru:'Обзор страны|Время в столице|Главные события за 24 часа|Заявления МИД|Предстоящие открытые заседания|Поверх других окон|Выбрать страну|Источник МИД не подключён|Место проведения',
 ar:'نظرة عامة على البلد|توقيت العاصمة|أبرز أحداث آخر ٢٤ ساعة|بيانات وزارة الخارجية|الاجتماعات العامة المقبلة|تثبيت في المقدمة|اختر بلداً|لا يوجد مصدر مرتبط بالوزارة|مكان الاجتماع',
 hi:'देश का अवलोकन|राजधानी का समय|पिछले 24 घंटों की प्रमुख घटनाएँ|विदेश मंत्रालय के वक्तव्य|आगामी सार्वजनिक बैठकें|हमेशा ऊपर रखें|देश चुनें|मंत्रालय का कोई स्रोत नहीं जुड़ा है|आयोजन स्थल',
 bn:'দেশের সারসংক্ষেপ|রাজধানীর সময়|গত ২৪ ঘণ্টার প্রধান ঘটনা|পররাষ্ট্র মন্ত্রণালয়ের বিবৃতি|আসন্ন প্রকাশ্য সভা|সবার উপরে রাখুন|দেশ নির্বাচন করুন|মন্ত্রণালয়ের উৎস যুক্ত নেই|সভার স্থান',
 id:'Ringkasan negara|Waktu ibu kota|Peristiwa utama 24 jam terakhir|Pernyataan kementerian luar negeri|Pertemuan publik mendatang|Selalu di atas|Pilih negara|Belum ada sumber kementerian|Lokasi',
 ur:'ملکی جائزہ|دارالحکومت کا وقت|گزشتہ ۲۴ گھنٹوں کے اہم واقعات|وزارت خارجہ کے بیانات|آئندہ عوامی اجلاس|ہمیشہ سامنے رکھیں|ملک منتخب کریں|وزارت کا کوئی ذریعہ منسلک نہیں|مقام',
 mr:'देशाचा आढावा|राजधानीतील वेळ|गेल्या २४ तासांतील महत्त्वाच्या घटना|परराष्ट्र मंत्रालयाची निवेदने|आगामी सार्वजनिक बैठका|नेहमी वर ठेवा|देश निवडा|मंत्रालयाचा स्रोत जोडलेला नाही|ठिकाण',
 vi:'Tổng quan quốc gia|Giờ thủ đô|Sự kiện nổi bật trong 24 giờ|Thông cáo Bộ Ngoại giao|Các cuộc họp công khai sắp tới|Luôn ở trên cùng|Chọn quốc gia|Chưa kết nối nguồn Bộ Ngoại giao|Địa điểm',
 te:'దేశ అవలోకనం|రాజధాని సమయం|గత 24 గంటల ముఖ్య ఘటనలు|విదేశాంగ శాఖ ప్రకటనలు|రాబోయే బహిరంగ సమావేశాలు|ఎల్లప్పుడూ పైన ఉంచు|దేశాన్ని ఎంచుకోండి|మంత్రిత్వ శాఖ మూలం అందుబాటులో లేదు|వేదిక',
 sw:'Muhtasari wa nchi|Saa ya mji mkuu|Matukio muhimu ya saa 24|Taarifa za wizara ya mambo ya nje|Mikutano ya wazi ijayo|Weka juu daima|Chagua nchi|Hakuna chanzo cha wizara kilichounganishwa|Mahali',
 tr:'Ülke özeti|Başkent saati|Son 24 saatin önemli olayları|Dışişleri açıklamaları|Yaklaşan açık toplantılar|Her zaman üstte|Ülke seçin|Bakanlık kaynağı bağlı değil|Toplantı yeri',
 pcm:'Country overview|Time for capital|Big news for di last 24 hours|Foreign ministry statements|Public meetings wey dey come|Keep window on top|Choose country|No ministry source dey connected|Meeting place',
 arz:'نظرة على البلد|توقيت العاصمة|أهم أحداث آخر ٢٤ ساعة|بيانات وزارة الخارجية|الاجتماعات العامة الجاية|خلي الشباك في المقدمة|اختار بلد|مفيش مصدر متوصل بالوزارة|مكان الاجتماع'
};
const overviewKeys='countryOverview capitalTime countryEvents ministry upcoming pinWindow pickCountry noMinistry venue'.split(' ');
for(const [locale,line] of Object.entries(countryCopy)){
 const words=line.split('|');
 overviewKeys.forEach((key,i)=>dictionaries[locale][key]=words[i]);
}
