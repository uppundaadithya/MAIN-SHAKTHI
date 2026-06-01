const { fetchNearbyPolice, buildOverpassQuery } = require('./back/overpass');
(async () => {
  const lat = 12.9716;
  const lon = 77.5946;
  console.log('Query:', buildOverpassQuery(lat, lon, 10000));
  const stations = await fetchNearbyPolice({ lat, lon, radiusMeters: 10000 });
  console.log('Stations:', stations && stations.length, JSON.stringify(stations, null, 2));
})();
