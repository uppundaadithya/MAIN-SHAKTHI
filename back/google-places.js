const DEFAULT_RADIUS = 30000;

const fetchFn = global.fetch || (async (...args) => {
  try {
    return require('undici').fetch(...args);
  } catch (err) {
    throw new Error('No fetch available. Install undici or use Node 18+');
  }
});

async function fetchNearestPoliceGoogle({ lat, lon, radiusMeters = DEFAULT_RADIUS, apiKey }) {
  if (!apiKey) {
    throw new Error('Google Places API key is required');
  }

  try {
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radiusMeters}&type=police&key=${encodeURIComponent(apiKey)}`;
    const r = await fetchFn(nearbyUrl);
    const json = await r.json();

    if (!json || !Array.isArray(json.results) || json.results.length === 0) {
      return null;
    }

    const top = json.results[0];
    const placeId = top.place_id;

    // Try to fetch place details (phone + geometry)
    const fields = 'name,formatted_phone_number,geometry';
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${encodeURIComponent(apiKey)}`;
    const dres = await fetchFn(detailsUrl);
    const djson = await dres.json();
    const details = djson && djson.result ? djson.result : null;

    const latRes = details?.geometry?.location?.lat ?? top?.geometry?.location?.lat;
    const lonRes = details?.geometry?.location?.lng ?? top?.geometry?.location?.lng;

    return {
      name: details?.name ?? top?.name ?? 'Police',
      phone: details?.formatted_phone_number ?? null,
      lat: Number(latRes),
      lon: Number(lonRes)
    };
  } catch (err) {
    console.warn('Google Places fetch error:', err && err.message ? err.message : err);
    return null;
  }
}

module.exports = { fetchNearestPoliceGoogle };
