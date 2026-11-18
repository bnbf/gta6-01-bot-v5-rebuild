// save.js: localStorage save/load + autosave.
import { CFG } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash, hp: G.hp, score: G.score, missionIdx: G.missionIdx,
      wanted: G.wanted, x: G.player.x, y: G.player.y,
      ammo: G.player.ammo, weapon: G.player.weapon,
      upgrades: G.upgrades, nos: G.nos, time: G.time,
      stats: G.stats, owned: G.player.owned || {},
    };
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
export function loadGame(G) {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    G.cash = d.cash; G.hp = d.hp; G.score = d.score; G.missionIdx = d.missionIdx;
    G.wanted = d.wanted || 0; G.player.x = d.x; G.player.y = d.y;
    Object.assign(G.player.ammo, d.ammo || {});
    G.player.weapon = d.weapon || 'pistol';
    G.upgrades = d.upgrades || G.upgrades; G.nos = d.nos ?? 2; G.time = d.time ?? 18.67;
    G.stats = d.stats || G.stats; G.player.owned = d.owned || {};
    return true;
  } catch { return false; }
}
export function hasSave() {
  try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch { return false; }
}
