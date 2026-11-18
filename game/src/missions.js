// missions.js: the 12-mission story engine + street race + taxi side jobs.
import { MISSIONS, dist, clamp } from './config.js';
import { shopById, roadCenterX, roadCenterY } from './city.js';
import { makeCar } from './vehicles.js';

export function startMission(G, idx) {
  const def = MISSIONS[idx];
  if (!def) { G.mission = null; return; }
  const m = { def, idx, phase: 0, t: def.time || 0, done: false, gates: [], gateIdx: 0, lap: 1, markedCar: null };
  if (def.type === 'goto' || def.type === 'timed' || def.type === 'bank' || def.type === 'steal' || def.type === 'escort') {
    m.target = targetPoint(G, def.target);
  }
  if (def.type === 'race' || def.type === 'circuit') {
    m.gates = raceGates(G);
    m.target = m.gates[0];
  }
  if (def.type === 'visit') m.need = ['ramen', 'karaoke', 'arcade'];
  if (def.type === 'steal') {
    const c = makeCar(G, roadCenterX(5) + 60, roadCenterY(1), { color: '#ffd23e', marked: true });
    G.cars.push(c); m.markedCar = c; m.target = { x: c.x, y: c.y };
    G.msg = 'The gold car is marked on the map — steal it!'; G.msgT = 3;
  }
  if (def.type === 'escort') {
    G.escort = { x: G.player.x + 60, y: G.player.y + 40, hp: 100, inCar: false };
    G.msg = 'Vera Solano is with you — get her to the Safehouse!'; G.msgT = 3;
  }
  if (def.type === 'loseheat') { G.wanted = Math.max(G.wanted, 3); G.msg = 'Lose the heat, then reach the Safehouse!'; G.msgT = 3; }
  if (def.type === 'bank') { G.msg = 'Rob the vault — grab the cash inside the bank!'; G.msgT = 3; }
  G.mission = m;
  G.visited = [];
}
export function targetPoint(G, id) {
  const s = shopById(G, id);
  if (s) return { x: s.x, y: s.y };
  if (id === 'race') return { x: roadCenterX(3), y: roadCenterY(3) };
  return { x: G.player.x, y: G.player.y };
}
export function raceGates(G) {
  return [
    { x: roadCenterX(1), y: roadCenterY(0) },
    { x: roadCenterX(6), y: roadCenterY(1) },
    { x: roadCenterX(5), y: roadCenterY(5) },
    { x: roadCenterX(1), y: roadCenterY(4) },
  ];
}
export function missionObjective(G) {
  if (!G.mission) return 'Free roam — press T for a taxi fare, or find the next mission marker.';
  const m = G.mission, d = m.def;
  if (d.type === 'visit') return `${d.text} (${G.visited.length}/3 collected)`;
  if (d.type === 'race' || d.type === 'circuit') return `${d.text} Gate ${m.gateIdx + 1}/4 — Lap ${m.lap}/3`;
  if (d.type === 'timed') return `${d.text} — ${Math.ceil(m.t)}s left`;
  if (d.type === 'bank' && m.phase === 0) return 'Enter the Bay Bank and grab the vault cash!';
  if (d.type === 'bank' && m.phase === 1) return 'Cash grabbed! Escape — lose the heat!';
  if (d.type === 'steal' && m.phase === 0) return 'Steal the marked gold car!';
  if (d.type === 'steal' && m.phase === 1) return 'Deliver the gold car to Volt Garage.';
  return d.text;
}
function completeMission(G) {
  const m = G.mission;
  G.cash += m.def.reward; G.score += m.def.reward * 2;
  G.floats.push({ x: G.player.x, y: G.player.y - 30, text: `MISSION COMPLETE +$${m.def.reward}`, color: '#7dff5e', t: 2 });
  G.msg = `Mission complete: ${m.def.name} +$${m.def.reward}`; G.msgT = 3;
  if (m.def.type === 'race' || m.def.type === 'circuit') G.stats.races++;
  G.missionIdx++;
  if (G.missionIdx >= MISSIONS.length) {
    G.mission = null; G.msg = 'KING OF THE BAY — you beat the whole story!'; G.msgT = 5;
    G.score += 2000;
  } else startMission(G, G.missionIdx);
}
export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m) return;
  const p = G.player, d = m.def;
  if (d.type === 'timed') {
    m.t -= dt;
    if (m.t <= 0) { G.msg = 'Too slow — mission failed, try again.'; G.msgT = 2.5; startMission(G, G.missionIdx); return; }
  }
  const at = (pt) => pt && dist(p.x, p.y, pt.x, pt.y) < 70;
  switch (d.type) {
    case 'goto': if (at(m.target)) completeMission(G); break;
    case 'timed': if (at(m.target)) completeMission(G); break;
    case 'visit': {
      for (const id of m.need) {
        const s = shopById(G, id);
        if (s && !G.visited.includes(id) && dist(p.x, p.y, s.x, s.y) < 80) {
          G.visited.push(id); G.cash += 100;
          G.floats.push({ x: p.x, y: p.y - 24, text: '+$100 COLLECTED', color: '#7dff5e', t: 1.2 });
        }
      }
      if (G.visited.length >= 3) completeMission(G);
      break;
    }
    case 'loseheat':
      if (G.wanted === 0 && at(m.target)) completeMission(G);
      break;
    case 'bank': {
      if (m.phase === 0) {
        const bank = shopById(G, 'bank');
        if (bank && dist(p.x, p.y, bank.x, bank.y) < 80) {
          m.phase = 1; G.cash += 250; G.wanted = d.name === "Kingpin's Fall" ? 5 : 4;
          G.msg = 'Vault cash grabbed! Now lose the heat!'; G.msgT = 3;
        }
      } else if (G.wanted === 0) completeMission(G);
      break;
    }
    case 'race': case 'circuit': {
      const gate = m.gates[m.gateIdx];
      if (gate && at(gate)) {
        m.gateIdx++;
        if (m.gateIdx >= m.gates.length) {
          if (d.type === 'circuit' && m.lap < 3) { m.lap++; m.gateIdx = 0; G.msg = `Lap ${m.lap}/3!`; G.msgT = 2; }
          else completeMission(G);
        }
      }
      m.target = m.gates[m.gateIdx] || m.gates[0];
      break;
    }
    case 'steal': {
      if (m.phase === 0 && p.car === m.markedCar) { m.phase = 1; m.target = targetPoint(G, 'garage'); }
      if (m.phase === 1 && at(m.target)) completeMission(G);
      break;
    }
    case 'escort': {
      if (G.escort) {
        const e = G.escort;
        if (p.car) { e.inCar = true; e.x = p.x; e.y = p.y; }
        else { e.inCar = false; const dd = dist(e.x, e.y, p.x, p.y); if (dd > 40) { const a = Math.atan2(p.y - e.y, p.x - e.x); e.x += Math.cos(a) * 140 * dt; e.y += Math.sin(a) * 140 * dt; } }
        if (e.hp <= 0) { G.msg = 'Vera was hurt — mission failed, try again.'; G.msgT = 2.5; G.escort = null; startMission(G, G.missionIdx); return; }
        if (at(m.target)) { G.escort = null; completeMission(G); }
      }
      break;
    }
  }
}
export function startStreetRace(G) {
  if (G.mission && (G.mission.def.type === 'race' || G.mission.def.type === 'circuit')) return;
  G.race = { gates: raceGates(G), idx: 0, t: 120 };
  G.msg = 'Street race started — hit all 4 checkpoints!'; G.msgT = 3;
}
export function updateSideRace(G, dt) {
  if (!G.race) return;
  const r = G.race;
  r.t -= dt;
  const gate = r.gates[r.idx];
  if (gate && dist(G.player.x, G.player.y, gate.x, gate.y) < 70) {
    r.idx++;
    if (r.idx >= r.gates.length) {
      G.cash += 200; G.score += 150; G.stats.races++;
      G.floats.push({ x: G.player.x, y: G.player.y - 24, text: '+$200 RACE WIN', color: '#7dff5e', t: 1.5 });
      G.race = null; return;
    }
  }
  if (r.t <= 0) { G.msg = 'Race lost — too slow.'; G.msgT = 2; G.race = null; }
}
