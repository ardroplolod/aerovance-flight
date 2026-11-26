# aerovance-flight

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/{owner}/{repo}/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/{owner}/{repo}/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**AEROVANCE: Advanced Flight Experience** is an original 3D flight simulator that runs offline in a desktop browser (three.js, no network). It has a cinematic intro with an animated pilot, an interactive hangar with three aircraft (fighter, airliner, light trainer), five hand-built environments, a flight model with real lift, drag, stall, flaps, gear and brakes, a full avionics HUD and 3D cockpit, eight missions plus a flight school, and a graded landing evaluation.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes the hand-in (game, screenshots, dossier).

## Controls

| Key | Action |
| --- | --- |
| W / S, or hold left mouse and drag | Pitch down / up |
| A / D, or drag | Roll |
| Q / E | Rudder, nose-wheel steering |
| Shift / Ctrl, mouse wheel, 0 / \` | Throttle up / down, full / idle |
| Tab (or full throttle) | Afterburner (fighter) |
| I | Engine start |
| G · F / V · X · B · Z | Gear · flaps down / up · wheel brakes · parking brake · airbrake |
| C, 1–5 | Camera: cockpit, chase, cinematic, side, landing approach |
| Right mouse drag | Look around / orbit |
| N · H · P / Esc · M | Map range · help · pause · mute |

## What is in it

- **Cinematic main menu**: Ironwood Air Base at sunrise; the pilot walks to the jet, touches the airframe, climbs the ladder and the canopy closes (SKIP INTRO available), then a pre-flight walk-around loops behind the menu.
- **Flight deck**: aircraft status, flight information (location, destination, weather, wind, visibility, distance, estimated time) and mission information, with aircraft, time-of-day and weather selectors.
- **Hangar**: orbit/zoom camera, detail views (cockpit, engine, wings, tail, gear), specification sheet and comparison bars. Performance figures (max speed, cruise, ceiling, stall, endurance) are computed from the same coefficients the flight model flies.
- **Aircraft**: AV-9 Kestrel (twin-engine fighter with afterburner, tail hook), AV-500 Stratos (twin-turbofan airliner), AV-2 Skylark (piston trainer, fixed gear). Moving ailerons, elevators, rudders, flaps, retracting gear, spinning fans and propeller.
- **Environments**: Highland Valley (mountains, river, forest), Coral Archipelago (islands, volcano, boats, lighthouse), Ironwood Air Base (hangars, tower, radar, parked jets), Task Force Meridian (aircraft carrier with angled deck and arresting wires), Port Meridian International (twin runways, terminal, city).
- **Flight model**: thrust with altitude lapse, lift curve with stall, parasite/induced/transonic drag, gear/flap/airbrake drag, ground effect, side force, weathervane stability, wind, gusts and turbulence, ground roll with brakes and steering, fuel burn, structural damage (G, overspeed, hard landings) and engine failure.
- **HUD**: mission control, heading strip with target bug, aircraft condition, speed and altitude tapes, flight path marker, pitch ladder, target markers, synthetic runway with localizer / glide-slope, PAPI repeater, landing cues, six live gauges, control panel and moving map.
- **Missions**: First Takeoff, Navigation Challenge, Mountain Approach (10 rings), Island Checkpoint Run, Precision Landing, Carrier Trap, Emergency Landing (engine failure), Long Distance Flight, plus three Flight School lessons with hints.
- **Landing evaluation** of sink rate, speed, touchdown point, centreline, alignment, braking distance and approach stability, rated PERFECT / EXCELLENT / GOOD / NEEDS IMPROVEMENT, and a career logbook with ranks.
- **Audio**: all sound synthesised with the Web Audio API (engines, wind, gear, flaps, touchdown, alerts, interface).

Honest notes: the carrier is stationary; the airliner and trainer have no afterburner or hook; the light trainer's gear is fixed.

## Layout

`game/src/core` engine, input, math · `world` terrain, sky, water, runways, structures, maps · `aircraft` specs, models, cockpit, systems · `physics/flight.js` flight model · `camera` · `weather` · `hud` · `nav` · `missions` · `landing` · `pilot` · `scenes` intro and hangar · `audio` · `ui` screens · `game` flight session and profile. three.js r170 is vendored as `game/vendor/three.module.min.js` (MIT).

---

<sub>Entered on [make.fun](https://make.fun/?ref={referral_code}&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
