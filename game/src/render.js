// render.js: canvas world rendering — dusk-to-neon light, buildings, beach/sea, cars, peds,
// helicopter + spotlight, roadblocks, mission markers, minimap with district labels.
import { CFG, WORLD_W, WORLD_H, DISTRICTS, clamp, lerp } from './config.js';
import { districtAt, onRoad } from './city.js';

export function drawWorld(ctx, G, cam, vw, vh) {
  const night = clamp((G.time - 18.67) / 1.33, 0, 1); // 18:40 dusk -> 20:00 neon night
  const sky = lerpColor([0x2a, 0x1e, 0x3a], [0x0b, 0x0b, 0x1e], night);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, vw, vh);
  const x0 = Math.max(0, cam.x - 40), y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD_W, cam.x + vw + 40), y1 = Math.min(WORLD_H, cam.y + vh + 40);
  // Ground per district block.
  const step = CFG.BLOCK + CFG.ROAD;
  for (let r = 0; r < CFG.ROWS; r++) for (let c = 0; c < CFG.COLS; c++) {
    const bx = CFG.ROAD + c * step, by = CFG.ROAD + r * step;
    if (bx + CFG.BLOCK < x0 || bx > x1 || by + CFG.BLOCK < y0 || by > y1) continue;
    const d = districtAt(bx + 10, by + 10);
    ctx.fillStyle = shade(d.ground, night);
    ctx.fillRect(bx - cam.x, by - cam.y, CFG.BLOCK, CFG.BLOCK);
  }
  // Roads.
  ctx.fillStyle = '#14141f';
  for (let i = 0; i <= CFG.COLS; i++) ctx.fillRect(CFG.ROAD / 2 + i * step - CFG.ROAD / 2 - cam.x, -cam.y, CFG.ROAD, CFG.ROWS * step + CFG.ROAD);
  for (let i = 0; i <= CFG.ROWS; i++) ctx.fillRect(-cam.x, CFG.ROAD / 2 + i * step - CFG.ROAD / 2 - cam.y, CFG.COLS * step + CFG.ROAD, CFG.ROAD);
  // Road dashes.
  ctx.fillStyle = '#8a7a3a';
  for (let i = 0; i <= CFG.COLS; i++) {
    const rx = CFG.ROAD / 2 + i * step - CFG.ROAD / 2;
    for (let y = 0; y < CFG.ROWS * step; y += 34) ctx.fillRect(rx - 2 - cam.x, y + 8 - cam.y, 4, 18);
  }
  for (let i = 0; i <= CFG.ROWS; i++) {
    const ry = CFG.ROAD / 2 + i * step - CFG.ROAD / 2;
    for (let x = 0; x < CFG.COLS * step; x += 34) ctx.fillRect(x + 8 - cam.x, ry - 2 - cam.y, 18, 4);
  }
  // Beach + sea (south).
  const beachY = CFG.ROWS * step + CFG.ROAD;
  ctx.fillStyle = '#c9a86a'; ctx.fillRect(0 - cam.x, beachY - cam.y, WORLD_W, CFG.BEACH);
  ctx.fillStyle = '#0e3a5c'; ctx.fillRect(0 - cam.x, beachY + CFG.BEACH - cam.y, WORLD_W, CFG.SEA);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < WORLD_W; x += 90) ctx.fillRect(x - cam.x, beachY + CFG.BEACH + 12 + Math.sin(G.clock * 1.4 + x * 0.02) * 6 - cam.y, 60, 3);
  // Parks.
  for (const pk of G.city.parks) {
    ctx.fillStyle = '#1d3a24'; ctx.fillRect(pk.x - cam.x, pk.y - cam.y, pk.w, pk.h);
    ctx.strokeStyle = 'rgba(125,255,94,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pk.x + pk.w / 2 - cam.x, pk.y + pk.h / 2 - cam.y, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(232,182,76,0.5)'; ctx.font = 'bold 13px monospace';
    ctx.fillText(pk.district.toUpperCase(), pk.x + 12 - cam.x, pk.y + 24 - cam.y);
  }
  // Buildings.
  for (const b of G.city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = `hsl(${b.hue}, 38%, ${lerp(26, 16, night)}%)`;
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 4 - cam.x, b.y + b.h - 6 - cam.y, b.w - 8, 6);
    for (const w of b.windows) {
      ctx.fillStyle = w.lit ? (night > 0.4 ? '#ffd23e' : '#e8c96a') : '#0e0e18';
      ctx.fillRect(w.x - cam.x, w.y - cam.y, 9, 11);
    }
    if (b.neon) { ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 2; ctx.strokeRect(b.x - cam.x, b.y - cam.y, b.w, b.h); }
  }
  // Neon signs.
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  for (const s of G.city.signs) {
    ctx.fillStyle = s.color; ctx.globalAlpha = 0.55 + 0.45 * Math.sin(G.clock * 3 + s.x);
    ctx.fillText(s.text, s.x - cam.x, s.y - cam.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  // Palms.
  ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 3;
  for (const pl of G.city.palms) {
    if (pl.x < x0 || pl.x > x1 || pl.y < y0 || pl.y > y1) continue;
    ctx.beginPath(); ctx.moveTo(pl.x - cam.x, pl.y - cam.y); ctx.lineTo(pl.x - cam.x, pl.y - 14 - cam.y); ctx.stroke();
    ctx.fillStyle = '#3fae4a';
    ctx.beginPath(); ctx.arc(pl.x - cam.x, pl.y - 16 - cam.y, 7, 0, Math.PI * 2); ctx.fill();
  }
  // Shops / landmarks.
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  for (const s of G.city.shops) {
    const col = s.kind === 'bank' ? '#ffd23e' : s.kind === 'garage' ? '#2ec8ff' : s.kind === 'safe' ? '#7dff5e' : '#ff2e88';
    ctx.fillStyle = col;
    ctx.fillText(s.name, s.x - cam.x, s.y - 34 - cam.y);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 26 - cam.x, s.y - 26 - cam.y, 52, 52);
  }
  ctx.textAlign = 'left';
  // Mission / taxi / race markers.
  const marker = missionMarker(G);
  if (marker) {
    const pulse = 14 + Math.sin(G.clock * 4) * 4;
    ctx.strokeStyle = '#7dff5e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(marker.x - cam.x, marker.y - cam.y, pulse + 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7dff5e';
    ctx.beginPath(); ctx.moveTo(marker.x - cam.x, marker.y - 30 - cam.y);
    ctx.lineTo(marker.x + 9 - cam.x, marker.y - 12 - cam.y); ctx.lineTo(marker.x - 9 - cam.x, marker.y - 12 - cam.y); ctx.fill();
    const d = Math.round(Math.hypot(G.player.x - marker.x, G.player.y - marker.y) / 10);
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#7dff5e';
    ctx.fillText(d + 'm', marker.x + 16 - cam.x, marker.y - 24 - cam.y);
  }
  // Pickups.
  for (const pk of G.pickups) {
    ctx.fillStyle = pk.kind === 'health' ? '#ff5e5e' : pk.kind === 'cash' ? '#7dff5e' : pk.kind === 'nos' ? '#2ec8ff' : '#ffd23e';
    ctx.beginPath(); ctx.arc(pk.x - cam.x, pk.y - cam.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b0b1e'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'cash' ? '$' : pk.kind === 'nos' ? 'N' : 'A', pk.x - cam.x, pk.y + 4 - cam.y);
    ctx.textAlign = 'left';
  }
  // Cars.
  for (const car of G.cars) drawCar(ctx, G, car, cam, night);
  // Escort NPC.
  if (G.escort) {
    ctx.fillStyle = '#ff9ad5';
    ctx.beginPath(); ctx.arc(G.escort.x - cam.x, G.escort.y - cam.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('VERA', G.escort.x - cam.x, G.escort.y - 16 - cam.y); ctx.textAlign = 'left';
  }
  // Peds.
  for (const ped of G.peds) {
    ctx.fillStyle = ped.officer ? '#1a4dff' : ped.color;
    ctx.beginPath(); ctx.arc(ped.x - cam.x, ped.y - cam.y, ped.officer ? 9 : 7, 0, Math.PI * 2); ctx.fill();
    if (ped.officer) { ctx.fillStyle = '#fff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('PD', ped.x - cam.x, ped.y + 3 - cam.y); ctx.textAlign = 'left'; }
    if (ped.taxi && !ped.fare) { ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 12px monospace'; ctx.fillText('$', ped.x - 3 - cam.x, ped.y - 12 - cam.y); }
  }
  // Player on foot.
  const p = G.player;
  if (p.onFoot) {
    ctx.save(); ctx.translate(p.x - cam.x, p.y - cam.y); ctx.rotate(p.angle);
    ctx.fillStyle = '#ff2e88'; ctx.fillRect(-9, -7, 18, 14);
    ctx.fillStyle = '#ffd23e'; ctx.fillRect(6, -3, 8, 6);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,46,136,0.25)';
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, 20, 0, Math.PI * 2); ctx.fill();
  }
  // Bullets.
  ctx.strokeStyle = '#ffe66a'; ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath(); ctx.moveTo(b.x - cam.x, b.y - cam.y);
    ctx.lineTo(b.x - Math.cos(b.angle) * 14 - cam.x, b.y - Math.sin(b.angle) * 14 - cam.y); ctx.stroke();
  }
  // Roadblocks.
  for (const rb of G.roadblocks) {
    ctx.save(); ctx.translate(rb.x - cam.x, rb.y - cam.y); ctx.rotate(rb.angle);
    ctx.fillStyle = '#ff9a3e';
    for (let i = -2; i <= 2; i++) { ctx.fillStyle = i % 2 ? '#111' : '#ff9a3e'; ctx.fillRect(i * 14 - 7, -8, 14, 16); }
    ctx.restore();
    ctx.fillStyle = '#ff9a3e'; ctx.font = 'bold 14px monospace';
    ctx.fillText('ROADBLOCK!', rb.x + 24 - cam.x, rb.y - 20 - cam.y);
  }
  // Helicopter + spotlight.
  if (G.heli) {
    const h = G.heli;
    ctx.fillStyle = 'rgba(255,240,150,0.13)';
    ctx.beginPath(); ctx.moveTo(h.x - cam.x, h.y - cam.y);
    ctx.lineTo(p.x - cam.x + 90, p.y - cam.y + 90); ctx.lineTo(p.x - cam.x - 90, p.y - cam.y + 90); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#223'; ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x - cam.x, h.y - cam.y, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5e5e'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('HELI ' + Math.ceil(h.hp), h.x - cam.x, h.y - 24 - cam.y); ctx.textAlign = 'left';
  }
  // Particles / floats.
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.t * 2, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  // Night vignette + light pool around player.
  if (night > 0.15) {
    const g = ctx.createRadialGradient(p.x - cam.x, p.y - cam.y, 120, p.x - cam.x, p.y - cam.y, 480);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(4,4,16,${0.5 * night})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  }
  if (G.wanted >= 3) {
    ctx.strokeStyle = `rgba(255,40,40,${0.25 + 0.15 * Math.sin(G.clock * 6)})`; ctx.lineWidth = 26;
    ctx.strokeRect(0, 0, vw, vh);
  }
}
function missionMarker(G) {
  if (G.race) return G.race.gates[G.race.idx];
  if (G.taxi) return G.taxi.dest;
  if (G.mission) {
    if (G.mission.def.type === 'steal' && G.mission.phase === 0 && G.mission.markedCar) return { x: G.mission.markedCar.x, y: G.mission.markedCar.y };
    return G.mission.target;
  }
  return null;
}
function drawCar(ctx, G, car, cam, night) {
  ctx.save(); ctx.translate(car.x - cam.x, car.y - cam.y); ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-16, -9, 32, 22);
  ctx.fillStyle = car.police ? '#1a1a2e' : car.color;
  ctx.fillRect(-18, -10, 36, 20);
  ctx.fillStyle = car.police ? '#fff' : 'rgba(0,0,0,0.45)';
  ctx.fillRect(-6, -8, 14, 16);
  if (car.police) {
    ctx.fillStyle = '#1a4dff'; ctx.fillRect(-18, -10, 36, 4);
    const flash = Math.sin(G.clock * 10) > 0 ? '#ff2e2e' : '#2e6bff';
    ctx.fillStyle = flash; ctx.fillRect(-4, -12, 8, 4);
  }
  if (car.marked) { ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2; ctx.strokeRect(-20, -12, 40, 24); }
  if (car.taxi) { ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3); ctx.textAlign = 'left'; }
  // Headlights at night.
  if (night > 0.3 && Math.abs(car.speed) > 5) {
    ctx.fillStyle = 'rgba(255,240,160,0.18)';
    ctx.beginPath(); ctx.moveTo(18, -8); ctx.lineTo(90, -26); ctx.lineTo(90, 26); ctx.lineTo(18, 8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (car.police) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.fillText('PD', car.x - 7 - cam.x, car.y - 16 - cam.y); }
  if (car.hp < car.maxHp) {
    ctx.fillStyle = '#222'; ctx.fillRect(car.x - 18 - cam.x, car.y - 24 - cam.y, 36, 5);
    ctx.fillStyle = car.hp > 45 ? '#7dff5e' : '#ff5e5e';
    ctx.fillRect(car.x - 18 - cam.x, car.y - 24 - cam.y, 36 * clamp(car.hp / car.maxHp, 0, 1), 5);
  }
  if (car.smoke > 0.3) {
    ctx.fillStyle = 'rgba(180,180,180,0.5)';
    ctx.beginPath(); ctx.arc(car.x - cam.x + (Math.random() - 0.5) * 10, car.y - cam.y - 12, 5 + Math.random() * 5, 0, Math.PI * 2); ctx.fill();
  }
}
function lerpColor(a, b, t) {
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}
function shade(hex, night) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - night * 0.35;
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}
export function drawMinimap(ctx, G, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,10,24,0.85)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#2ec8ff'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  const step = CFG.BLOCK + CFG.ROAD;
  for (let i = 0; i <= CFG.COLS; i++) { ctx.beginPath(); ctx.moveTo(x + (CFG.ROAD / 2 + i * step - CFG.ROAD / 2) * sx, y); ctx.lineTo(x + (CFG.ROAD / 2 + i * step - CFG.ROAD / 2) * sx, y + h); ctx.stroke(); }
  for (let i = 0; i <= CFG.ROWS; i++) { ctx.beginPath(); ctx.moveTo(x, y + (CFG.ROAD / 2 + i * step - CFG.ROAD / 2) * sy); ctx.lineTo(x + w, y + (CFG.ROAD / 2 + i * step - CFG.ROAD / 2) * sy); ctx.stroke(); }
  ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const d of DISTRICTS) {
    const cx = (CFG.ROAD + ((d.c0 + d.c1) / 2) * step + CFG.BLOCK / 2) * sx;
    const cy = (CFG.ROAD + ((d.r0 + d.r1) / 2) * step + CFG.BLOCK / 2) * sy;
    ctx.fillText(d.label, x + cx - 22, y + cy);
  }
  for (const cop of G.cops) { ctx.fillStyle = '#ff2e2e'; ctx.fillRect(x + cop.x * sx - 2, y + cop.y * sy - 2, 4, 4); }
  const mk = missionMarker(G);
  if (mk) { ctx.fillStyle = '#7dff5e'; ctx.beginPath(); ctx.arc(x + mk.x * sx, y + mk.y * sy, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ff2e88'; ctx.beginPath(); ctx.arc(x + G.player.x * sx, y + G.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.strokeRect(x + G.player.x * sx - 5, y + G.player.y * sy - 5, 10, 10);
  // Viewport box.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
}
