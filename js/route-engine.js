// Route planning engine
const RouteEngine = (() => {

  function generateRoute(locations) {
    if (!locations || locations.length < 2) return null;

    const ordered = GeoUtils.nearestNeighborRoute(locations);
    const distance = GeoUtils.totalDistance(ordered);
    const duration = distance / 30; // Rough: 30 km/h avg with transit/walking

    return {
      id: 'custom_' + Date.now(),
      name_zh: `我的路线 (${ordered.length}个地点)`,
      description: `自定义路线，途经${ordered.length}个取景地`,
      location_ids: ordered.map(l => l.id),
      locations: ordered,
      estimated_distance: GeoUtils.formatDistance(distance),
      estimated_duration: GeoUtils.formatDuration(duration),
      difficulty: distance > 50 ? 'hard' : distance > 20 ? 'medium' : 'easy',
      created_by: 'user',
      created_at: Date.now()
    };
  }

  function reorderRoute(locations, newOrder) {
    return newOrder.map(idx => locations[idx]);
  }

  // Get route summary for display
  function summarize(route) {
    return {
      ...route,
      difficulty_zh: Format.difficulty(route.difficulty),
      location_count: route.location_ids.length,
      first_location: route.locations?.[0]?.name_zh || '',
      last_location: route.locations?.[route.locations.length - 1]?.name_zh || ''
    };
  }

  return { generateRoute, reorderRoute, summarize };
})();
