# ScootRoute mobile (M3+)

Cross-platform iOS/Android app. Planned stack:

- **React Native** (Expo bare or RN CLI) — one codebase, both platforms.
- **MapLibre Native** (`@maplibre/maplibre-react-native`) — free OSM vector maps, no Google/Mapbox lock-in.
- **Routing** — calls the `api/` gateway: `GET /route?profile=snorfiets|bromfiets&from=…&to=…`.
- **Turn-by-turn (M4)** — decode the polyline6 `shape`, follow `maneuvers[]`, device GPS for live position, TTS for voice.

## Screens

1. **Map + search** — origin/destination, profile toggle (snorfiets ⇄ bromfiets).
2. **Route preview** — line on map, distance/time, maneuver list.
3. **Navigation** — recentering camera, next-turn banner, voice.

## First step when we get here

```bash
npx create-expo-app@latest scootroute-app
# add @maplibre/maplibre-react-native, set up the route fetch against the gateway
```

Not started yet — backend (M0–M2) comes first so the app has a correct service to call.
