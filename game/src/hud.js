// hud.js: HUD DOM updates, title / pause / busted / wasted screens, shop + garage menus.
import { WEAPONS, STATIONS, UPGRADES, PAINTS, MISSIONS, rankFor } from './config.js';
import { districtAt } from './city.js';
import { missionObjective } from './missions.js';

const $ = (id) => document.getElementById(id);
export function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

export function updateHUD(G) {
  const p = G.player;
  $('hud-cash').textContent = '$' + Math.floor(G.cash);
  $('hud-hp').style.width = Math.max(0, G.hp) + '%';
  $('hud-hp-text').textContent = 'HP ' + Math.max(0, Math.ceil(G.hp));
  const w = WEAPONS[p.weapon];
  $('hud-weapon').textContent = w.name + ' ' + (p.ammo[p.weapon] === Infinity ? '∞' : p.ammo[p.weapon]) + ' / ∞';
  $('hud-speed').textContent = Math.abs(Math.round((p.car ? p.car.speed : p.speed || 0) * 0.22)) + ' mph';
  $('hud-wanted').textContent = stars(G.wanted);
  $('hud-wanted').style.color = G.wanted >= 4 ? '#ff2e2e' : G.wanted > 0 ? '#ffd23e' : '#666';
  $('hud-clock').textContent = fmtTime(G.time);
  $('hud-rank').textContent = rankFor(G.score) + ' · ' + G.score + ' pts';
  $('hud-district').textContent = districtAt(p.x, p.y).name;
  $('hud-radio').textContent = 'Radio: ' + (G.radio >= 0 ? STATIONS[G.radio].name : 'off — press R in a car');
  $('hud-weapons').innerHTML = Object.keys(WEAPONS).map((k, i) =>
    `<span class="${k === p.weapon ? 'w-sel' : ''}">${i + 1} ${WEAPONS[k].name}</span>`).join(' · ');
  const car = p.car;
  $('hud-car').textContent = car ? `Car HP ${Math.ceil(car.hp)}  NOS ${G.nos.toFixed(1)}` : '';
  $('hud-objective').textContent = missionObjective(G);
  $('hud-mission').textContent = G.mission ? `MISSION ${G.mission.idx + 1}/12 — ${G.mission.def.name}` : 'FREE ROAM';
  if (G.msgT > 0) { $('hud-msg').textContent = G.msg; $('hud-msg').style.opacity = 1; }
  else $('hud-msg').style.opacity = 0;
}
export function fmtTime(t) {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function showTitle(G, on) {
  $('screen-title').style.display = on ? 'flex' : 'none';
}
export function showPause(G, on) { $('screen-pause').style.display = on ? 'flex' : 'none'; }
export function showOver(G, kind) {
  const el = $('screen-over');
  el.style.display = 'flex';
  $('over-title').textContent = kind === 'busted' ? 'BUSTED!' : 'WASTED!';
  $('over-sub').textContent = kind === 'busted'
    ? 'The Lumen Bay PD caught you. You paid $100 bail and lost your heat.'
    : 'You got taken down. The clinic patched you up for $100.';
  $('over-stats').textContent = `Cash $${Math.floor(G.cash)} · Score ${G.score} · Missions ${G.missionIdx}/12`;
}

export function shopHTML(G) {
  const s = G.shop; if (!s) return '';
  let rows = '';
  if (s.kind === 'gun') {
    for (const [k, w] of Object.entries(WEAPONS)) {
      const owned = G.player.ammo[k] !== undefined && (k === 'pistol' || G.player.owned?.[k]);
      rows += `<div class="row"><span>${w.name} — ${w.dmg} dmg</span><span>$${w.price} / ammo $${w.ammoPrice}</span>
        <button data-buy="${k}">BUY</button><button data-ammo="${k}">AMMO</button></div>`;
    }
  } else if (s.kind === 'diner') {
    rows = `<div class="row"><span>Neon Meal — heal +50 HP</span><span>$30</span><button data-heal="1">EAT</button></div>`;
  } else if (s.kind === 'clinic') {
    rows = `<div class="row"><span>Full treatment — heal to 100 HP</span><span>$60</span><button data-heal="2">HEAL</button></div>`;
  } else {
    rows = `<div class="row"><span>${s.name} — snacks +$20 cash pickups nearby</span><span>$10</span><button data-heal="0">SNACK</button></div>`;
  }
  return `<h2>${s.name}</h2><p>Cash: $${Math.floor(G.cash)} — press E or ESC to leave</p>${rows}`;
}

export function garageHTML(G) {
  const u = G.upgrades;
  let rows = '';
  for (const [key, up] of Object.entries(UPGRADES)) {
    const lvl = u[key];
    const next = lvl < 3 ? `$${up.prices[lvl]} — buy tier ${lvl + 1}` : 'MAXED';
    rows += `<div class="row"><span>${up.name} — tier ${lvl}/3</span><span>${next}</span><button data-up="${key}">UPGRADE</button></div>`;
  }
  rows += '<div class="row"><span>Paint</span><span>—</span><span></span></div>';
  for (const [i, pt] of PAINTS.entries()) {
    rows += `<div class="row"><span style="color:${pt.color}">■ ${pt.name}</span><span>$${pt.price}</span><button data-paint="${i}">PAINT</button></div>`;
  }
  rows += `<div class="row"><span>Repair car (full HP)</span><span>$50</span><button data-repair="1">REPAIR</button></div>`;
  rows += `<div class="row"><span>Refill NOS tanks</span><span>$40</span><button data-nos="1">NOS</button></div>`;
  return `<h2>VOLT GARAGE — Upgrades</h2><p>Cash: $${Math.floor(G.cash)} — press E or ESC to leave</p>${rows}`;
}

export function bindMenuButtons(G, apply) {
  const panel = $('screen-menu');
  panel.querySelectorAll('button').forEach((b) => {
    b.onclick = () => apply(b.dataset);
  });
}
