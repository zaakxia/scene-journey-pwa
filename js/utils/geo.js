// Geographic utilities
const GeoUtils = (() => {

  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function toRad(deg) { return deg * Math.PI / 180; }

  // Nearest-neighbor ordering starting from a given point (or first location in list)
  function nearestNeighborRoute(locations, startLatLng = null) {
    if (locations.length <= 2) return [...locations];
    const unvisited = locations.map((loc, i) => ({ ...loc, _origIdx: i }));
    const result = [];

    let current = startLatLng || { lat: unvisited[0].coordinates.lat, lng: unvisited[0].coordinates.lng };

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const d = haversineDistance(
          current.lat, current.lng,
          unvisited[i].coordinates.lat, unvisited[i].coordinates.lng
        );
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      const chosen = unvisited.splice(nearestIdx, 1)[0];
      result.push(chosen);
      current = { lat: chosen.coordinates.lat, lng: chosen.coordinates.lng };
    }

    return result;
  }

  function totalDistance(orderedLocations) {
    let total = 0;
    for (let i = 1; i < orderedLocations.length; i++) {
      total += haversineDistance(
        orderedLocations[i - 1].coordinates.lat,
        orderedLocations[i - 1].coordinates.lng,
        orderedLocations[i].coordinates.lat,
        orderedLocations[i].coordinates.lng
      );
    }
    return total;
  }

  function formatDistance(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toFixed(1) + ' km';
  }

  function formatDuration(hours) {
    if (hours < 1) return Math.round(hours * 60) + ' 分钟';
    return hours.toFixed(1) + ' 小时';
  }

  function bearing(lat1, lng1, lat2, lng2) {
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  function bearingToArrow(brng) {
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    return arrows[Math.round(brng / 45) % 8];
  }

  // WGS-84 → GCJ-02, used before calling Amap API (which expects GCJ-02)
  function toGcj02(lat, lng) {
    var x = lng - 105, y = lat - 35;
    var dlat = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
    dlat += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
    dlat += (20*Math.sin(y*Math.PI) + 40*Math.sin(y/3*Math.PI)) * 2/3;
    dlat += (160*Math.sin(y/12*Math.PI) + 320*Math.sin(y*Math.PI/30)) * 2/3;
    var dlng = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
    dlng += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
    dlng += (20*Math.sin(x*Math.PI) + 40*Math.sin(x/3*Math.PI)) * 2/3;
    dlng += (150*Math.sin(x/12*Math.PI) + 300*Math.sin(x/30*Math.PI)) * 2/3;
    var a = 6378245, ee = 0.00669342162296594323;
    var radlat = lat / 180 * Math.PI;
    var magic = 1 - ee * Math.sin(radlat) * Math.sin(radlat);
    var sqrtmagic = Math.sqrt(magic);
    dlat = (dlat * 180) / ((a * (1 - ee)) / (magic * sqrtmagic) * Math.PI);
    dlng = (dlng * 180) / (a / sqrtmagic * Math.cos(radlat) * Math.PI);
    return { lat: lat + dlat, lng: lng + dlng };
  }

  return { haversineDistance, nearestNeighborRoute, totalDistance, formatDistance, formatDuration, bearing, bearingToArrow, toGcj02 };
})();
