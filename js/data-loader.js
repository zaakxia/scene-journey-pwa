// Data loader: fetch JSON with cache
const DataLoader = (() => {
  const cache = new Map();

  async function loadIPList() {
    // For MVP, hardcoded. Later: fetch from data/ip/index.json
    return [
      { id: 'dragon-raja', name_zh: '龙族', name_en: 'Dragon Raja', country: '日本', city_count: 4 }
    ];
  }

  async function loadIPMeta(ipId) {
    const key = `meta_${ipId}`;
    if (cache.has(key)) return cache.get(key);
    const resp = await fetch(`../data/ip/${ipId}/metadata.json`);
    if (!resp.ok) throw new Error(`Failed to load IP meta: ${ipId}`);
    const data = await resp.json();
    cache.set(key, data);
    return data;
  }

  async function loadLocations(ipId) {
    const key = `loc_${ipId}`;
    if (cache.has(key)) return cache.get(key);
    const resp = await fetch(`../data/ip/${ipId}/locations.json`);
    if (!resp.ok) throw new Error(`Failed to load locations: ${ipId}`);
    const data = await resp.json();
    cache.set(key, data);
    return data;
  }

  async function loadRoutes(ipId) {
    const key = `routes_${ipId}`;
    if (cache.has(key)) return cache.get(key);
    const resp = await fetch(`../data/ip/${ipId}/routes.json`);
    if (!resp.ok) throw new Error(`Failed to load routes: ${ipId}`);
    const data = await resp.json();
    cache.set(key, data);
    return data;
  }

  function getCityColor(city, ipMeta) {
    if (!ipMeta || !ipMeta.cities) return '#e63946';
    const idx = ipMeta.cities.indexOf(city);
    const colors = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9b5de5'];
    return colors[idx % colors.length];
  }

  return { loadIPList, loadIPMeta, loadLocations, loadRoutes, getCityColor };
})();
