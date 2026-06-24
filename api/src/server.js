// Thin gateway between the mobile app and Valhalla.
// Responsibility: validate input, inject the correct scooter costing, and
// hand back a clean route (geometry + maneuvers) the app can render directly.

const path = require('path');
const express = require('express');
const { PROFILES, isProfile } = require('./profiles');

const VALHALLA_URL = process.env.VALHALLA_URL || 'http://localhost:8002';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

/** Parse a "lat,lon" string into a Valhalla location, or throw. */
function parseLatLon(s, label) {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec((s || '').trim());
  if (!m) throw new Error(`'${label}' must be "lat,lon", got: ${s}`);
  return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// GET /route?profile=snorfiets&from=52.379,4.900&to=52.360,4.885
app.get('/route', async (req, res) => {
  try {
    const profile = String(req.query.profile || 'snorfiets');
    if (!isProfile(profile)) {
      return res.status(400).json({
        error: `unknown profile '${profile}'`,
        allowed: Object.keys(PROFILES),
      });
    }
    const from = parseLatLon(req.query.from, 'from');
    const to = parseLatLon(req.query.to, 'to');

    const body = {
      locations: [from, to],
      ...PROFILES[profile],
      directions_options: { units: 'kilometers', language: 'nl-NL' },
    };

    const r = await fetch(`${VALHALLA_URL}/route`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'valhalla error', detail: await r.text() });
    }
    const data = await r.json();
    const leg = data.trip?.legs?.[0];
    res.json({
      profile,
      summary: data.trip?.summary, // { length, time }
      shape: leg?.shape, // encoded polyline6
      maneuvers: leg?.maneuvers?.map((m) => ({
        instruction: m.instruction,
        length: m.length,
        time: m.time,
        type: m.type,
      })),
    });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`ScootRoute API on :${PORT} → Valhalla at ${VALHALLA_URL}`);
});
