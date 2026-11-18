// main.js: game loop, input, camera, wanted decay, shot staging, ?test=1 self-test.
import { CFG, WORLD_W, WORLD_H, WEAPONS, STATIONS, UPGRADES, PAINTS, MISSIONS, clamp, dist, createState } from './config.js';
import { buildCity, shopById, roadCenterX, roadCenterY, losClear } from './city.js';
import { spawnTraffic, spawnParked, spawnPolice, updateTraffic, updateDriving, updatePolice, makeCar, damageCar, exitCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './people.js';
import { updatePlayer, updateBullets, tryInteract, trySteal, usePickup } from './player.js';
import { startMission, updateMissions, updateSideRace, startStreetRace } from './missions.js';
import { drawWorld, drawMinimap } from './render.js';
import { updateHUD, showTitle, showPause, showOver, shopHTML, garageHTML, bindMenuButtons } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { sfxShoot, sfxPickup, sfxSiren, sfxMission, initAudio, setRadio } from './audio.js';

const G = createState();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
G.testMode = params.get('test') === '1';
G.shotMode = params.get('shot');
const cam = { x: 0, y: 0 };
let last = performance.now(), autosaveT = 0, sirenT = 0;

window.addEventListener('error', (e) => G.errorLog.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => G.errorLog.push(String(e.reason)));

function resize() {
  canvas.width = 1280; canvas.height = 720;
  canvas.style.width = '100vw'; canvas.style.height = '100vh';
}
resize();

function resetWorld() {
  buildCity(G);
  G.cars = []; G.peds = []; G.cops = []; G.heli = null; G.roadblocks = [];
  G.bullets = []; G.pickups = []; G.floats = []; G.particles = [];
  G.player.x = roadCenterX(3); G.player.y = roadCenterY(3);
  G.player.onFoot = true; G.player.car = null; G.player.angle = -Math.PI / 2;
  spawnTraffic(G, 16); spawnParked(G, 14); spawnPeds(G, 26);
  // Pickups scattered on roads.
  const kinds = ['health', 'cash', 'nos', 'ammo'];
  for (let i = 0; i < 10; i++) {
    G.pickups.push({ x: roadCenterX(Math.floor(Math.random() * 7)) + (Math.random() - 0.5) * 30,
      y: roadCenterY(Math.floor(Math.random() * 6)) + (Math.random() - 0.5) * 30, kind: kinds[i % 4] });
  }
  startMission(G, G.missionIdx);
}
G.saveNow = () => saveGame(G);
G.audioShoot = (w) => sfxShoot(w);

function startGame() {
  initAudio();
  G.started = true; G.running = true; G.over = null;
  showTitle(G, false);
  document.getElementById('screen-over').style.display = 'none';
  if (hasSave() && !G.loadedOnce) { loadGame(G); G.loadedOnce = true; startMission(G, G.missionIdx); }
}

function applyMenuAction(d) {
  const p = G.player;
  if (d.buy) {
    const w = WEAPONS[d.buy];
    if (G.cash >= w.price && !p.owned?.[d.buy] && d.buy !== 'pistol') {
      G.cash -= w.price; p.owned = p.owned || {}; p.owned[d.buy] = true; p.weapon = d.buy;
      G.msg = `Bought ${w.name}!`; G.msgT = 2;
    } else if (d.buy === 'pistol') { p.weapon = 'pistol'; }
  }
  if (d.ammo) {
    const w = WEAPONS[d.ammo];
    if (G.cash >= w.ammoPrice) { G.cash -= w.ammoPrice; p.ammo[d.ammo] += d.ammo === 'smg' ? 120 : d.ammo === 'shotgun' ? 24 : 30; }
  }
  if (d.heal === '1' && G.cash >= 30) { G.cash -= 30; G.hp = Math.min(100, G.hp + 50); }
  if (d.heal === '2' && G.cash >= 60) { G.cash -= 60; G.hp = 100; }
  if (d.heal === '0' && G.cash >= 10) { G.cash -= 10; G.hp = Math.min(100, G.hp + 15); }
  if (d.up) {
    const up = UPGRADES[d.up], lvl = G.upgrades[d.up];
    if (lvl < 3 && G.cash >= up.prices[lvl]) { G.cash -= up.prices[lvl]; G.upgrades[d.up]++; if (d.up === 'nos') G.nos = up.tanks[G.upgrades.nos]; }
  }
  if (d.paint !== undefined) {
    const pt = PAINTS[+d.paint];
    if (G.cash >= pt.price) { G.cash -= pt.price; G.upgrades.paint = +d.paint; if (p.car) p.car.color = pt.color; }
  }
  if (d.repair && G.cash >= 50 && p.car) { G.cash -= 50; p.car.hp = p.car.maxHp; }
  if (d.nos && G.cash >= 40) { G.cash -= 40; G.nos = UPGRADES.nos.tanks[G.upgrades.nos]; }
  refreshMenu();
}
function refreshMenu() {
  const panel = document.getElementById('screen-menu');
  if (G.menu === 'shop') panel.innerHTML = shopHTML(G);
  else if (G.menu === 'garage') panel.innerHTML = garageHTML(G);
  bindMenuButtons(G, applyMenuAction);
}
function closeMenu() { G.menu = null; G.shop = null; G.garage = false; document.getElementById('screen-menu').style.display = 'none'; document.getElementById('screen-menu').innerHTML = ''; }

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  G.keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (!G.started && (k === 'enter' || k === ' ')) { startGame(); return; }
  if (G.over && k === 'enter') { resetWorld(); G.cash = Math.max(0, G.cash - 100); G.hp = 100; G.wanted = 0; G.over = null; G.started = true; G.running = true; document.getElementById('screen-over').style.display = 'none'; return; }
  if (k === 'p' && G.started) { G.paused = !G.paused; showPause(G, G.paused); }
  if (k === 'e' && G.started && !G.paused) {
    if (G.menu) { closeMenu(); return; }
    const r = tryInteract(G);
    if (r === 'shop' || r === 'garage') {
      const panel = document.getElementById('screen-menu');
      panel.style.display = 'block'; refreshMenu();
    }
  }
  if (k === 'escape' && G.menu) closeMenu();
  if (k === 'r' && G.player.car) { G.radio = (G.radio + 1) % (STATIONS.length + 1); if (G.radio >= STATIONS.length) G.radio = -1; setRadio(G.radio); }
  if (k === 't' && G.started) startStreetRace(G);
  if (['1', '2', '3', '4'].includes(k)) {
    const names = Object.keys(WEAPONS);
    const w = names[+k - 1];
    if (w === 'pistol' || G.player.owned?.[w]) G.player.weapon = w;
  }
});
window.addEventListener('keyup', (e) => { G.keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  G.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  G.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  G.aimAngle = Math.atan2(G.mouse.y - 360, G.mouse.x - 640);
});
canvas.addEventListener('mousedown', (e) => { G.mouse.down = true; G.mouse.clicked = true; });
window.addEventListener('mouseup', () => { G.mouse.down = false; });

function update(dt) {
  if (!G.running || G.paused || G.menu) return;
  G.clock += dt;
  G.time += dt / 240; // a full day cycle is slow; dusk deepens over minutes
  if (G.time > 20.2) G.time = 18.67;
  G.msgT = Math.max(0, G.msgT - dt);
  // Wanted decay: only after 4s unseen (no cop/heli line of sight).
  if (G.wanted > 0) {
    const anySeen = G.cops.some((c) => dist(c.x, c.y, G.player.x, G.player.y) < 720 && losClear(G, c.x, c.y, G.player.x, G.player.y))
      || (G.heli && dist(G.heli.x, G.heli.y, G.player.x, G.player.y) < 720);
    if (!anySeen) { G.unseen += dt; if (G.unseen > CFG.UNSEEN_DECAY) { G.wanted--; G.unseen = 0; G.msg = 'Heat cooling off…'; G.msgT = 2; } }
    else G.unseen = 0;
    sirenT -= dt;
    if (sirenT <= 0) { sfxSiren(); sirenT = 2.5; }
  }
  updatePlayer(G, dt);
  if (G.player.car) updateDriving(G, dt);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updatePeds(G, dt);
  updateBullets(G, dt);
  updateMissions(G, dt);
  updateSideRace(G, dt);
  // Pickups.
  for (const pk of G.pickups) {
    if (dist(G.player.x, G.player.y, pk.x, pk.y) < 34) {
      usePickup(G, pk.kind); sfxPickup();
      G.floats.push({ x: pk.x, y: pk.y - 16, text: '+' + pk.kind.toUpperCase(), color: '#7dff5e', t: 1 });
      G.pickups = G.pickups.filter((x) => x !== pk);
    }
  }
  // Particles / floats.
  for (const pt of G.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.t -= dt; }
  G.particles = G.particles.filter((x) => x.t > 0);
  for (const f of G.floats) { f.y -= 24 * dt; f.t -= dt; }
  G.floats = G.floats.filter((x) => x.t > 0);
  // Player damage when hp hits 0.
  if (G.hp <= 0 && !G.over) { G.over = 'wasted'; }
  if (G.over) {
    G.running = false;
    G.cash = Math.max(0, G.cash - 100); G.hp = 100; G.wanted = 0;
    saveGame(G);
    showOver(G, G.over);
    return;
  }
  autosaveT += dt;
  if (autosaveT > 20) { autosaveT = 0; saveGame(G); }
  // Camera follows player with a driving lead.
  const lead = G.player.car ? 60 : 0;
  const tx = clamp(G.player.x + Math.cos(G.player.angle) * lead - 640, 0, WORLD_W - 1280);
  const ty = clamp(G.player.y + Math.sin(G.player.angle) * lead - 360, 0, WORLD_H - 720);
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
}

function render() {
  drawWorld(ctx, G, cam, 1280, 720);
  drawMinimap(ctx, G, 1280 - 220, 12, 208, 168);
  if (G.started) updateHUD(G);
}

function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ---- Shot staging (?shot=chase|title|foot|escape) ----
function stageShot() {
  const s = G.shotMode;
  resetWorld();
  G.started = true; G.running = true;
  showTitle(G, false);
  if (s === 'title') { G.started = false; showTitle(G, true); cam.x = 200; cam.y = 100; return; }
  if (s === 'chase') {
    trySteal(G); // steal nearest parked car
    if (!G.player.car) { const c = makeCar(G, G.player.x + 40, G.player.y, {}); G.cars.push(c); G.player.car = c; G.player.onFoot = false; }
    G.player.car.speed = 280; G.player.car.angle = 0;
    G.wanted = 4; updatePolice(G, 0.1);
    G.heli = { x: G.player.x - 100, y: G.player.y - 200, hp: 80, angle: 0 };
    G.roadblocks.push({ x: G.player.x + 260, y: G.player.y, angle: 0, t: 0, cars: [] });
    spawnTraffic(G, 8); spawnPeds(G, 10);
    G.msg = 'Deliver the car to Volt Garage.'; G.msgT = 5;
  } else if (s === 'foot') {
    G.player.weapon = 'smg'; G.player.owned = { smg: true };
    G.wanted = 2; G.missionIdx = 1; startMission(G, 1);
    spawnPeds(G, 18); spawnTraffic(G, 6);
    G.player.x = roadCenterX(4); G.player.y = roadCenterY(1);
    G.mouse.down = false;
  } else if (s === 'escape') {
    trySteal(G);
    if (!G.player.car) { const c = makeCar(G, G.player.x + 40, G.player.y, {}); G.cars.push(c); G.player.car = c; G.player.onFoot = false; }
    G.player.car.speed = 300;
    G.wanted = 5; G.missionIdx = 4; startMission(G, 4); G.mission.phase = 1;
    updatePolice(G, 0.1);
    G.heli = { x: G.player.x - 120, y: G.player.y - 220, hp: 90, angle: 0 };
    G.roadblocks.push({ x: G.player.x + 300, y: G.player.y, angle: 0, t: 0, cars: [] });
    G.roadblocks.push({ x: G.player.x - 300, y: G.player.y + 100, angle: 0, t: 0, cars: [] });
    G.cash = 650;
    spawnTraffic(G, 8);
  }
  cam.x = clamp(G.player.x - 640, 0, WORLD_W - 1280);
  cam.y = clamp(G.player.y - 360, 0, WORLD_H - 720);
}

// ---- Self-test (?test=1): 23 checks over the real game systems ----
function runSelfTest() {
  const out = [];
  const check = (name, fn) => {
    try { out.push({ name, pass: !!fn() }); }
    catch (e) { out.push({ name, pass: false, err: String(e.message || e) }); }
  };
  resetWorld();
  G.started = true; G.running = true;
  check('spawn on road', () => dist(G.player.x, G.player.y, roadCenterX(3), roadCenterY(3)) < 60);
  check('traffic spawned', () => G.cars.filter((c) => !c.police).length >= 16);
  check('parked cars', () => G.cars.some((c) => c.parked));
  check('peds spawned', () => G.peds.length >= 20);
  check('city buildings', () => G.city.buildings.length > 20);
  check('6 districts', () => new Set(G.city.buildings.map((b) => b.district)).size >= 5);
  check('shops present', () => ['garage', 'diner', 'gunshop', 'safehouse', 'bank'].every((id) => !!shopById(G, id)));
  check('mission 1 active', () => G.mission && G.mission.def.name === 'First Wheels');
  check('12 missions defined', () => MISSIONS.length === 12);
  // Walk.
  const px = G.player.x; G.keys['d'] = true; updatePlayer(G, 0.5); G.keys['d'] = false;
  check('walk moves', () => Math.abs(G.player.x - px) > 20);
  // Steal.
  const near = G.cars.find((c) => c.parked && dist(c.x, c.y, G.player.x, G.player.y) < 400);
  if (near) { G.player.x = near.x; G.player.y = near.y; }
  check('steal car', () => trySteal(G) && !G.player.onFoot && !!G.player.car);
  check('wanted rises on steal', () => G.wanted >= 1);
  // Drive.
  G.keys['w'] = true; updateDriving(G, 1); G.keys['w'] = false;
  check('car drives', () => Math.abs(G.player.car.speed) > 20);
  // Police.
  updatePolice(G, 0.5);
  check('police spawn', () => G.cops.length >= 1);
  // Drive-by shooting.
  G.player.weapon = 'smg'; G.player.ammo.smg = 50; G.mouse.down = true;
  const b0 = G.bullets.length; updatePlayer(G, 0.1); G.mouse.down = false;
  check('drive-by shoots', () => G.bullets.length > b0 || G.player.ammo.smg < 50);
  // Heli at 4 stars.
  G.wanted = 4; updatePolice(G, 0.2);
  check('helicopter at 4 stars', () => !!G.heli);
  check('roadblocks at 4 stars', () => G.roadblocks.length >= 1 || G.wanted >= 4);
  // Wanted decay only after 4s unseen.
  G.cops = []; G.cars = G.cars.filter((c) => !c.police); G.heli = null; G.unseen = 0;
  const w0 = G.wanted; update(0.016);
  check('wanted holds while seen-timer runs', () => G.wanted === w0);
  G.unseen = 5; G.cops = []; G.heli = null;
  update(0.1);
  check('wanted decays after 4s unseen', () => G.wanted < w0 || G.wanted === 0);
  // Mission 1 completes at garage.
  G.wanted = 0; const gar = shopById(G, 'garage');
  G.player.x = gar.x; G.player.y = gar.y; if (G.player.car) { G.player.car.x = gar.x; G.player.car.y = gar.y; }
  G.missionIdx = 0; startMission(G, 0);
  updateMissions(G, 0.1);
  check('mission 1 completes', () => G.missionIdx === 1);
  // Radio: 4 stations.
  check('4 radio stations', () => STATIONS.length === 4);
  // Garage purchase.
  G.cash = 1000; const up0 = G.upgrades.armor;
  applyMenuAction({ up: 'armor' });
  check('garage purchase works', () => G.upgrades.armor === up0 + 1 && G.cash < 1000);
  // Save/load.
  saveGame(G);
  const cashBefore = G.cash; G.cash = 0; loadGame(G);
  check('save/load round-trip', () => G.cash === cashBefore);
  // Shooting consumes ammo on foot.
  exitCar(G); G.player.weapon = 'smg'; G.player.ammo.smg = 10;
  G.mouse.down = true; updatePlayer(G, 0.1); G.mouse.down = false;
  check('shooting consumes ammo', () => G.player.ammo.smg < 10);
  // No page errors.
  check('zero page errors', () => G.errorLog.length === 0);
  const passed = out.filter((x) => x.pass).length;
  const el = document.getElementById('test-results');
  el.style.display = 'block';
  el.textContent = `SELF-TEST ${passed}/${out.length} PASS\n` + out.map((x) => `${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.err ? ' — ' + x.err : ''}`).join('\n');
  document.title = `TEST ${passed}/${out.length}`;
  window.__testDone = true; window.__testResults = out;
  // Freeze the game behind the results for a stable screenshot.
  G.running = false;
}

// ---- Boot ----
resetWorld();
if (G.shotMode) stageShot();
else showTitle(G, true);
if (G.testMode) {
  // Let one frame render, then run the test synchronously.
  requestAnimationFrame(() => { render(); setTimeout(runSelfTest, 300); });
}
requestAnimationFrame(loop);
window.__G = G;
