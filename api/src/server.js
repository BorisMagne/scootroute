require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const express = require('express');
const { PROFILES, isProfile } = require('./profiles');

const VALHALLA_URL = process.env.VALHALLA_URL || 'http://localhost:8002';
const GOOGLE_KEY   = process.env.GOOGLE_MAPS_KEY || '';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function parseLatLon(s, label) {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec((s || '').trim());
  if (!m) throw new Error(`'${label}' must be "lat,lon", got: ${s}`);
  return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// Places API (New) — Autocomplete
// GET /geocode/suggest?q=QUERY
app.get('/geocode/suggest', async (req, res) => {
  if (!GOOGLE_KEY) return res.status(503).json({ error: 'GOOGLE_MAPS_KEY not configured' });
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
      },
      body: JSON.stringify({
        input: q,
        locationBias: {
          circle: { center: { latitude: 52.3676, longitude: 4.9041 }, radius: 25000.0 },
        },
        includedRegionCodes: ['nl'],
        languageCode: 'nl',
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Google API error' });
    res.json((data.suggestions || []).map(s => {
      const p = s.placePrediction;
      return {
        placeId:   p.placeId,
        main:      p.structuredFormat?.mainText?.text      || p.text?.text || '',
        secondary: p.structuredFormat?.secondaryText?.text || '',
      };
    }));
  } catch (err) {
    res.status(502).json({ error: String(err.message) });
  }
});

// Places API (New) — Place Details (resolves placeId to coordinates)
// GET /geocode/details?id=PLACE_ID
app.get('/geocode/details', async (req, res) => {
  if (!GOOGLE_KEY) return res.status(503).json({ error: 'GOOGLE_MAPS_KEY not configured' });
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'id,displayName,location,formattedAddress',
      },
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Google API error' });
    res.json({
      lat:     data.location.latitude,
      lng:     data.location.longitude,
      name:    data.displayName?.text || data.formattedAddress,
      address: data.formattedAddress,
    });
  } catch (err) {
    res.status(502).json({ error: String(err.message) });
  }
});

// GET /route?profile=bromfiets&from=52.379,4.900&to=52.360,4.885
app.get('/route', async (req, res) => {
  try {
    const profile = String(req.query.profile || 'bromfiets');
    if (!isProfile(profile)) {
      return res.status(400).json({ error: `unknown profile '${profile}'`, allowed: Object.keys(PROFILES) });
    }
    const from = parseLatLon(req.query.from, 'from');
    const to   = parseLatLon(req.query.to,   'to');
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
    if (!r.ok) return res.status(502).json({ error: 'valhalla error', detail: await r.text() });
    const data = await r.json();
    const leg  = data.trip?.legs?.[0];
    res.json({
      profile,
      summary:   data.trip?.summary,
      shape:     leg?.shape,
      maneuvers: leg?.maneuvers?.map(m => ({
        instruction: m.instruction,
        length:      m.length,
        time:        m.time,
        type:        m.type,
      })),
    });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`ScootRoute API on :${PORT} → Valhalla at ${VALHALLA_URL}`);
  if (!GOOGLE_KEY) console.warn('  ⚠  GOOGLE_MAPS_KEY not set — geocoding endpoints disabled');
});
