const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
];

// Ensure a fetch implementation is available on the server side.
let fetchFn = (typeof fetch === 'function') ? fetch : null;
if (!fetchFn) {
  try {
    // prefer undici when available (works with CommonJS)
    const undici = require('undici');
    fetchFn = undici.fetch;
  } catch (err) {
    fetchFn = null;
  }
}

function buildOverpassQuery(lat, lon, radiusMeters = 30000) {
  // Search for police-related places in OpenStreetMap and return center for ways/relations.
  // This includes amenity=police, office=police, and police=station.
  return `[
    out:json][timeout:25];
  (
    node["amenity"="police"](around:${radiusMeters},${lat},${lon});
    way["amenity"="police"](around:${radiusMeters},${lat},${lon});
    relation["amenity"="police"](around:${radiusMeters},${lat},${lon});
    node["office"="police"](around:${radiusMeters},${lat},${lon});
    way["office"="police"](around:${radiusMeters},${lat},${lon});
    relation["office"="police"](around:${radiusMeters},${lat},${lon});
    node["police"="station"](around:${radiusMeters},${lat},${lon});
    way["police"="station"](around:${radiusMeters},${lat},${lon});
    relation["police"="station"](around:${radiusMeters},${lat},${lon});
  );
  out center;`;
}

async function fetchNearbyPolice({ lat, lon, radiusMeters = 30000 }) {
  // We must send the raw Overpass QL, not the full URL.
  const overpassQL = buildOverpassQuery(lat, lon, radiusMeters);
  const body = `data=${encodeURIComponent(overpassQL)}`;

  if (!fetchFn) {
    throw new Error('No fetch available in this Node environment (install undici or use Node 18+).');
  }

  let resp = null;
  let lastError = null;
  for (const url of OVERPASS_URLS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        resp = await fetchFn(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body
        });

        if (resp.ok) break;

        const status = resp.status;
        const waitMs = 200 * Math.pow(2, attempt);
        console.warn(`Overpass returned ${status} from ${url} (attempt ${attempt}). Retrying in ${waitMs}ms.`);
        lastError = new Error(`Overpass ${url} returned ${status}`);
        await new Promise((r) => setTimeout(r, waitMs));
      } catch (err) {
        lastError = err;
        const waitMs = 200 * Math.pow(2, attempt);
        console.warn(`Overpass fetch attempt ${attempt} to ${url} failed:`, err?.message || err);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    if (resp && resp.ok) break;
  }

  if (!resp || !resp.ok) {
    console.warn('Overpass lookup failed after retries across all endpoints.', lastError?.message || lastError);
    return null;
  }

  let data = null;
  try {
    data = await resp.json();
  } catch (err) {
    console.warn('Overpass returned non-JSON response:', err?.message || err);
    return null;
  }

  const elements = Array.isArray(data?.elements) ? data.elements : [];
  if (!elements.length) return null;

  const [originLat, originLon] = [lat, lon];

  // Map elements to station objects with distance score
  function buildAddressFromTags(tags) {
    if (!tags || typeof tags !== 'object') return null;
    const addressParts = [];
    const fullAddress = tags['addr:full'] || tags['address'] || tags['addr:street'];
    if (fullAddress) {
      addressParts.push(fullAddress);
    } else {
      const street = tags['addr:street'];
      const housenumber = tags['addr:housenumber'];
      const neighbourhood = tags['addr:neighbourhood'] || tags['addr:suburb'];
      const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'];
      const state = tags['addr:state'];
      const postcode = tags['addr:postcode'];
      const country = tags['addr:country'];

      if (street) {
        addressParts.push(housenumber ? `${housenumber} ${street}` : street);
      }
      if (neighbourhood) addressParts.push(neighbourhood);
      if (city) addressParts.push(city);
      if (state) addressParts.push(state);
      if (postcode) addressParts.push(postcode);
      if (country) addressParts.push(country);
    }

    return addressParts.length ? addressParts.join(', ') : null;
  }

  const stations = elements
    .map((el) => {
      // For nodes, Overpass returns lat/lon directly.
      // For ways/relations when using `out center`, Overpass returns `center: {lat, lon}`.
      const elLat = Number.isFinite(el?.lat) ? el.lat : (el?.center && Number.isFinite(el.center.lat) ? el.center.lat : null);
      const elLon = Number.isFinite(el?.lon) ? el.lon : (el?.center && Number.isFinite(el.center.lon) ? el.center.lon : null);
      if (!Number.isFinite(elLat) || !Number.isFinite(elLon)) return null;
      const dLat = elLat - originLat;
      const dLon = (elLon - originLon) * Math.cos((originLat * Math.PI) / 180);
      const score = dLat * dLat + dLon * dLon;
      const tags = el?.tags || {};
      return {
        name: tags?.name || 'Police Station',
        phone: tags?.phone || tags?.contactphone || tags?.contact_phone || null,
        address: buildAddressFromTags(tags),
        lat: elLat,
        lon: elLon,
        score,
        osm_type: el.type || null,
        osm_id: el.id || null,
        tags
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  // Return up to a few nearest stations
  const maxResults = 6;
  return stations.slice(0, maxResults).map((s) => ({
    name: s.name,
    phone: s.phone,
    address: s.address,
    lat: s.lat,
    lon: s.lon
  }));
}

module.exports = {
  buildOverpassQuery,
  fetchNearbyPolice
};
