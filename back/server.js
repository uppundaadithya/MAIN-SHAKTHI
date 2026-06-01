const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
// Vercel provides the PORT automatically
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const staticPath = path.join(__dirname, '..', 'front');
console.log('Serving static files from:', staticPath);
app.use(express.static(staticPath));

// Default route - open app shell first
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/index.html', (req, res) => {
    res.redirect('/user/index.html');
});

// Friendly entry paths
app.get('/admin/login', (req, res) => {
    res.redirect('/admin/login.html');
});

app.get('/login.html', (req, res) => {
    res.redirect('/login/login.html');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/login.html');
});

app.get('/user', (req, res) => {
    res.redirect('/user/index.html');
});

// Server status check
app.get('/api/status', (req, res) => {
    res.json({
        status: "online",
        message: "SHAKTHI server is running on Vercel!",
        timestamp: new Date()
    });
});

// SOS endpoint - sends alert location
// Frontend expects: POST /api/send-sos with { lat, lon }
app.post('/api/send-sos', async (req, res) => {
    try {
        const { lat, lon } = req.body || {};

        // Alert is processed through Firebase
        res.status(200).json({
            success: true,
            location: { lat: lat ?? null, lon: lon ?? null }
        });
    } catch (err) {
        res.status(500).json({
            error: err?.message || 'Unknown error'
        });
    }
});

const { fetchNearbyPolice } = require('./overpass');
// simple in-memory cache for Overpass results (keyed by lat:lon rounded)
const overpassCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const POLICE_SEARCH_RADIUS_METERS = 30000;
const FALLBACK_POLICE_STATION = {
    name: 'Police Station',
    phone: null,
    address: 'Fallback police station location',
    lat: 13.63709,
    lon: 74.68891
};

// Google module kept but not used for free-only flow
let fetchNearestPoliceGoogle;
try { fetchNearestPoliceGoogle = require('./google-places').fetchNearestPoliceGoogle; } catch (e) { fetchNearestPoliceGoogle = null; }

// Nearby police station lookup using Overpass (OpenStreetMap)
// Frontend expects: GET /api/nearby-police?lat=...&lon=...
// Response: { name, phone, lat, lon }
app.get('/api/nearby-police', async (req, res) => {
    try {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const radiusMeters = POLICE_SEARCH_RADIUS_METERS;

        // Use cache: round coords to 4 decimal places (~11m) to allow reuse
        const key = `${lat.toFixed(4)}:${lon.toFixed(4)}:${radiusMeters}`;
        const now = Date.now();
        const cached = overpassCache.get(key);
        if (cached && (now - cached.ts) < CACHE_TTL_MS) {
            const cachedStations = Array.isArray(cached.stations) ? cached.stations : [];
            if (!cachedStations.length) {
                return res.status(200).json({
                    stations: [FALLBACK_POLICE_STATION],
                    found: false,
                    fallback: true,
                    message: `No police stations found within ${radiusMeters / 1000} km. Showing fallback police station.`
                });
            }

            return res.status(200).json({ stations: cachedStations, found: true });
        }

        let result = await fetchNearbyPolice({ lat, lon, radiusMeters });

        if (!Array.isArray(result) || result.length === 0) {
            const googleKey = req.query.key || process.env.GOOGLE_PLACES_KEY;
            if (googleKey && fetchNearestPoliceGoogle) {
                const googleStation = await fetchNearestPoliceGoogle({ lat, lon, radiusMeters, apiKey: googleKey });
                if (googleStation) {
                    result = [googleStation];
                }
            }
        }

        if (Array.isArray(result)) {
            overpassCache.set(key, { ts: now, stations: result });
        }

        // `result` is an array of stations (may be null on upstream failure)
        const stations = Array.isArray(result) ? result : [];

        if (!stations.length) {
            // No OSM results — return a placeholder without forcing a phone number.
            return res.status(200).json({
                stations: [FALLBACK_POLICE_STATION],
                found: false,
                fallback: true,
                message: `No police stations found within ${radiusMeters / 1000} km. Showing fallback police station.`
            });
        }

        return res.status(200).json({ stations, found: true });
    } catch (err) {
        return res.status(500).json({ error: err?.message || 'Unknown error' });
    }
});


// Google Places: return the single best police place (requires API key)
// Frontend: GET /api/nearby-police-google?lat=...&lon=...&key=OPTIONAL_API_KEY
app.get('/api/nearby-police-google', async (req, res) => {
    try {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);
        const key = req.query.key || process.env.GOOGLE_PLACES_KEY;

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        if (!key) {
            return res.status(400).json({ error: 'Missing Google Places API key. Provide key as `key` query param or set GOOGLE_PLACES_KEY env var.' });
        }

        const station = await fetchNearestPoliceGoogle({ lat, lon, radiusMeters: POLICE_SEARCH_RADIUS_METERS, apiKey: key });

        if (!station) {
            return res.status(200).json({ station: null });
        }

        return res.status(200).json({ station });
    } catch (err) {
        return res.status(500).json({ error: err?.message || 'Unknown error' });
    }
});



/**
 * START LOGIC
 * On Vercel, we export the app. 
 * For local development, we call app.listen().
 */
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🛡️ SHAKTHI Local Server: http://localhost:${PORT}`);
    });
}

// THIS IS REQUIRED FOR VERCEL
module.exports = app;
