# ScootRoute Amsterdam

Turn-by-turn navigation for **scooters/mopeds in Amsterdam** — a routing mode that is
deliberately *neither* "bike" nor "car", because Amsterdam law treats scooters as their
own category.

## Why this exists

| Mode in Google Maps | What it does | Why it's wrong for a scooter |
|---|---|---|
| 🚲 Bike | Routes over every cycleway | Inside the Ring A10, snorfietsen are **banned from most bike paths** (rule of 8 Apr 2019) |
| 🚗 Car | Avoids cycleways, allows highways | Scooters **may** use many bike paths *and* **may not** use highways/Ring |

A scooter sits in between. We model that explicitly with two profiles:

- **Snorfiets** — blue plate, max **25 km/h**, helmet mandatory. Inside Ring A10: **road, not bike path** (with marked exceptions where it stays on the path).
- **Bromfiets** — yellow plate, max **45 km/h**. Roadway by default, off the cycleway, off the motorway.

The legal "snorfiets naar de rijbaan" road set is published by the municipality
(<https://maps.amsterdam.nl/snorfietsnaarrijbaan/>). We bake it into the routing graph so
we are correct exactly where Google/OSM defaults are wrong.

## Architecture

```
                 Geofabrik OSM (Noord-Holland .pbf)
                              │
            ┌─────────────────▼─────────────────┐
            │  overlay/  (preprocessing)         │
            │  bake Amsterdam scooter law into   │
            │  OSM moped=* access tags           │
            └─────────────────┬─────────────────┘
                              │ amsterdam-scooter.osm.pbf
            ┌─────────────────▼─────────────────┐
            │  valhalla/  (routing engine, Docker)│
            │  costing = motor_scooter           │
            │  two presets: snorfiets / bromfiets │
            └─────────────────┬─────────────────┘
                              │ HTTP /route
            ┌─────────────────▼─────────────────┐
            │  api/  (Node gateway)              │
            │  /route?profile=snorfiets|bromfiets │
            │  thin, validates + injects costing  │
            └─────────────────┬─────────────────┘
                              │ JSON (geometry + maneuvers)
            ┌─────────────────▼─────────────────┐
            │  mobile/  (React Native + MapLibre) │
            │  search · route · turn-by-turn      │
            └────────────────────────────────────┘
```

## Roadmap

- [ ] **M0 — Backend up.** Valhalla running on a Noord-Holland extract, default `motor_scooter` costing reachable. *(scaffolded here)*
- [ ] **M1 — Two profiles.** API exposes `snorfiets` (25) vs `bromfiets` (45) with correct costing. *(scaffolded here)*
- [ ] **M2 — Legal overlay.** Amsterdam "snorfiets naar de rijbaan" data baked into the graph; verified against 3–4 known streets. *(skeleton here — needs dataset schema verification)*
- [ ] **M3 — Mobile shell.** RN app: map, search, draw route from the API.
- [ ] **M4 — Turn-by-turn.** Live position, maneuver instructions, voice.
- [ ] **M5 — Polish.** Parking spots, no-go zones, helmet/electric-only reminders.

## Quick start (M0/M1)

```bash
cd scootroute
# 1. Install Docker Desktop first (not yet installed on this machine)
./valhalla/build_tiles.sh      # downloads NL-Noord extract + builds routing tiles
docker compose up -d valhalla  # serves routing on :8002
cd api && npm install && npm start   # gateway on :3000
curl "localhost:3000/route?profile=snorfiets&from=52.379,4.900&to=52.360,4.885"
```

See [docs/routing-model.md](docs/routing-model.md) for the legal→costing mapping.
