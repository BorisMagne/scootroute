# Routing model: Dutch scooter law → Valhalla costing

This is the reference that keeps the routing honest. When the law changes, change this
doc and the two artifacts it points to: `api/src/profiles.js` and `overlay/`.

## Plate classes

| Class | Plate | Max speed | Default road position | Helmet |
|---|---|---|---|---|
| **Snorfiets** | Blue | 25 km/h | Bike path — **except inside Ring A10**, where it's the road (since 8 Apr 2019) | Yes (approved helmet, since 1 Jan 2023) |
| **Bromfiets** | Yellow | 45 km/h | Roadway | Yes |

Both: **no motorways**, no the Ring A10 itself. From 1 Jan 2025, newly-registered mopeds
must be electric (a UX reminder, not a routing constraint).

## Where the rules live in code

| Rule | Encoded as | File |
|---|---|---|
| Max speed 25 vs 45 | `top_speed` | `api/src/profiles.js` |
| Avoid big through-roads (snor) | low `use_primary` | `api/src/profiles.js` |
| No motorways | built into `motor_scooter` costing | Valhalla |
| Snorfiets off the bike path inside the ring | `moped=no` on those cycleways | `overlay/apply_overlay.py` |
| Exception streets (stay on path) | left untouched by overlay | `overlay/` rule data |

## Why an overlay instead of pure costing

Costing options can express *preferences* ("prefer small roads") but not *local legality*
("on THIS cycleway a snorfiets is illegal but on that identical-looking one it's fine").
Legality is a geographic fact published by the municipality, so it belongs in the graph
as access tags — not in the cost function. That separation also means a bromfiets (which
was never allowed on these bike paths anyway) and a snorfiets share one graph.

## Verification checklist (M2)

Pick streets with known status and assert the route matches reality:

- [ ] **Weesperzijde / Sarphatistraat** (inside ring) — snorfiets routed on road, not path.
- [ ] A marked **exception** road — snorfiets stays on the bike path.
- [ ] **Outside the A10** (e.g. Amstelveen direction) — snorfiets may use bike paths.
- [ ] Any **motorway / the Ring** — never chosen for either profile.
