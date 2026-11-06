// 關卡地圖的備用資料（擁有者：D 介面）。
// 正式資料在 js/data/levels.js（F 負責）；ui.js 會動態 import，讀不到時才用這份（只有地圖要用的欄位）。

const W = n => Array.from({ length: n }, () => ({ groups: [] }));

export const FALLBACK_LEVELS = [
  { id: 1, name: '晨光碼頭', desc: '清晨的小碼頭，學會蓋塔、升級，守住第一盞燈。', env: { time: 'day', weather: 'clear' }, lamp: 20, waves: W(8) },
  { id: 2, name: '蘑菇林', desc: '巨大蘑菇之間冒出會分裂的史萊姆，流星雨登場。', env: { time: 'day', weather: 'clear' }, lamp: 20, waves: W(9) },
  { id: 3, name: '風車丘', desc: '黃昏的山丘上，穿盔甲的骷髏兵來了，請法師塔幫忙。', env: { time: 'dusk', weather: 'clear' }, lamp: 20, waves: W(10) },
  { id: 4, name: '雙橋河谷', desc: '雨中的河谷有兩條路線，學會用冰封爭取時間。', env: { time: 'day', weather: 'rain' }, lamp: 20, waves: W(10) },
  { id: 5, name: '史萊姆王沼澤', desc: '黃昏轉入夜，史萊姆王從沼澤深處現身。', env: { time: 'dusk', weather: 'clear' }, lamp: 20, waves: [...W(10), { groups: [], env: { time: 'night' } }] },
  { id: 6, name: '開闊牧場', desc: '第一次在開放草地自由蓋塔，用塔排出敵人的路。', env: { time: 'day', weather: 'clear' }, lamp: 20, waves: W(11) },
  { id: 7, name: '石林峽谷', desc: '濃霧籠罩的石林，厚重的魔像緩緩逼近。', env: { time: 'day', weather: 'fog' }, lamp: 20, waves: W(12) },
  { id: 8, name: '月下墓園', desc: '滿月下的墓園，成群的夜蝠與石像鬼從天而降。', env: { time: 'night', weather: 'clear' }, lamp: 20, waves: W(12) },
  { id: 9, name: '暴風岬角', desc: '暴風雨夜，敵人從好幾個入口同時湧入。', env: { time: 'night', weather: 'rain' }, lamp: 20, waves: W(14) },
  { id: 10, name: '夜之君主', desc: '日落之後，夜之君主親自前來熄滅最後的燈。', env: { time: 'dusk', weather: 'clear' }, lamp: 20, waves: [...W(14), { groups: [], env: { time: 'night' } }] },
];
