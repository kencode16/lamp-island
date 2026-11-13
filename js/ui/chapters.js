// 章節資料與分組（擁有者：D 介面）。
// 關卡依 LEVELS[i].chapter 分組（沒有＝第 1 章）；第 n 章在「第 n-1 章最後一關過關」後開放。

export const CHAPTERS = [
  { id: 1, name: '第一章', title: '航海圖', tip: '選一座小島出航', theme: 'island' },
  { id: 2, name: '第二章', title: '地底洞窟', tip: '提著燈走進黑暗', theme: 'cave', lockText: '打倒夜之君主後開放' },
];

export const chapterOf = lv => (lv && Number(lv.chapter)) || 1;

export function chapterDef(ch) {
  return CHAPTERS.find(c => c.id === ch) || { id: ch, name: `第 ${ch} 章`, title: `第 ${ch} 章`, tip: '', theme: 'island' };
}

/** 某章的關卡（依 id 排序） */
export function chapterLevels(levels, ch) {
  return (levels || []).filter(l => chapterOf(l) === ch).sort((a, b) => a.id - b.id);
}

/** 某章最後一關的 id；關卡資料裡沒有這章時用「每章 10 關」推算 */
export function lastLevelOf(levels, ch) {
  const list = chapterLevels(levels, ch);
  return list.length ? list[list.length - 1].id : ch * 10;
}

/** 第 ch 章是否開放（第 1 章永遠開放） */
export function isChapterUnlocked(p, ch, levels) {
  if (ch <= 1) return true;
  return (p?.stars?.[lastLevelOf(levels, ch - 1)] || 0) >= 1;
}
