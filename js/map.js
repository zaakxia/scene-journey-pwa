// Scene Map — Leaflet + CartoDB Light tiles via GitHub Pages CDN
const SceneMap = (() => {
  let map, _markers = [], _onMarkerClick = null;
  let _tileLayer = null, _tempMarker = null;

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container || map) return;
    container.style.minHeight = '300px';
    container.style.background = '#f0ede6';
    container.style.touchAction = 'none';
    container.style.msTouchAction = 'none';

    map = L.map(containerId, {
      center: [35, 135],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      dragging: true,
      tap: true,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
      inertia: true,
      worldCopyJump: false
    });

    // Local dev vs deployed: GitHub Pages hosts tiles (no 20K file limit)
    var tileUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? '../assets/tiles/{z}/{x}/{y}.png'
      : 'https://zaakxia.github.io/scene-journey-pwa/assets/tiles/{z}/{x}/{y}.png';
    _tileLayer = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | <a href="https://carto.com/">CARTO</a>',
      maxNativeZoom: 15,
      maxZoom: 18,
      minZoom: 2,
      noWrap: true,
      bounds: [[-85, -180], [85, 180]]
    }).addTo(map);
    map.setMaxBounds([[-85, -180], [85, 180]]);
    map.setMinZoom(2);

    // Wire custom zoom buttons (WeChat-compatible)
    var zoomInBtn = document.getElementById('zoom-in-btn');
    var zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', function(e) { e.stopPropagation(); map.zoomIn(); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', function(e) { e.stopPropagation(); map.zoomOut(); });

    // Also keep Leaflet zoom as invisible fallback for keyboard a11y
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
  }

  function setIPMeta(meta) {}

  function showLocations(locations, onClick) {
    if (!map) return;
    _onMarkerClick = onClick;
    _markers.forEach(function(m) { map.removeLayer(m); });
    _markers = [];

    var checkins = Storage.getCheckins();
    var bookmarks = Storage.getBookmarks();
    var colors = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9b5de5'];

    var sharedRenderer = L.canvas({ padding: 0.5 });
    var minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    locations.forEach(function(loc) {
      var lat = loc.coordinates.lat, lng = loc.coordinates.lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;

      var isChecked = !!checkins[loc.id];
      var isFav = bookmarks.includes(loc.id);
      var color = colors[Math.abs(hashCode(loc.city || '')) % colors.length];
      var radius = isChecked ? 16 : 14; // min 28px diameter for touch targets

      var marker = L.circleMarker([lat, lng], {
        radius: radius,
        fillColor: isChecked ? '#2a9d8f' : color,
        color: '#fff',
        weight: 2.5,
        fillOpacity: 1,
        renderer: sharedRenderer
      });

      if (isFav) {
        var ring = L.circleMarker([lat, lng], {
          radius: radius + 5,
          fillColor: 'transparent',
          color: color,
          weight: 3,
          fillOpacity: 0,
          renderer: sharedRenderer
        });
        ring._locData = loc;
        ring._isRing = true;
        ring.on('click', function() { if (_onMarkerClick) _onMarkerClick(loc); });
        _markers.push(ring);
        map.addLayer(ring);
      }

      marker._locData = loc;
      marker._city = loc.city;
      marker._category = loc.category;
      marker._isMarker = true;

      // Chinese name label (permanent tooltip)
      if (loc.name_zh) {
        marker.bindTooltip(loc.name_zh, {
          permanent: true,
          direction: 'top',
          offset: [0, -radius - 6],
          className: 'marker-label'
        });
      }

      if (isChecked) {
        var sz = radius * 2;
        var icon = L.divIcon({
          className: 'leaflet-check-marker',
          html: '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" style="display:block;"><polyline points="20 6 9 17 4 12"/></svg>',
          iconSize: [sz, sz],
          iconAnchor: [sz/2, sz/2]
        });
        var chk = L.marker([lat, lng], { icon: icon, interactive: false, keyboard: false });
        marker._checkIcon = chk;
        map.addLayer(chk);
      }

      marker.on('click', function() { if (_onMarkerClick) _onMarkerClick(loc); });
      _markers.push(marker);
      map.addLayer(marker);
    });

    if (locations.length > 0) {
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [50, 50], maxZoom: 13, animate: false });
    }
  }

  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  function setMarkerVisible(m, visible) {
    if (visible) { map.addLayer(m); } else { map.removeLayer(m); }
  }

  function filterByCity(city) {
    _markers.forEach(function(m) {
      if (m._isMarker && m._city !== undefined) {
        setMarkerVisible(m, !city || m._city === city);
        if (m._checkIcon) setMarkerVisible(m._checkIcon, !city || m._city === city);
      }
      if (m._isRing && m._locData) {
        setMarkerVisible(m, !city || m._locData.city === city);
      }
    });
  }

  function filterByCategory(cat) {
    _markers.forEach(function(m) {
      if (m._isMarker && m._category !== undefined) {
        setMarkerVisible(m, !cat || m._category === cat);
        if (m._checkIcon) setMarkerVisible(m._checkIcon, !cat || m._category === cat);
      }
    });
  }

  function flyTo(lat, lng, z) {
    if (map) map.flyTo([lat, lng], z || 14, { duration: 0.4 });
  }

  function invalidateSize() {
    if (map) map.invalidateSize();
  }

  function showTempMarker(lat, lng, title) {
    if (!map) return;
    removeTempMarker();
    var icon = L.divIcon({
      className: 'temp-search-marker',
      html: '<div style="width:20px;height:20px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;box-shadow:0 0 0 3px rgba(29,78,216,0.3),0 2px 8px rgba(0,0,0,0.2);animation:temp-pulse 1.5s ease-in-out infinite;"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    _tempMarker = L.marker([lat, lng], { icon: icon, interactive: false }).addTo(map);
    if (title) {
      _tempMarker.bindTooltip(title, { permanent: true, direction: 'top', offset: [0, -14], className: 'temp-marker-label' });
    }
  }
  function removeTempMarker() {
    if (_tempMarker) { map.removeLayer(_tempMarker); _tempMarker = null; }
  }
  function switchSource(src) {}

  return {
    init: init,
    setIPMeta: setIPMeta,
    showLocations: showLocations,
    filterByCity: filterByCity,
    filterByCategory: filterByCategory,
    flyTo: flyTo,
    invalidateSize: invalidateSize,
    switchSource: switchSource,
    showTempMarker: showTempMarker,
    removeTempMarker: removeTempMarker
  };
})();
