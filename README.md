# gta6-01-bot-v5-rebuild

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bnbf/gta6-01-bot-v5-rebuild/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bnbf/gta6-01-bot-v5-rebuild/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**LUMEN BAY — Neon Heat** is a complete 2D top-down open-world crime game in an original neon coastal city. Golden dusk at 18:40 fades into neon night by 20:00 — neon signs, street lamps, car headlights and a pool of light around you are the visual heart of the game. Steal cars, outrun the Lumen Bay PD, and climb from Street Punk to King of the Bay.

## Features

- **Open world:** a deterministic seeded city — 7×6 blocks of roads, buildings, parks, a beach and the sea, across **6 named districts** (Downtown, Neon Strip, Marina, Industrial, Old Town, Beachfront), each with its own palette and landmarks, plus district labels on the minimap
- **12 story missions:** First Wheels, Neon Courier, Protection Money, Heat Wave, The Big Score, Midnight Race, King of the Bay, Bay Circuit, Dockside Run, Garage Job, Safe Witness, Kingpin's Fall
- **Wanted 1–5★:** police cars chase, ram and bust; foot officers join at 2★; a **police helicopter** with a spotlight hunts you from 4★ — shoot it down for +$500; **police roadblocks** funnel you at 4–5★, and cops lose you when you break line of sight
- **4 weapons:** pistol, SMG, shotgun, rifle — plus drive-by shooting from cars
- **Car radio:** 4 procedural WebAudio stations (NEON FM, SUNSET DRIVE, BAY BASS, PALM LO-FI)
- **Shops:** gun shop (buy weapons & ammo), diner (heal), garage (repair + NOS)
- **Garage upgrades:** armor, engine and NOS tiers plus car paint, all purchasable with cash
- **Safehouse:** heal and save · **Saves + autosave** (localStorage)
- **Side jobs:** street races and taxi fares
- **Living city:** traffic AI, pedestrians who flee crime, car damage + smoke
- **HUD:** wanted stars, cash, health, ammo, speed, clock, rank, objective, compass arrow, minimap
- **Sound:** fully synthesized WebAudio SFX and music — no audio files
- **Controls:** WASD/arrows to move and drive, mouse to aim, click to shoot, E to steal/exit/use shops, Shift to run/NOS, R radio, 1–4 weapons, T taxi/race, P pause

## Run it

```sh
python3 -m http.server 8124 --directory game
# then open http://localhost:8124/ in desktop Chrome
```

Or serve `game/` with any static file server. No build step, no network requests — everything the game loads is a file under `game/` or a `data:` URI.

Self-test: open `http://localhost:8124/?test=1` — 23 checks over the real game systems (spawn, traffic, stealing, wanted, police, helicopter, roadblocks, districts, missions, save/load, shooting, shops, radio, garage upgrades, drive-by, wanted decay).

## Layout

- `game/index.html` — canvas + HUD
- `game/src/config.js` — constants, districts, weapons, economy, missions, upgrades, radio
- `game/src/city.js` — deterministic seeded city, districts, collision, line-of-sight
- `game/src/vehicles.js` — traffic AI, player driving, police AI + helicopter + roadblocks
- `game/src/people.js` — pedestrians, fleeing, foot officers, taxi fares
- `game/src/player.js` — walk/run, stealing, shooting, weapons, drive-by
- `game/src/missions.js` — 12 story missions, race + taxi side jobs
- `game/src/audio.js` — synthesized SFX + 4 procedural radio stations
- `game/src/render.js` — dusk-to-neon rendering, lighting, minimap with district labels
- `game/src/hud.js` — HUD, title screen, menus, shops, garage
- `game/src/save.js` — localStorage save/load
- `game/src/main.js` — loop, input, camera, wanted decay, self-test, screenshots
- `main.ts` — builds `/output` + `dossier.json` via `vendor/makefun-game.ts`

---

<sub>Entered on [make.fun](https://make.fun/?ref=bsqaxrmg&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
