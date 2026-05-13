// scene-journey app - minimal bootstrap
window.App = { showToast: null };

(function() {
  function log(msg) {
    console.log('[APP]', msg);
  }

  try {
    log('app.js executing...');

    var ipMeta = null;
    var locations = [];
    var routes = [];
    var currentTab = null;

    function init() {
      log('init() called');
      try {
        // Tab clicks
        document.querySelectorAll('.bottom-bar .tab').forEach(function(tab) {
          tab.addEventListener('click', function() {
            var name = this.dataset.tab;
            log('Tab click: ' + name);
            if (name && typeof switchTab === 'function') switchTab(name);
          });
        });
        log('Tab handlers attached');

        // Read book from URL param
        var params = new URLSearchParams(location.search);
        var bookId = params.get('book') || 'dragon-raja';
        log('Book ID: ' + bookId);
        Storage.init(bookId);

        // Load data
        loadData(bookId);
      } catch(e) {
        log('ERROR in init: ' + e.message);
      }
    }

    async function loadData(bookId) {
      log('loadData() start');
      try {
        ipMeta = await DataLoader.loadIPMeta(bookId);
        log('Meta loaded: ' + ipMeta.name_zh);
        document.documentElement.dataset.book = bookId;
        locations = await DataLoader.loadLocations(bookId);
        log('Locations loaded: ' + locations.length);
        routes = await DataLoader.loadRoutes(bookId);
        log('Routes loaded: ' + routes.length);
      } catch(e) {
        log('DATA ERROR: ' + e.message);
        var errEl = document.getElementById('app-error');
        if (errEl) { errEl.innerHTML = '数据加载失败: ' + e.message; errEl.classList.remove('hidden'); }
        return;
      }

      // Init map
      SceneMap.init('map');
      SceneMap.setIPMeta(ipMeta);
      log('Map initialized');

      // Unified title bar
      var titleEl = document.getElementById('map-title-text');
      if (titleEl) {
        titleEl.textContent = (ipMeta.subtitle || ipMeta.name_zh) + ' · ' + locations.length + '个取景地';
      }
      log('Title bar updated');

      // Dynamic page title
      document.title = (ipMeta.subtitle || ipMeta.name_zh) + ' · 圣地巡礼 | scene-journey';

      // Show map tab
      switchTab('map');
      log('Initial tab: map');
    }

    function switchTab(tab) {
      log('switchTab: ' + tab + ' (current=' + currentTab + ')');
      if (currentTab === tab) { log('  same tab, skip'); return; }
      currentTab = tab;

      var mapEl = document.getElementById('map');
      var viewMap = document.getElementById('view-map');
      var viewPlan = document.getElementById('view-plan');
      var viewStory = document.getElementById('view-story');
      var viewBookmarks = document.getElementById('view-bookmarks');

      document.querySelectorAll('.bottom-bar .tab').forEach(function(el) {
        el.classList.toggle('active', el.dataset.tab === tab);
      });

      [viewMap, viewPlan, viewStory, viewBookmarks].forEach(function(v) {
        if (v) v.classList.add('hidden');
      });

      if (tab === 'map') {
        viewMap.classList.remove('hidden');
        if (mapEl) mapEl.style.display = '';
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            SceneMap.invalidateSize();
            renderMap();
          });
        });
      } else if (tab === 'plan') {
        viewPlan.classList.remove('hidden');
        if (mapEl) mapEl.style.display = 'none';
        renderPlan();
      } else if (tab === 'story') {
        viewStory.classList.remove('hidden');
        if (mapEl) mapEl.style.display = 'none';
        renderStory();
      } else if (tab === 'bookmarks') {
        viewBookmarks.classList.remove('hidden');
        if (mapEl) mapEl.style.display = 'none';
        renderMyPage();
      }
      log('switchTab done: ' + tab);
    }

    function renderMap() {
      log('renderMap');

      // Collapsible city filter
      var fb = document.getElementById('map-filter-bar');
      if (!fb) return;
      fb.innerHTML = '';
      var filterOptions = FilterBar.getFilterOptions(locations);
      var cityOptions = filterOptions.filter(function(o) { return o.value !== 'all'; });

      // Build city→color map for chip dots
      var colors = ['#e63946','#457b9d','#2a9d8f','#f4a261','#9b5de5'];
      var cityColor = {};
      cityOptions.forEach(function(c, i) { cityColor[c.value] = colors[i % colors.length]; });

      if (cityOptions.length > 0) {
        var expanded = false;
        var activeCity = null;

        function buildFilterHTML() {
          var arrow = expanded ? ' ▴' : ' ▾';
          var label = activeCity || '全部';
          var h = '<span class="map-filter-toggle' + (expanded ? ' expanded' : '') + '" id="filter-toggle">' + label + '<span class="arrow">' + arrow + '</span></span>';
          if (expanded) {
            h += '<button class="filter-chip' + (activeCity === null ? ' active' : '') + '" data-city="all">全部</button>';
            cityOptions.forEach(function(c) {
              var isActive = c.value === activeCity;
              var dot = '<span class="chip-dot" style="background:' + cityColor[c.value] + '"></span>';
              h += '<button class="filter-chip' + (isActive ? ' active' : '') + '" data-city="' + c.value + '">' + dot + c.label + '</button>';
            });
          }
          fb.innerHTML = h;

          var toggle = document.getElementById('filter-toggle');
          if (toggle) {
            toggle.onclick = function() {
              expanded = !expanded;
              buildFilterHTML();
            };
          }
          fb.querySelectorAll('.filter-chip').forEach(function(chip) {
            chip.onclick = function() {
              activeCity = chip.dataset.city === 'all' ? null : chip.dataset.city;
              expanded = false;
              SceneMap.filterByCity(activeCity);
              buildFilterHTML();
            };
          });
        }
        buildFilterHTML();
      }

      SceneMap.showLocations(locations, function(loc) {
        openSheet(loc);
      });
      updateBadges();

      // Wire up layer menu
      wireLayerMenu();
    }

    function wireLayerMenu() {
      var menu = document.getElementById('layer-menu');
      var btn = document.getElementById('map-layer-btn');
      if (!menu || !btn) return;

      btn.onclick = function(e) { e.stopPropagation(); menu.classList.toggle('show'); };

      document.addEventListener('click', function hideMenu() {
        if (menu.classList.contains('show')) menu.classList.remove('show');
      }, { once: false });

      menu.querySelectorAll('.layer-opt').forEach(function(opt) {
        opt.onclick = function(e) {
          e.stopPropagation();
          var src = opt.dataset.src;
          menu.querySelectorAll('.layer-opt').forEach(function(o) { o.classList.remove('active'); });
          opt.classList.add('active');
          menu.classList.remove('show');
          if (typeof SceneMap !== 'undefined' && SceneMap.switchSource) {
            SceneMap.switchSource(src);
          }
        };
      });
    }

    function openSheet(loc) {
      BottomSheet.open(LocationCard.render(loc, {}), null);
      LocationCard.bindEvents(loc, {
        onBookmark: function() { renderMap(); updateBadges(); },
        onCheckin: function() { renderMap(); updateBadges(); }
      });
    }

    function navigateToLoc(loc) {
      switchTab('map');
      setTimeout(function() {
        SceneMap.filterByCity(null);
        SceneMap.flyTo(loc.coordinates.lat, loc.coordinates.lng, 14);
        setTimeout(function() { openSheet(loc); }, 400);
      }, 200);
    }

    function renderPlan() {
      log('renderPlan');
      var container = document.getElementById('view-plan-content');
      if (!container) return;

      var bookmarks = Storage.getBookmarks();
      var planLocs = locations.filter(function(l) { return bookmarks.indexOf(l.id) >= 0; });
      var checkins = Storage.getCheckins();

      if (planLocs.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding-top:64px;"><div style="color:var(--color-text-secondary);">' + Icons.map + '</div><div class="font-bold">还没有收藏取景地</div><div class="text-sm text-secondary">在地图上收藏取景地后，在这里规划游览顺序</div></div>';
        return;
      }

      // ── Scheduler State ──
      var schedule = Storage.get('schedule');
      if (!schedule || !schedule.days) {
        schedule = { days: [{ day: 1, label: '第1天', blocks: [] }] };
      }
      var currentDayIdx = 0;
      var selectedLocId = null;
      var planMode = 'manual'; // 'manual' = 个人规划, 'auto' = 系统推荐
      var optRouteLocs = [];   // loc IDs selected for optimal route
      var optRouteEngine = 'here'; // 'amap' | 'amap-transit' | 'amap-best' | 'here' | 'here-transit' | 'here-walk' | 'here-best'
      var optRouteResult = null;   // {ordered: [...], totalMin: N}
      var optDays = 1;         // number of play days
      var optDayStart = 16;    // 8:00 slot
      var optDayEnd = 40;      // 20:00 slot
      var daysExpanded = true; // day tabs expand/collapse state
      var SLOT_H = 18; // px per half-hour (wider for easier tapping)
      // City accent colors for blocks
      var cityColors = ['#e63946','#457b9d','#2a9d8f','#f4a261','#9b5de5','#e76f51','#264653'];
      var cityColorMap = {};
      var ci = 0;
      planLocs.forEach(function(l) { if (!cityColorMap[l.city]) { cityColorMap[l.city] = cityColors[ci % cityColors.length]; ci++; } });
      var COL_H = 24 * SLOT_H; // 24 slots × 13px = 312px per 12h column

      function locById(id) { return planLocs.find(function(l) { return l.id === id; }); }

      function parseDuration(durStr) {
        if (!durStr) return 3;
        var h = durStr.match(/(\d+)\s*小时/);
        var d = durStr.match(/(\d+)\s*天/);
        var m = durStr.match(/(\d+)\s*分钟/);
        if (d) return parseInt(d[1]) * 24; // 1天=12h=24 half-hour slots
        var total = 0;
        if (h) total += parseInt(h[1]) * 2;
        if (m) total += Math.ceil(parseInt(m[1]) / 30);
        return Math.max(1, total); // minimum 30min = 1 half-hour
      }

      function slotsToTime(slotIdx) {
        var h = Math.floor(slotIdx / 2);
        var m = (slotIdx % 2) * 30;
        return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
      }

      // Operating hours: use JSON data if available, else category default
      function getOpenHours(loc) {
        if (loc.open_time !== undefined && loc.close_time !== undefined) {
          return { open: loc.open_time, close: loc.close_time };
        }
        var cat = loc.category || 'other';
        if (cat === 'landmark' || cat === 'street') return { open: 0, close: 48 };
        if (cat === 'nature') return { open: 12, close: 36 };
        if (cat === 'interior') return { open: 18, close: 34 };
        return { open: 0, close: 48 };
      }

      // Time-of-day background (WCAG AA contrast)
      function slotBg(slot) {
        if (slot < 10)  return '#dce3eb';  // night 0:00-5:00
        if (slot < 16)  return '#fef0c0';  // morning 5:00-8:00
        if (slot < 36)  return '#f4f7fa';  // day 8:00-18:00
        if (slot < 44)  return '#fdd5a0';  // evening 18:00-22:00
        return '#dce3eb';                   // night 22:00-24:00
      }

      // ── Transit time: 高德 API（主）+ OSRM（备用）──
      var transitCache = {};
      var transitDetail = {}; // {key: {minutes, engine}} for display — raw minutes before ceiling
      var AMAP_KEY = '5863650c584b70f0acfcc28ce028f90d';
      var HERE_KEY = 'dMiGuj4zcqtcdaecBgclwcZ44IYRALPP9X_q9A28Ajg';
      var URBAN_SPEED = 25; // km/h 市内公交
      var TRANSIT_FACTOR = 1.6; // 公交≈驾车×1.6（含步行到站+候车+换乘，UITP/INRIX数据）
      var useAmap = true; // default 高德(国内实时路况), HERE as global engine
      var amapTransitMode = false; // true = 高德公交, false = 高德驾车
      var hereCallCount = 0; // Rate limit tracker for HERE API (250K/month free)

      function prefetchTransit() {
        var pairs = [];
        for (var i = 0; i < planLocs.length; i++) {
          for (var j = 0; j < planLocs.length; j++) {
            if (i === j) continue;
            pairs.push([planLocs[i], planLocs[j]]);
          }
        }
        var idx = 0;
        function nextBatch() {
          var batch = pairs.slice(idx, idx + 3);
          idx += 3;
          batch.forEach(function(pair) { fetchTransit(pair[0], pair[1]); });
          if (idx < pairs.length) setTimeout(nextBatch, 250);
        }
        nextBatch();
      }

      function isChina(loc) {
        var lng = loc.coordinates.lng, lat = loc.coordinates.lat;
        // lng capped at 128 to exclude Japan (松山 at lng 132.7 was a false positive)
        return lng >= 73 && lng <= 128 && lat >= 18 && lat <= 54;
      }

      function fetchTransit(fromLoc, toLoc, cb) {
        var cacheKey = fromLoc.id + '|' + toLoc.id;
        if (transitCache[cacheKey] !== undefined) {
          if (cb) cb();
          return;
        }

        // Only set placeholder for background prefetch (no callback);
        // when cb is provided (explicit query), skip placeholder so caller waits for real API result
        if (!cb) {
          var sameCity = fromLoc.city === toLoc.city;
          transitCache[cacheKey] = sameCity ? 2 : 4;
        }

        var bothChina = isChina(fromLoc) && isChina(toLoc);
        if (useAmap && bothChina) {
          if (amapTransitMode) {
            fetchAmapTransit(fromLoc, toLoc, cacheKey, cb);
          } else {
            fetchAmap(fromLoc, toLoc, cacheKey, cb);
          }
        } else {
          fetchHERE(fromLoc, toLoc, cacheKey, cb);
        }
      }

      function fetchAmap(fromLoc, toLoc, cacheKey, cb, retry) {
        var from = GeoUtils.toGcj02(fromLoc.coordinates.lat, fromLoc.coordinates.lng);
        var to = GeoUtils.toGcj02(toLoc.coordinates.lat, toLoc.coordinates.lng);
        var url = 'https://restapi.amap.com/v3/direction/driving?' +
          'origin=' + from.lng + ',' + from.lat +
          '&destination=' + to.lng + ',' + to.lat +
          '&key=' + AMAP_KEY;
        fetch(url).then(function(r) { return r.json(); }).then(function(data) {
          if (data && data.status === '1' && data.route && data.route.paths && data.route.paths[0]) {
            var roadKm = parseInt(data.route.paths[0].distance) / 1000;
            var durationMin = parseInt(data.route.paths[0].duration) / 60;
            transitCache[cacheKey] = Math.max(1, Math.ceil(durationMin / 30));
            transitDetail[cacheKey] = { minutes: Math.round(durationMin), engine: 'amap' };
            log('高德 ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + roadKm.toFixed(1) + 'km, ' + Math.round(durationMin) + 'min');
          } else if (!retry) {
            // API returned non-success — retry once after a short delay
            log('高德 retry ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': status=' + (data ? data.status + ' ' + (data.info||'') : 'no data'));
            setTimeout(function() { fetchAmap(fromLoc, toLoc, cacheKey, cb, true); }, 600);
            return;
          } else {
            log('高德 FAIL ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': status=' + (data ? data.status + ' ' + (data.info||'') : 'no data'));
            fetchOSRM(fromLoc, toLoc, cacheKey, cb);
            return;
          }
          if (cb) cb();
        }).catch(function(e) {
          if (!retry) {
            log('高德 retry(net) ' + fromLoc.name_zh + '→' + toLoc.name_zh);
            setTimeout(function() { fetchAmap(fromLoc, toLoc, cacheKey, cb, true); }, 600);
          } else {
            log('高德 FAIL(net) ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + (e ? e.message : ''));
            fetchOSRM(fromLoc, toLoc, cacheKey, cb);
          }
        });
      }

      function fetchAmapTransit(fromLoc, toLoc, cacheKey, cb, retry) {
        var from = GeoUtils.toGcj02(fromLoc.coordinates.lat, fromLoc.coordinates.lng);
        var to = GeoUtils.toGcj02(toLoc.coordinates.lat, toLoc.coordinates.lng);
        var url = 'https://restapi.amap.com/v3/direction/transit/integrated?' +
          'origin=' + from.lng + ',' + from.lat +
          '&destination=' + to.lng + ',' + to.lat +
          '&city=' + encodeURIComponent(fromLoc.city) +
          '&key=' + AMAP_KEY;
        fetch(url).then(function(r) { return r.json(); }).then(function(data) {
          if (data && data.status === '1' && data.route && data.route.transits && data.route.transits[0]) {
            var t = data.route.transits[0];
            var durationMin = parseInt(t.duration) / 60;
            transitCache[cacheKey] = Math.max(1, Math.ceil(durationMin / 30));
            transitDetail[cacheKey] = { minutes: Math.round(durationMin), engine: 'amap-transit' };
            log('高德公交 ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + Math.round(durationMin) + 'min');
            if (cb) cb();
          } else if (!retry) {
            // Transit returned no route — retry once
            log('高德公交 retry ' + fromLoc.name_zh + '→' + toLoc.name_zh);
            setTimeout(function() { fetchAmapTransit(fromLoc, toLoc, cacheKey, cb, true); }, 600);
          } else {
            // Transit still no route after retry — fall back to OSRM
            log('高德公交→OSRM ' + fromLoc.name_zh + '→' + toLoc.name_zh);
            fetchOSRM(fromLoc, toLoc, cacheKey, cb);
          }
        }).catch(function(e) {
          if (!retry) {
            log('高德公交 retry(net) ' + fromLoc.name_zh + '→' + toLoc.name_zh);
            setTimeout(function() { fetchAmapTransit(fromLoc, toLoc, cacheKey, cb, true); }, 600);
          } else {
            // Network error after retry — fall back to OSRM
            fetchOSRM(fromLoc, toLoc, cacheKey, cb);
          }
        });
      }

      function fetchAmapWalk(fromLoc, toLoc, cacheKey, cb) {
        var from = GeoUtils.toGcj02(fromLoc.coordinates.lat, fromLoc.coordinates.lng);
        var to = GeoUtils.toGcj02(toLoc.coordinates.lat, toLoc.coordinates.lng);
        var url = 'https://restapi.amap.com/v3/direction/walking?' +
          'origin=' + from.lng + ',' + from.lat +
          '&destination=' + to.lng + ',' + to.lat +
          '&key=' + AMAP_KEY;
        fetch(url).then(function(r) { return r.json(); }).then(function(data) {
          if (data && data.status === '1' && data.route && data.route.paths && data.route.paths[0]) {
            var durationMin = parseInt(data.route.paths[0].duration) / 60;
            transitCache[cacheKey] = Math.max(1, Math.ceil(durationMin / 30));
            transitDetail[cacheKey] = { minutes: Math.round(durationMin), engine: 'amap-walk' };
            log('高德步行 ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + Math.round(durationMin) + 'min');
          } else {
            log('高德步行 FAIL ' + fromLoc.name_zh + '→' + toLoc.name_zh);
            fetchOSRM(fromLoc, toLoc, cacheKey, cb);
            return;
          }
          if (cb) cb();
        }).catch(function() {
          log('高德步行 FAIL(net) ' + fromLoc.name_zh + '→' + toLoc.name_zh);
          fetchOSRM(fromLoc, toLoc, cacheKey, cb);
        });
      }

      function fetchAmapBest(fromLoc, toLoc, cacheKey, cb) {
        var modes = [
          { name: 'driving',  label: '驾车', url: 'https://restapi.amap.com/v3/direction/driving' },
          { name: 'transit',  label: '公交', url: 'https://restapi.amap.com/v3/direction/transit/integrated' },
          { name: 'walking',  label: '步行', url: 'https://restapi.amap.com/v3/direction/walking' }
        ];
        var results = [];
        var done = 0;
        var from = GeoUtils.toGcj02(fromLoc.coordinates.lat, fromLoc.coordinates.lng);
        var to = GeoUtils.toGcj02(toLoc.coordinates.lat, toLoc.coordinates.lng);

        modes.forEach(function(mode) {
          var murl = mode.url + '?origin=' + from.lng + ',' + from.lat +
            '&destination=' + to.lng + ',' + to.lat +
            (mode.name === 'transit' ? '&city=' + encodeURIComponent(fromLoc.city) : '') +
            '&key=' + AMAP_KEY;

          fetch(murl).then(function(r) { return r.json(); }).then(function(data) {
            var ok = false;
            if (data && data.status === '1' && data.route) {
              if (mode.name === 'transit' && data.route.transits && data.route.transits[0]) {
                results.push({ name: mode.name, label: mode.label, min: Math.round(parseInt(data.route.transits[0].duration) / 60) });
                ok = true;
              } else if (data.route.paths && data.route.paths[0]) {
                results.push({ name: mode.name, label: mode.label, min: Math.round(parseInt(data.route.paths[0].duration) / 60) });
                ok = true;
              }
            }
            if (!ok) {
              // Transit might return no route for close points — that's expected, just skip
              log('高德最优 ' + mode.label + ' ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': 无结果');
            }
            done++;
            if (done >= modes.length) finish();
          }).catch(function() {
            log('高德最优 ' + mode.label + ' FAIL ' + fromLoc.name_zh + '→' + toLoc.name_zh);
            done++;
            if (done >= modes.length) finish();
          });
        });

        function finish() {
          if (results.length > 0) {
            // Pick the mode with minimum duration
            results.sort(function(a, b) { return a.min - b.min; });
            var best = results[0];
            transitCache[cacheKey] = Math.max(1, Math.ceil(best.min / 30));
            transitDetail[cacheKey] = { minutes: best.min, engine: 'amap-best', submode: best.label };
            log('高德最优 → ' + best.label + ' ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + best.min + 'min');
          } else {
            log('高德最优 ALL FAIL ' + fromLoc.name_zh + '→' + toLoc.name_zh);
            fetchOSRM(fromLoc, toLoc, cacheKey, cb);
            return;
          }
          if (cb) cb();
        }
      }

      // HERE Maps API — global routing (driving, transit, walking)
      function fetchHERE(fromLoc, toLoc, cacheKey, cb) {
        hereCallCount++;
        var url = 'https://router.hereapi.com/v8/routes?transportMode=car' +
          '&origin=' + fromLoc.coordinates.lat + ',' + fromLoc.coordinates.lng +
          '&destination=' + toLoc.coordinates.lat + ',' + toLoc.coordinates.lng +
          '&apiKey=' + HERE_KEY + '&return=summary';
        fetch(url).then(function(r) { return r.json(); }).then(function(data) {
          if (data && data.routes && data.routes[0] && data.routes[0].sections && data.routes[0].sections[0]) {
            var s = data.routes[0].sections[0].summary;
            var durMin = Math.round(s.duration / 60);
            var km = s.length / 1000;
            transitCache[cacheKey] = Math.max(1, Math.ceil(durMin / 30));
            transitDetail[cacheKey] = { minutes: durMin, engine: 'here' };
            log('HERE驾车 ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + km.toFixed(1) + 'km, ' + durMin + 'min');
          } else {
            log('HERE驾车 FAIL ' + fromLoc.name_zh + '→' + toLoc.name_zh + ' — fallback OSRM');
            fetchOSRM(fromLoc, toLoc, cacheKey, cb);
            return;
          }
          if (cb) cb();
        }).catch(function() {
          log('HERE驾车 ERR ' + fromLoc.name_zh + '→' + toLoc.name_zh + ' — fallback OSRM');
          fetchOSRM(fromLoc, toLoc, cacheKey, cb);
        });
      }

      function fetchHERETransit(fromLoc, toLoc, cacheKey, cb) {
        hereCallCount++;
        var url = 'https://router.hereapi.com/v8/routes?transportMode=publicTransport' +
          '&origin=' + fromLoc.coordinates.lat + ',' + fromLoc.coordinates.lng +
          '&destination=' + toLoc.coordinates.lat + ',' + toLoc.coordinates.lng +
          '&apiKey=' + HERE_KEY + '&return=summary';
        fetch(url).then(function(r) { return r.json(); }).then(function(data) {
          if (data && data.routes && data.routes[0] && data.routes[0].sections && data.routes[0].sections[0]) {
            var s = data.routes[0].sections[0].summary;
            var durMin = Math.round(s.duration / 60);
            transitCache[cacheKey] = Math.max(1, Math.ceil(durMin / 30));
            transitDetail[cacheKey] = { minutes: durMin, engine: 'here-transit' };
            log('HERE公交 ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + durMin + 'min');
          } else {
            log('HERE公交 FAIL ' + fromLoc.name_zh + '→' + toLoc.name_zh + ' — estimate');
            var km = GeoUtils.haversineDistance(fromLoc.coordinates.lat, fromLoc.coordinates.lng, toLoc.coordinates.lat, toLoc.coordinates.lng);
            var durMin = Math.round((km / URBAN_SPEED) * 60 * TRANSIT_FACTOR);
            transitCache[cacheKey] = Math.max(1, Math.ceil((km / URBAN_SPEED) * 2 * TRANSIT_FACTOR));
            transitDetail[cacheKey] = { minutes: durMin, engine: 'here-transit-est' };
          }
          if (cb) cb();
        }).catch(function() {
          log('HERE公交 ERR ' + fromLoc.name_zh + '→' + toLoc.name_zh + ' — estimate');
          var km = GeoUtils.haversineDistance(fromLoc.coordinates.lat, fromLoc.coordinates.lng, toLoc.coordinates.lat, toLoc.coordinates.lng);
          var durMin = Math.round((km / URBAN_SPEED) * 60 * TRANSIT_FACTOR);
          transitCache[cacheKey] = Math.max(1, Math.ceil((km / URBAN_SPEED) * 2 * TRANSIT_FACTOR));
          transitDetail[cacheKey] = { minutes: durMin, engine: 'here-transit-est' };
          if (cb) cb();
        });
      }

      function fetchHEREWalk(fromLoc, toLoc, cacheKey, cb) {
        hereCallCount++;
        var url = 'https://router.hereapi.com/v8/routes?transportMode=pedestrian' +
          '&origin=' + fromLoc.coordinates.lat + ',' + fromLoc.coordinates.lng +
          '&destination=' + toLoc.coordinates.lat + ',' + toLoc.coordinates.lng +
          '&apiKey=' + HERE_KEY + '&return=summary';
        fetch(url).then(function(r) { return r.json(); }).then(function(data) {
          if (data && data.routes && data.routes[0] && data.routes[0].sections && data.routes[0].sections[0]) {
            var s = data.routes[0].sections[0].summary;
            var durMin = Math.round(s.duration / 60);
            transitCache[cacheKey] = Math.max(1, Math.ceil(durMin / 30));
            transitDetail[cacheKey] = { minutes: durMin, engine: 'here-walk' };
            log('HERE步行 ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + durMin + 'min');
          } else {
            log('HERE步行 FAIL ' + fromLoc.name_zh + '→' + toLoc.name_zh);
            if (cb) cb();
            return;
          }
          if (cb) cb();
        }).catch(function() {
          log('HERE步行 ERR ' + fromLoc.name_zh + '→' + toLoc.name_zh);
          if (cb) cb();
        });
      }

      function fetchHEREBest(fromLoc, toLoc, cacheKey, cb) {
        var modes = [
          { name: 'driving',  label: '驾车', fn: fetchHERE },
          { name: 'transit',  label: '公交', fn: fetchHERETransit },
          { name: 'walking',  label: '步行', fn: fetchHEREWalk }
        ];
        var results = [];
        var done = 0;

        modes.forEach(function(mode) {
          mode.fn(fromLoc, toLoc, cacheKey, function() {
            var det = transitDetail[cacheKey];
            if (det && (det.engine === 'here' || det.engine === 'here-transit' || det.engine === 'here-walk')) {
              results.push({ name: mode.name, label: mode.label, min: det.minutes, engine: det.engine });
            }
            done++;
            if (done >= modes.length) finish();
          });
        });

        function finish() {
          if (results.length > 0) {
            results.sort(function(a, b) { return a.min - b.min; });
            var best = results[0];
            transitCache[cacheKey] = Math.max(1, Math.ceil(best.min / 30));
            transitDetail[cacheKey] = { minutes: best.min, engine: 'here-best', submode: best.label };
            log('HERE最优 → ' + best.label + ' ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + best.min + 'min');
          } else {
            log('HERE最优 ALL FAIL ' + fromLoc.name_zh + '→' + toLoc.name_zh + ' — fallback OSRM');
            fetchOSRM(fromLoc, toLoc, cacheKey, cb);
            return;
          }
          if (cb) cb();
        }
      }

      // OSRM fallback only — use when HERE fails
      function fetchOSRM(fromLoc, toLoc, cacheKey, cb) {
        var url = 'https://router.project-osrm.org/route/v1/driving/' +
          fromLoc.coordinates.lng + ',' + fromLoc.coordinates.lat + ';' +
          toLoc.coordinates.lng + ',' + toLoc.coordinates.lat + '?overview=false';
        fetch(url).then(function(r) { return r.json(); }).then(function(data) {
          if (data && data.routes && data.routes[0]) {
            var roadKm = data.routes[0].distance / 1000;
            var durMin = Math.round((roadKm / URBAN_SPEED) * 60);
            transitCache[cacheKey] = Math.max(1, Math.ceil((roadKm / URBAN_SPEED) * 2));
            transitDetail[cacheKey] = { minutes: durMin, engine: 'osrm' };
            log('OSRM(fallback) ' + fromLoc.name_zh + '→' + toLoc.name_zh + ': ' + roadKm.toFixed(1) + 'km');
          }
          if (cb) cb();
        }).catch(function() {
          if (cb) cb();
        });
      }

      function estimateTransit(fromLoc, toLoc) {
        var key = fromLoc.id + '|' + toLoc.id;
        if (transitCache[key] !== undefined) return transitCache[key];
        fetchTransit(fromLoc, toLoc);
        return fromLoc.city === toLoc.city ? 2 : 4;
      }

      // ── Build UI ──
      function buildHTML() {
        var day = schedule.days[currentDayIdx];
        var usedIds = [];
        schedule.days.forEach(function(d) {
          d.blocks.forEach(function(b) { usedIds.push(b.locId); });
        });

        var h = '<div style="padding:0 0 80px;">';

        // ── Mode Toggle ──
        h += '<div style="display:flex;padding:4px;margin:8px 10px;background:#f0ede8;border-radius:10px;gap:2px;">';
        h += '<button class="plan-mode-btn" data-mode="manual" style="flex:1;padding:8px;border-radius:8px;border:none;font-size:12px;font-weight:' + (planMode === 'manual' ? '700' : '500') + ';background:' + (planMode === 'manual' ? '#fff' : 'transparent') + ';color:' + (planMode === 'manual' ? '#1c1917' : 'var(--color-text-secondary)') + ';box-shadow:' + (planMode === 'manual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none') + ';cursor:pointer;transition:all 0.15s ease;">个人规划</button>';
        h += '<button class="plan-mode-btn" data-mode="auto" style="flex:1;padding:8px;border-radius:8px;border:none;font-size:12px;font-weight:' + (planMode === 'auto' ? '700' : '500') + ';background:' + (planMode === 'auto' ? '#fff' : 'transparent') + ';color:' + (planMode === 'auto' ? '#1c1917' : 'var(--color-text-secondary)') + ';box-shadow:' + (planMode === 'auto' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none') + ';cursor:pointer;transition:all 0.15s ease;">智能推荐</button>';
        h += '</div>';

        if (planMode === 'manual') {
        // ── Day tabs ──
        h += '<div style="display:flex;align-items:center;gap:4px;padding:8px 10px;overflow-x:auto;border-bottom:1px solid var(--color-border);">';
        // Clickable 日程 to toggle expand/collapse
        var collapseArrow = daysExpanded ? ' ▴' : ' ▾';
        h += '<span id="sched-toggle-days" style="font-size:11px;font-weight:600;color:var(--color-text-secondary);margin-right:2px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;">日程' + (schedule.days.length > 1 ? collapseArrow : '') + '</span>';
        schedule.days.forEach(function(d, di) {
          var isActive = di === currentDayIdx;
          var dayCount = 0;
          d.blocks.forEach(function(b) { dayCount++; });
          if (!daysExpanded && !isActive) return;
          // Unified pill: [day label | ×]
          var bg = isActive ? 'var(--color-text)' : 'rgba(0,0,0,0.06)';
          var fg = isActive ? '#fff' : 'var(--color-text-secondary)';
          h += '<div style="display:flex;align-items:center;flex-shrink:0;border-radius:999px;background:' + bg + ';overflow:hidden;">';
          h += '<button class="sched-day-tab" data-di="' + di + '" style="padding:4px 7px;border:none;font-size:10px;font-weight:' + (isActive ? '600' : '500') + ';background:transparent;color:' + fg + ';cursor:pointer;white-space:nowrap;">' + d.label + (dayCount > 0 ? '·' + dayCount : '') + '</button>';
          if (schedule.days.length > 1) {
            h += '<span style="color:' + fg + ';opacity:0.2;font-size:10px;">|</span>';
            h += '<button class="sched-del-day" data-di="' + di + '" style="padding:4px 5px;border:none;background:transparent;color:' + fg + ';cursor:pointer;font-size:10px;line-height:1;opacity:0.5;">×</button>';
          }
          h += '</div>';
        });
        if (daysExpanded && schedule.days.length < 7) {
          h += '<button id="sched-add-day" style="flex-shrink:0;width:26px;height:26px;border-radius:50%;border:1.5px dashed var(--color-border);background:none;color:var(--color-text-secondary);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>';
        }
        // Transit toggle
        h += '<span style="margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0;">';
        h += '<span style="font-size:11px;font-weight:600;color:var(--color-text-secondary);">交通</span>';
        h += '<button id="sched-toggle-transit" style="padding:3px 8px;border-radius:999px;border:1px solid var(--color-border);font-size:11px;font-weight:600;background:' + (useAmap ? 'var(--color-primary)' : 'var(--color-border)') + ';color:' + (useAmap ? '#fff' : 'var(--color-text-secondary)') + ';cursor:pointer;">' + (useAmap ? '高德' : 'HERE') + '</button>';
        h += '<button id="sched-alt-engine" style="padding:3px 6px;border-radius:999px;border:1px solid var(--color-border);font-size:10px;font-weight:500;background:#fff;color:var(--color-text-secondary);cursor:pointer;">' + (useAmap ? 'HERE' : '高德') + '</button>';
        h += '</span>';
        h += '</div>';

        // ── Two-column timeline ──
        h += '<div id="sched-timeline" style="display:flex;gap:4px;padding:4px;overflow-y:auto;max-height:55vh;overscroll-behavior:contain;">';

        // Left: AM 0:00-12:00 (slots 0-23)
        h += '<div style="flex:1;position:relative;min-width:0;">';
        h += '<div style="text-align:center;font-size:10px;font-weight:600;color:var(--color-text-secondary);padding:4px 0;position:sticky;top:0;background:#faf8f5;z-index:2;">上午 0:00-12:00</div>';
        // Slot grid (touch-optimized)
        for (var slot = 0; slot < 24; slot++) {
          var isHour = slot % 2 === 0;
          h += '<div class="sched-slot" data-slot="' + slot + '" style="height:' + SLOT_H + 'px;background:' + slotBg(slot) + ';' + (isHour ? 'border-top:1px solid rgba(0,0,0,0.08);' : '') + ';touch-action:manipulation;">';
          if (isHour) {
            h += '<span style="position:relative;left:2px;top:-6px;font-size:9px;color:rgba(0,0,0,0.35);font-weight:500;z-index:0;">' + slotsToTime(slot) + '</span>';
          }
          h += '</div>';
        }
        // Blocks layer (positioned relative to column)
        h += '<div style="position:absolute;top:24px;left:0;right:0;bottom:0;pointer-events:none;">';
        h += renderAllBlocks(day, 'am');
        h += '</div>';
        h += '</div>';

        // Right: PM 12:00-24:00 (slots 24-47)
        h += '<div style="flex:1;position:relative;min-width:0;">';
        h += '<div style="text-align:center;font-size:10px;font-weight:600;color:var(--color-text-secondary);padding:4px 0;position:sticky;top:0;background:#faf8f5;z-index:2;">下午 12:00-24:00</div>';
        for (var slot = 24; slot < 48; slot++) {
          var isHour = slot % 2 === 0;
          h += '<div class="sched-slot" data-slot="' + slot + '" style="height:' + SLOT_H + 'px;background:' + slotBg(slot) + ';' + (isHour ? 'border-top:1px solid rgba(0,0,0,0.08);' : '') + ';touch-action:manipulation;">';
          if (isHour) {
            h += '<span style="position:relative;left:2px;top:-6px;font-size:9px;color:rgba(0,0,0,0.35);font-weight:500;z-index:0;">' + slotsToTime(slot) + '</span>';
          }
          h += '</div>';
        }
        h += '<div style="position:absolute;top:24px;left:0;right:0;bottom:0;pointer-events:none;">';
        h += renderAllBlocks(day, 'pm');
        h += '</div>';
        h += '</div>';

        h += '</div>'; // end timeline

        // Transit gaps between blocks — use actual cached transit times
        h += '<div id="sched-gaps" style="font-size:10px;color:var(--color-text-secondary);padding:6px 8px;">';
        h += '<div style="font-weight:600;font-size:10px;color:var(--color-text-secondary);margin-bottom:4px;">交通时间</div>';
        for (var bi = 0; bi < day.blocks.length - 1; bi++) {
          var b1 = day.blocks[bi];
          var b2 = day.blocks[bi+1];
          var gapSlots = b2.startSlot - (b1.startSlot + b1.slots);
          if (gapSlots < 1) continue;
          var l1 = locById(b1.locId); var l2 = locById(b2.locId);
          if (!l1 || !l2) continue;
          var detailKey = b1.locId + '|' + b2.locId;
          var det = transitDetail[detailKey];
          var engineLabel = '';
          if (det) {
            if (det.engine === 'amap') engineLabel = '高德';
            else if (det.engine === 'amap-transit') engineLabel = '高德公交';
            else if (det.engine === 'amap-walk') engineLabel = '高德步行';
            else if (det.engine === 'amap-best') engineLabel = '高德最优';
            else if (det.engine === 'here') engineLabel = 'HERE';
            else if (det.engine === 'here-transit') engineLabel = 'HERE公交';
            else if (det.engine === 'here-walk') engineLabel = 'HERE步行';
            else if (det.engine === 'here-best') engineLabel = 'HERE最优';
            else if (det.engine === 'here-transit-est') engineLabel = 'HERE公交(估算)';
            else engineLabel = 'OSRM';
          }
          var rawMin = det ? det.minutes : (gapSlots * 30);
          var roundedMin = Math.ceil(rawMin / 30) * 30;
          var hasDetail = !!det;
          h += '<div style="display:flex;align-items:center;gap:6px;padding:3px 6px;margin-bottom:2px;background:#fafaf8;border-radius:4px;">';
          h += '<span style="font-weight:600;font-size:10px;color:#1c1917;">' + l1.name_zh + ' → ' + l2.name_zh + '</span>';
          if (hasDetail) {
            h += '<span style="font-size:9px;color:#d97706;font-weight:500;">' + engineLabel + '驾车 ' + rawMin + '分钟</span>';
            h += '<span style="font-size:9px;color:var(--color-text-secondary);">→ 取整 <b>' + roundedMin + '分钟</b></span>';
          } else {
            h += '<span style="font-size:9px;color:var(--color-text-secondary);">估算 ' + rawMin + '分钟（等待API查询）</span>';
          }
          if (gapSlots * 30 !== roundedMin) {
            h += '<span style="font-size:9px;color:rgba(0,0,0,0.3);">（间隔' + (gapSlots*30) + 'min）</span>';
          }
          h += '</div>';
        }
        h += '</div>';

        // ── Selected indicator ──
        h += '<div id="sched-selected" style="padding:6px 10px;font-size:12px;color:var(--color-text-secondary);text-align:center;border-top:1px solid var(--color-border);min-height:32px;">';
        if (selectedLocId && locById(selectedLocId)) {
          var sl = locById(selectedLocId);
          h += '<span style="color:var(--color-primary);font-weight:600;">' + sl.name_zh + '</span> 已选中 — 点击时间线放置';
        } else {
          h += '点击下方地点 → 点击上方时间线放置';
        }
        h += '</div>';

        // ── City-grouped cards ──
        var byCity = {};
        planLocs.forEach(function(loc) {
          if (!byCity[loc.city]) byCity[loc.city] = [];
          byCity[loc.city].push(loc);
        });
        h += '<div style="padding:4px 6px;">';
        Object.keys(byCity).forEach(function(city) {
          var cityLocs = byCity[city];
          // Sort: unplaced first, placed last
          cityLocs.sort(function(a, b) {
            var aUsed = usedIds.indexOf(a.id) >= 0 ? 1 : 0;
            var bUsed = usedIds.indexOf(b.id) >= 0 ? 1 : 0;
            return aUsed - bUsed;
          });
          h += '<div style="margin-bottom:4px;">';
          h += '<div style="font-size:11px;font-weight:700;color:var(--color-text-secondary);padding:3px 2px;">' + city + '</div>';
          h += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
          cityLocs.forEach(function(loc) {
            var used = usedIds.indexOf(loc.id) >= 0;
            var sel = selectedLocId === loc.id;
            var durStr = loc.visit_duration || '1h';
            var oh = getOpenHours(loc);
            var ohStr = '';
            if (oh.open !== 0 || oh.close !== 48) {
              ohStr = ' (' + slotsToTime(oh.open) + '-' + slotsToTime(oh.close) + ')';
            }
            h += '<button class="sched-card' + (sel ? ' selected' : '') + (used ? ' used' : '') + '" data-lid="' + loc.id + '" style="padding:5px 8px;border-radius:6px;border:1.5px solid ' + (sel ? 'var(--color-primary)' : 'var(--color-border)') + ';background:' + (sel ? 'rgba(185,28,28,0.06)' : (used ? '#f5f5f0' : '#fff')) + ';font-size:11px;cursor:pointer;text-align:left;opacity:' + (used ? '0.4' : '1') + ';">';
            h += '<div style="font-weight:600;font-size:11px;">' + loc.name_zh + '</div>';
            h += '<div style="color:var(--color-text-secondary);font-size:9px;">' + durStr + ohStr + '</div>';
            h += '</button>';
          });
          h += '</div></div>';
        });
        h += '</div>';

        // ── Actions ──
        h += '<div style="display:flex;gap:6px;padding:8px 10px;">';
        h += '<button class="btn btn-outline btn-block btn-sm" id="sched-clear">清空当天</button>';
        h += '<button class="btn btn-outline btn-block btn-sm" id="sched-export">导出</button>';
        h += '</div>';

        } // end if planMode === 'manual'

        else {
        // ── Auto Mode: Optimal Route Recommendation (full page) ──
        h += '<div style="margin:8px 10px;padding:12px;background:#fafaf8;border-radius:10px;border:1px solid var(--color-border);">';

        // Time settings
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:8px 10px;background:#fff;border-radius:8px;border:1px solid var(--color-border);">';
        // Days
        h += '<div style="display:flex;align-items:center;gap:4px;">';
        h += '<span style="font-size:10px;color:var(--color-text-secondary);">天数</span>';
        h += '<button class="opt-day-btn" data-adj="-1" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--color-border);background:#fff;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--color-text-secondary);">−</button>';
        h += '<span id="opt-days-val" style="font-weight:700;font-size:14px;min-width:16px;text-align:center;">' + optDays + '</span>';
        h += '<button class="opt-day-btn" data-adj="1" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--color-border);background:#fff;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--color-text-secondary);">+</button>';
        h += '</div>';
        // Divider
        h += '<div style="width:1px;height:24px;background:var(--color-border);"></div>';
        // Time window
        h += '<div style="display:flex;align-items:center;gap:4px;flex:1;">';
        h += '<span style="font-size:10px;color:var(--color-text-secondary);">时段</span>';
        var hourOpts = '';
        for (var hr = 0; hr < 48; hr++) { hourOpts += '<option value="' + hr + '"' + (hr === optDayStart ? ' selected' : '') + '>' + slotsToTime(hr) + '</option>'; }
        h += '<select id="opt-start" style="font-size:11px;border:1px solid var(--color-border);border-radius:4px;padding:3px;background:#fff;">' + hourOpts + '</select>';
        h += '<span style="font-size:10px;color:var(--color-text-secondary);">至</span>';
        var endOpts = '';
        for (var hr = 0; hr < 48; hr++) { endOpts += '<option value="' + hr + '"' + (hr === optDayEnd ? ' selected' : '') + '>' + slotsToTime(hr) + '</option>'; }
        h += '<select id="opt-end" style="font-size:11px;border:1px solid var(--color-border);border-radius:4px;padding:3px;background:#fff;">' + endOpts + '</select>';
        h += '</div>';
        h += '</div>'; // end time settings

        h += '<div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:6px;">选择取景地</div>';
        // Location chips
        h += '<div id="opt-route-chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">';
        planLocs.forEach(function(loc) {
          var sel = optRouteLocs.indexOf(loc.id) >= 0;
          h += '<button class="opt-chip" data-lid="' + loc.id + '" style="padding:4px 10px;border-radius:999px;border:1px solid ' + (sel ? 'var(--color-primary)' : 'var(--color-border)') + ';background:' + (sel ? 'var(--color-primary)' : '#fff') + ';color:' + (sel ? '#fff' : 'var(--color-text)') + ';font-size:11px;font-weight:' + (sel ? '600' : '400') + ';cursor:pointer;">' + loc.name_zh + '</button>';
        });
        h += '</div>';

        // Select all / clear
        h += '<div style="display:flex;gap:8px;margin-bottom:8px;">';
        h += '<button id="opt-sel-all" style="font-size:10px;color:var(--color-primary);border:none;background:none;cursor:pointer;padding:0;">全选</button>';
        h += '<button id="opt-clr-all" style="font-size:10px;color:var(--color-text-secondary);border:none;background:none;cursor:pointer;padding:0;">清空</button>';
        h += '</div>';

        // Engine toggle (4 options)
        function engBtnStyle(eng) {
          var active = optRouteEngine === eng;
          return 'padding:3px 7px;border-radius:999px;border:1px solid ' + (active ? 'var(--color-primary)' : 'var(--color-border)') + ';background:' + (active ? 'var(--color-primary)' : '#fff') + ';color:' + (active ? '#fff' : 'var(--color-text-secondary)') + ';font-size:10px;cursor:pointer;';
        }
        h += '<div style="margin-bottom:10px;">';
        h += '<div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:4px;">计算方式</div>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        h += '<button class="opt-eng-btn" data-eng="amap-best" style="' + engBtnStyle('amap-best') + '">高德最优</button>';
        h += '<button class="opt-eng-btn" data-eng="amap" style="' + engBtnStyle('amap') + '">高德驾车</button>';
        h += '<button class="opt-eng-btn" data-eng="amap-transit" style="' + engBtnStyle('amap-transit') + '">高德公交</button>';
        h += '<button class="opt-eng-btn" data-eng="here-best" style="' + engBtnStyle('here-best') + '">HERE最优</button>';
        h += '<button class="opt-eng-btn" data-eng="here" style="' + engBtnStyle('here') + '">HERE驾车</button>';
        h += '<button class="opt-eng-btn" data-eng="here-transit" style="' + engBtnStyle('here-transit') + '">HERE公交</button>';
        h += '<button class="opt-eng-btn" data-eng="here-walk" style="' + engBtnStyle('here-walk') + '">HERE步行</button>';
        h += '</div>';
        h += '</div>';

        // Generate button
        h += '<button id="opt-generate" style="width:100%;padding:10px;border-radius:8px;border:none;background:var(--color-primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;">生成最优路线</button>';

        // Result area
        h += '<div id="opt-result" style="font-size:11px;color:var(--color-text-secondary);min-height:20px;">';
        if (optRouteResult) {
          h += renderOptResult(optRouteResult);
        }
        h += '</div>';

        h += '</div>'; // end opt-route-section
        } // end else planMode === 'auto'

        container.innerHTML = h;
        bindSchedEvents(day);
      }

      // Render placed blocks that start at a given slot
      // Render ALL blocks for a column (blocks layer, positioned relative to column)
      function renderAllBlocks(day, col) {
        var h = '';
        var colStart = col === 'am' ? 0 : 24;
        var colEnd   = col === 'am' ? 24 : 48;
        day.blocks.forEach(function(block) {
          var blockStart = block.startSlot;
          var blockEnd   = block.startSlot + block.slots;
          if (blockEnd <= colStart || blockStart >= colEnd) return;

          var displayStart = Math.max(blockStart, colStart);
          var displayEnd   = Math.min(blockEnd, colEnd);
          var displaySlots = displayEnd - displayStart;
          if (displaySlots <= 0) return;
          var topOffset    = (displayStart - colStart) * SLOT_H;
          var heightPx     = displaySlots * SLOT_H - 2;
          if (heightPx < 2) heightPx = 2;

          var loc = locById(block.locId);
          if (!loc) return;
          var accent = cityColorMap[loc.city] || '#b91c1c';
          var isCheckin = loc.is_checkin_only;
          if (isCheckin) heightPx = Math.min(heightPx, 14);
          var showLabel = (displayStart === blockStart);
          var blockH     = Math.max(heightPx, 0);

          if (isCheckin) {
            // Check-in block: subtle chip style
            h += '<div class="sched-block" data-lid="' + block.locId + '" style="position:absolute;left:6px;right:6px;top:' + topOffset + 'px;height:' + blockH + 'px;'
              + 'background:#fafafa;'
              + 'border-left:2px solid ' + accent + ';'
              + 'border-radius:0 4px 4px 0;'
              + 'box-shadow:0 1px 2px rgba(0,0,0,0.04);'
              + 'padding:0 6px;z-index:5;pointer-events:auto;'
              + 'display:flex;align-items:center;overflow:hidden;">';
            if (showLabel) {
              h += '<span style="font-size:9px;font-weight:500;color:rgba(0,0,0,0.4);line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + loc.name_zh + '</span>';
              h += '<span class="sched-remove" data-lid="' + block.locId + '" style="flex-shrink:0;margin-left:auto;font-size:12px;color:rgba(0,0,0,0.18);cursor:pointer;padding:0 3px;line-height:1;">×</span>';
            }
            h += '</div>';
          } else {
            // Regular block: premium card style
            h += '<div class="sched-block" data-lid="' + block.locId + '" style="position:absolute;left:6px;right:6px;top:' + topOffset + 'px;height:' + blockH + 'px;'
              + 'background:#fff;'
              + 'border-left:3px solid ' + accent + ';'
              + 'border-radius:0 7px 7px 0;'
              + 'box-shadow:0 1px 4px rgba(0,0,0,0.07),0 0 0 0.5px rgba(0,0,0,0.04);'
              + 'padding:0 8px;font-size:11px;z-index:5;pointer-events:auto;'
              + 'display:flex;align-items:center;overflow:hidden;">';
            if (showLabel) {
              h += '<span style="flex:1;font-weight:590;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1c1917;font-size:10px;min-width:0;">' + loc.name_zh + '</span>';
              h += '<span style="font-size:9px;font-weight:500;color:' + accent + ';margin-left:3px;flex-shrink:0;opacity:0.75;">' + block.slots / 2 + 'h</span>';
              h += '<span class="sched-remove" data-lid="' + block.locId + '" style="flex-shrink:0;margin-left:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;font-size:13px;color:rgba(0,0,0,0.3);cursor:pointer;line-height:1;">×</span>';
            }
            h += '</div>';
          }
        });
        return h;
      }

      // ── Optimal Route helpers ──
      function renderOptResult(result) {
        var rh = '';
        rh += '<div style="margin-top:4px;">';
        rh += '<div style="font-weight:600;font-size:11px;color:#166534;margin-bottom:8px;">共' + result.days.length + '天 · 车程约' + (result.totalMin / 60).toFixed(1) + '小时</div>';

        result.days.forEach(function(d, di) {
          rh += '<div style="background:#f0fdf4;padding:10px;border-radius:10px;margin-bottom:8px;">';
          rh += '<div style="font-weight:700;font-size:12px;color:#166534;margin-bottom:6px;border-bottom:1px solid rgba(22,101,52,0.1);padding-bottom:4px;">' + d.label + '</div>';

          d.blocks.forEach(function(b, bi) {
            var loc = locById(b.locId);
            if (!loc) return;
            var endSlot = b.startSlot + b.slots;
            var durH = (b.slots / 2).toFixed(b.slots % 2 === 0 ? 0 : 1).replace('.0','') + 'h';
            var durMin = (b.slots * 30) < 60 ? (b.slots * 30) + '分钟' : '';

            rh += '<div style="padding:6px 8px;margin-bottom:' + (bi < d.blocks.length - 1 ? '0' : '4px') + ';background:#fff;border-radius:6px;border:1px solid rgba(0,0,0,0.04);">';
            // Time range + name
            rh += '<div style="display:flex;align-items:baseline;gap:6px;">';
            rh += '<span style="font-weight:700;font-size:13px;color:var(--color-primary);white-space:nowrap;">' + slotsToTime(b.startSlot) + '</span>';
            rh += '<span style="font-size:10px;color:var(--color-text-secondary);">–</span>';
            rh += '<span style="font-weight:700;font-size:13px;color:var(--color-primary);white-space:nowrap;">' + slotsToTime(endSlot) + '</span>';
            rh += '</div>';
            rh += '<div style="font-weight:600;font-size:11px;color:#1c1917;margin-top:2px;">' + loc.name_zh + '</div>';
            rh += '<div style="display:flex;gap:8px;margin-top:1px;font-size:10px;color:var(--color-text-secondary);">';
            rh += '<span>游玩' + (b.slots >= 2 ? durH : durMin || durH) + '</span>';
            if (loc.category) rh += '<span>' + (loc.category === 'landmark' ? '景点' : loc.category === 'interior' ? '室内' : loc.category === 'nature' ? '自然' : loc.category === 'street' ? '街区' : '其他') + '</span>';
            rh += '</div>';
            rh += '</div>';

            // Transit to next block (within same day)
            if (bi < d.blocks.length - 1) {
              var nextB = d.blocks[bi + 1];
              var dk = b.locId + '|' + nextB.locId;
              var td = transitDetail[dk];
              var engineLabel = '';
              var travelMin = 0;
              if (td) {
                travelMin = td.minutes;
                if (td.engine === 'amap') engineLabel = '高德驾车';
                else if (td.engine === 'amap-transit') engineLabel = '高德公交';
                else if (td.engine === 'amap-walk') engineLabel = '高德步行';
                else if (td.engine === 'amap-best') engineLabel = '高德最优·' + (td.submode || '驾车');
                else if (td.engine === 'here') engineLabel = 'HERE驾车';
                else if (td.engine === 'here-transit') engineLabel = 'HERE公交';
                else if (td.engine === 'here-walk') engineLabel = 'HERE步行';
                else if (td.engine === 'here-best') engineLabel = 'HERE最优·' + (td.submode || '驾车');
                else if (td.engine === 'here-transit-est') engineLabel = 'HERE公交(估算)';
                else if (td.engine === 'osrm') engineLabel = 'OSRM(后备)';
                else engineLabel = td.engine || '?';
              } else {
                travelMin = (nextB.startSlot - b.startSlot - b.slots) * 30;
                engineLabel = '估算';
              }
              var roundedMin = Math.ceil(travelMin / 30) * 30;
              var gapSlots = nextB.startSlot - (b.startSlot + b.slots);
              var actualMin = gapSlots * 30;
              rh += '<div style="padding:3px 8px;margin-bottom:2px;">';
              rh += '<div style="display:flex;align-items:center;gap:6px;">';
              rh += '<span style="font-size:14px;color:#d97706;">↓</span>';
              rh += '<span style="font-size:10px;font-weight:600;color:#d97706;">' + engineLabel + ' ' + travelMin + '分钟</span>';
              rh += '<span style="font-size:10px;color:var(--color-text-secondary);">→</span>';
              rh += '<span style="font-size:10px;font-weight:600;color:var(--color-text-secondary);">取整' + roundedMin + '分钟</span>';
              if (actualMin !== roundedMin) {
                rh += '<span style="font-size:9px;color:rgba(0,0,0,0.3);">（排程' + actualMin + 'min）</span>';
              }
              rh += '</div>';
              var nextLoc = locById(nextB.locId);
              rh += '<div style="font-size:9px;color:var(--color-text-secondary);margin-top:1px;padding-left:20px;">→ ' + (nextLoc ? nextLoc.name_zh : '') + '</div>';
              rh += '</div>';
            }
          });
          rh += '</div>';
        });
        rh += '<button id="opt-apply" style="margin-top:4px;width:100%;padding:8px;border-radius:8px;border:none;background:var(--color-primary);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">应用全部' + result.days.length + '天至日程</button>';
        rh += '</div>';
        return rh;
      }

      // Step 1: Pure Haversine nearest-neighbor — no API needed
      function computeOptimalRoute(locs) {
        if (locs.length < 2) return null;
        var unvisited = locs.slice();
        var start = unvisited.shift();
        var ordered = [start];
        while (unvisited.length > 0) {
          var current = ordered[ordered.length - 1];
          var bestI = 0, bestDist = Infinity;
          for (var i = 0; i < unvisited.length; i++) {
            var d = GeoUtils.haversineDistance(
              current.coordinates.lat, current.coordinates.lng,
              unvisited[i].coordinates.lat, unvisited[i].coordinates.lng
            );
            if (d < bestDist) { bestDist = d; bestI = i; }
          }
          ordered.push(unvisited.splice(bestI, 1)[0]);
        }
        return { ordered: ordered };
      }

      function packIntoDays(ordered, engine) {
        var isTransit = engine === 'osrm-transit';
        var days = [];
        var dayNum = 1;
        var currentSlot = optDayStart;
        var blocks = [];
        var totalMin = 0;

        for (var i = 0; i < ordered.length; i++) {
          var loc = ordered[i];
          var durSlots = parseDuration(loc.visit_duration || '1h');
          var oh = getOpenHours(loc);
          var transitSlots = 0;
          var startSlot = currentSlot;

          // Calculate transit from previous (if not first on day)
          if (blocks.length > 0) {
            var prevLoc = ordered[i - 1];
            var dk = prevLoc.id + '|' + loc.id;
            if (transitCache[dk]) {
              transitSlots = transitCache[dk];
              if (isTransit && transitDetail[dk] && transitDetail[dk].engine === 'osrm') {
                transitSlots = Math.ceil(Math.round(transitDetail[dk].minutes * TRANSIT_FACTOR) / 30);
              }
            } else {
              var estMin = Math.ceil(GeoUtils.haversineDistance(prevLoc.coordinates.lat, prevLoc.coordinates.lng, loc.coordinates.lat, loc.coordinates.lng) / URBAN_SPEED * 60);
              transitSlots = Math.ceil(estMin / 30);
            }
            totalMin += transitSlots * 30;
            startSlot = currentSlot + transitSlots;
          }

          // Clamp to operating hours
          if (startSlot < oh.open) startSlot = oh.open;

          // Check overflow: user time window + operating hours close
          var dayBound = Math.min(optDayEnd, oh.close === 48 ? optDayEnd : oh.close);
          if (blocks.length > 0 && startSlot + durSlots > dayBound) {
            // Doesn't fit today — start new day
            days.push({ day: dayNum, label: '第' + dayNum + '天', blocks: blocks });
            dayNum++;
            blocks = [];
            currentSlot = optDayStart;
            startSlot = optDayStart;
            transitSlots = 0;
            // Clamp to operating hours on new day
            if (startSlot < oh.open) startSlot = oh.open;
          }

          blocks.push({ locId: loc.id, startSlot: startSlot, slots: durSlots });
          currentSlot = startSlot + durSlots;
        }
        // Save last day
        if (blocks.length > 0) {
          days.push({ day: dayNum, label: '第' + dayNum + '天', blocks: blocks });
        }
        return { ordered: ordered, days: days, totalMin: totalMin, totalDays: days.length };
      }

      function bindSchedEvents(day) {
        // ── Mode toggle (shared between both modes) ──
        container.querySelectorAll('.plan-mode-btn').forEach(function(btn) {
          btn.onclick = function() {
            planMode = btn.dataset.mode;
            selectedLocId = null;
            optRouteResult = null;
            optRouteLocs = [];
            buildHTML();
          };
        });

        if (planMode === 'auto') {
          bindOptRouteEvents(day);
          return;
        }

        // ── Manual mode events below ──
        // Day tab switch
        container.querySelectorAll('.sched-day-tab').forEach(function(tab) {
          tab.onclick = function() {
            currentDayIdx = parseInt(tab.dataset.di);
            selectedLocId = null;
            buildHTML();
          };
        });

        // Delete day
        container.querySelectorAll('.sched-del-day').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var di = parseInt(btn.dataset.di);
            if (schedule.days.length <= 1) return;
            schedule.days.splice(di, 1);
            if (currentDayIdx >= schedule.days.length) currentDayIdx = schedule.days.length - 1;
            Storage.set('schedule', schedule);
            buildHTML();
          };
        });


        // Select location
        container.querySelectorAll('.sched-card').forEach(function(card) {
          card.onclick = function(e) {
            e.stopPropagation();
            selectedLocId = card.dataset.lid;
            buildHTML();
          };
        });

        // Click slot to place
        container.querySelectorAll('.sched-slot').forEach(function(slot) {
          slot.onclick = function() {
            if (!selectedLocId) return;
            var clickedSlot = parseInt(slot.dataset.slot);
            var loc = locById(selectedLocId);
            if (!loc) return;
            var dur = parseDuration(loc.visit_duration);

            // Check operating hours
            var oh = getOpenHours(loc);
            var ohWindow = oh.close - oh.open;
            var isFullDay = dur >= ohWindow * 0.75; // Long visit — treat as full-day
            if (!isFullDay && (clickedSlot < oh.open || clickedSlot + dur > oh.close)) {
              App.showToast(loc.name_zh + ' 营业时间 ' + slotsToTime(oh.open) + '-' + slotsToTime(oh.close) + '，无法放入该时段');
              return;
            }
            // For full-day visits, clamp start to opening time
            var startSlot = isFullDay ? Math.max(clickedSlot, oh.open) : clickedSlot;

            // Check overlap with existing blocks
            var overlap = false;
            day.blocks.forEach(function(b) {
              if (startSlot < b.startSlot + b.slots && startSlot + dur > b.startSlot) overlap = true;
            });
            if (overlap) {
              App.showToast('与已有安排时间重叠');
              return;
            }

            // Check bounds — must stay within 0-48 (24h)
            if (startSlot + dur > 48) {
              App.showToast('超出时间线范围（0:00-24:00），请减少地点或换一天');
              return;
            }
            if (isFullDay && startSlot + dur > 48) {
              startSlot = Math.max(0, 48 - dur);
            }

            day.blocks.push({ locId: selectedLocId, startSlot: startSlot, slots: dur });
            day.blocks.sort(function(a, b) { return a.startSlot - b.startSlot; });
            Storage.set('schedule', schedule);
            selectedLocId = null;
            buildHTML();
          };
        });

        // Remove block — stopPropagation to avoid navigating to map
        container.querySelectorAll('.sched-remove').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            day.blocks = day.blocks.filter(function(b) { return b.locId !== btn.dataset.lid; });
            Storage.set('schedule', schedule);
            buildHTML();
          }, true); // capture phase to beat the block's click handler
        });

        // Block → map (skip if × was clicked)
        container.querySelectorAll('.sched-block').forEach(function(block) {
          block.onclick = function(e) {
            if (e.target.closest('.sched-remove')) return;
            var loc = locById(block.dataset.lid);
            if (loc) navigateToLoc(loc);
          };
        });

        // Clear
        var btnClear = container.querySelector('#sched-clear');
        if (btnClear) {
          btnClear.onclick = function() {
            day.blocks = [];
            Storage.set('schedule', schedule);
            buildHTML();
          };
        }

        // Toggle day tabs via 日程 label
        var toggleDays = container.querySelector('#sched-toggle-days');
        if (toggleDays && schedule.days.length > 1) {
          toggleDays.onclick = function() {
            daysExpanded = !daysExpanded;
            buildHTML();
          };
        }

        // Add day: auto-find smallest missing day number, max 7
        var addBtn = container.querySelector('#sched-add-day');
        if (addBtn) {
          addBtn.onclick = function() {
            if (schedule.days.length >= 7) return;
            var used = {};
            schedule.days.forEach(function(d) { used[d.day] = true; });
            var nextDay = 1;
            while (used[nextDay]) nextDay++;
            schedule.days.push({ day: nextDay, label: '第' + nextDay + '天', blocks: [] });
            schedule.days.sort(function(a, b) { return a.day - b.day; });
            currentDayIdx = schedule.days.findIndex(function(d) { return d.day === nextDay; });
            Storage.set('schedule', schedule);
            buildHTML();
          };
        }

        // Toggle transit API — main button opens query modal for current engine
        var btnTransit = container.querySelector('#sched-toggle-transit');
        if (btnTransit) {
          btnTransit.onclick = function() {
            openTransitModal(useAmap ? 'amap' : 'here');
          };
        }
        // Alt engine button — switches engine, clears cache, reprefetch
        var btnAlt = container.querySelector('#sched-alt-engine');
        if (btnAlt) {
          btnAlt.onclick = function() {
            useAmap = !useAmap;
            transitCache = {};
            transitDetail = {};
            prefetchTransit();
            buildHTML();
          };
        }

        // ── Transit Query Modal (高德 + OSRM) ──
        function openTransitModal(engine) {
          var isAmap = engine === 'amap';
          var overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:300;display:flex;align-items:center;justify-content:center;';
          overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };

          var box = document.createElement('div');
          box.style.cssText = 'background:#fff;border-radius:14px;padding:20px;width:calc(100% - 40px);max-width:400px;max-height:80vh;overflow-y:auto;';

          var locOpts = '';
          planLocs.forEach(function(l) {
            locOpts += '<option value="' + l.id + '">' + l.name_zh + ' (' + l.city + ')</option>';
          });

          var modeHTML = '';
          if (isAmap) {
            modeHTML = ''
              + '<div style="font-size:12px;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;">出行方式</div>'
              + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;">'
              + '<button class="modal-mode" data-mode="driving"   style="padding:10px;border-radius:8px;border:1px solid var(--color-border);background:#fff;font-size:13px;cursor:pointer;">🚗 驾车</button>'
              + '<button class="modal-mode" data-mode="transit"   style="padding:10px;border-radius:8px;border:1px solid var(--color-border);background:#fff;font-size:13px;cursor:pointer;">🚌 公交</button>'
              + '<button class="modal-mode" data-mode="walking"   style="padding:10px;border-radius:8px;border:1px solid var(--color-border);background:#fff;font-size:13px;cursor:pointer;">🚶 步行</button>'
              + '<button class="modal-mode" data-mode="bicycling" style="padding:10px;border-radius:8px;border:1px solid var(--color-border);background:#fff;font-size:13px;cursor:pointer;">🚲 骑行</button>'
              + '</div>';
          } else {
            modeHTML = ''
              + '<div style="display:flex;gap:6px;margin-bottom:6px;">'
              + '<button id="modal-here-query" style="flex:1;padding:12px;border-radius:8px;border:none;background:var(--color-primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">HERE驾车</button>'
              + '<button id="modal-here-transit" style="flex:1;padding:12px;border-radius:8px;border:1px solid var(--color-primary);background:#fff;color:var(--color-primary);font-size:13px;font-weight:600;cursor:pointer;">HERE公交</button>'
              + '</div>'
              + '<div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:12px;">HERE Maps 全球路线（驾车/公交/步行），高德覆盖中国</div>';
          }

          box.innerHTML = ''
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
            + '<span style="font-weight:700;font-size:16px;">' + (isAmap ? '高德路线规划' : 'HERE 路线查询') + '</span>'
            + '<button id="modal-close" style="border:none;background:none;font-size:20px;cursor:pointer;color:var(--color-text-secondary);padding:4px;">×</button>'
            + '</div>'
            + '<div style="margin-bottom:10px;"><label style="font-size:12px;color:var(--color-text-secondary);">出发地</label>'
            + '<select id="modal-from" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--color-border);margin-top:4px;font-size:13px;">' + locOpts + '</select></div>'
            + '<div style="margin-bottom:14px;"><label style="font-size:12px;color:var(--color-text-secondary);">目的地</label>'
            + '<select id="modal-to" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--color-border);margin-top:4px;font-size:13px;">' + locOpts + '</select></div>'
            + modeHTML
            + '<div id="modal-result" style="font-size:12px;color:var(--color-text-secondary);min-height:20px;"></div>';

          overlay.appendChild(box);
          document.body.appendChild(overlay);

          function closeModal() { document.body.removeChild(overlay); }
          document.getElementById('modal-close').onclick = closeModal;

          // 高德: bind mode buttons
          if (isAmap) {
            box.querySelectorAll('.modal-mode').forEach(function(btn) {
              btn.onclick = function() {
                var fromId = document.getElementById('modal-from').value;
                var toId = document.getElementById('modal-to').value;
                var mode = btn.dataset.mode;
                if (fromId === toId) {
                  document.getElementById('modal-result').innerHTML = '<span style="color:#e63946;">请选择不同的出发地和目的地</span>';
                  return;
                }
                document.getElementById('modal-result').innerHTML = '查询中...';
                fetchAmapMode(fromId, toId, mode);
              };
            });
          } else {
            // HERE: driving query button
            var hereBtn = document.getElementById('modal-here-query');
            if (hereBtn) {
              hereBtn.onclick = function() {
                var fromId = document.getElementById('modal-from').value;
                var toId = document.getElementById('modal-to').value;
                if (fromId === toId) { sameLocErr(); return; }
                document.getElementById('modal-result').innerHTML = '查询HERE驾车...';
                fetchHEREMode(fromId, toId, 'driving');
              };
            }
            // HERE: transit query button
            var hereTransitBtn = document.getElementById('modal-here-transit');
            if (hereTransitBtn) {
              hereTransitBtn.onclick = function() {
                var fromId = document.getElementById('modal-from').value;
                var toId = document.getElementById('modal-to').value;
                if (fromId === toId) { sameLocErr(); return; }
                document.getElementById('modal-result').innerHTML = '查询HERE公交...';
                fetchHEREMode(fromId, toId, 'transit');
              };
            }
          }
          function sameLocErr() {
            document.getElementById('modal-result').innerHTML = '<span style="color:#e63946;">请选择不同的出发地和目的地</span>';
          }

          function fetchAmapMode(fromId, toId, mode) {
            var fromLoc = locById(fromId), toLoc = locById(toId);
            if (!fromLoc || !toLoc) return;
            var from = GeoUtils.toGcj02(fromLoc.coordinates.lat, fromLoc.coordinates.lng);
            var to = GeoUtils.toGcj02(toLoc.coordinates.lat, toLoc.coordinates.lng);
            var origin = from.lng + ',' + from.lat;
            var dest   = to.lng + ',' + to.lat;
            // 高德 transit uses /v3/direction/transit/integrated
            var amapMode = mode === 'transit' ? 'transit/integrated' : mode;
            var url = 'https://restapi.amap.com/v3/direction/' + amapMode + '?origin=' + origin + '&destination=' + dest + '&key=' + AMAP_KEY;
            if (mode === 'transit') url += '&city=北京'; // fallback city
            fetch(url).then(function(r) { return r.json(); }).then(function(data) {
              var resultEl = document.getElementById('modal-result');
              var ok = data && data.status === '1';
              var p = null;
              if (ok && data.route && data.route.paths && data.route.paths[0]) {
                p = data.route.paths[0]; // driving/walking/bicycling
              } else if (ok && data.route && data.route.transits && data.route.transits[0]) {
                p = data.route.transits[0]; // transit
              }
              if (p) {
                var dist = parseInt(p.distance) / 1000;
                var dur  = Math.round(parseInt(p.duration) / 60);
                var modeNames = {driving:'驾车', transit:'公交+步行', walking:'步行', bicycling:'骑行'};
                // Update cache — ceil to nearest 30min for timeline spacing
                var cacheKey = fromId + '|' + toId;
                var ceilSlots = Math.ceil(dur / 30);
                transitCache[cacheKey] = ceilSlots;
                transitDetail[cacheKey] = { minutes: dur, engine: 'amap' };
                resultEl.innerHTML = '<div style="background:#f0fdf4;padding:10px;border-radius:8px;">'
                  + '<span style="font-weight:700;color:#166534;">高德' + modeNames[mode] + '</span> '
                  + '<span>' + dist.toFixed(1) + 'km · ' + dur + '分钟</span>'
                  + '<div style="margin-top:4px;display:flex;align-items:center;gap:4px;font-size:11px;color:var(--color-primary);">'
                  + fromLoc.name_zh + ' <span style="font-size:9px;">→' + dur + 'min→</span> ' + toLoc.name_zh
                  + '</div>'
                  + '<div style="font-size:10px;color:var(--color-text-secondary);margin-top:2px;">已更新至日程（时间线间隔' + (ceilSlots*30) + '分钟）</div></div>';
              } else {
                resultEl.innerHTML = '<span style="color:#e63946;">未找到路线（' + (data ? data.info || '未知错误' : '') + '）</span>';
              }
            }).catch(function() {
              document.getElementById('modal-result').innerHTML = '<span style="color:#e63946;">网络错误，请重试</span>';
            });
          }

          function fetchHEREMode(fromId, toId, mode) {
            var isTransit = mode === 'transit';
            var fromLoc = locById(fromId), toLoc = locById(toId);
            if (!fromLoc || !toLoc) return;
            var cacheKey = fromId + '|' + toId;
            if (isTransit) {
              fetchHERETransit(fromLoc, toLoc, cacheKey, function() {
                var det = transitDetail[cacheKey];
                if (det && det.minutes) {
                  var ceilSlots = Math.ceil(det.minutes / 30);
                  transitCache[cacheKey] = ceilSlots;
                  var resultEl = document.getElementById('modal-result');
                  resultEl.innerHTML = '<div style="background:#fdf2f8;padding:10px;border-radius:8px;">'
                    + '<span style="font-weight:700;color:#9b2c5e;">HERE 公交</span> '
                    + '<span>' + det.minutes + '分钟</span>'
                    + '<div style="margin-top:4px;">' + fromLoc.name_zh + ' → ' + toLoc.name_zh + '</div>'
                    + '<div style="font-size:10px;color:var(--color-text-secondary);margin-top:2px;">已更新至日程（时间线间隔' + (ceilSlots*30) + '分钟）</div></div>';
                } else {
                  document.getElementById('modal-result').innerHTML = '<span style="color:#e63946;">HERE 公交查询失败</span>';
                }
              });
            } else {
              fetchHERE(fromLoc, toLoc, cacheKey, function() {
                var det = transitDetail[cacheKey];
                if (det && det.minutes) {
                  var ceilSlots = Math.ceil(det.minutes / 30);
                  transitCache[cacheKey] = ceilSlots;
                  var resultEl = document.getElementById('modal-result');
                  resultEl.innerHTML = '<div style="background:#f0fdf4;padding:10px;border-radius:8px;">'
                    + '<span style="font-weight:700;color:#166534;">HERE 驾车</span> '
                    + '<span>' + det.minutes + '分钟</span>'
                    + '<div style="margin-top:4px;">' + fromLoc.name_zh + ' → ' + toLoc.name_zh + '</div>'
                    + '<div style="font-size:10px;color:var(--color-text-secondary);margin-top:2px;">已更新至日程（时间线间隔' + (ceilSlots*30) + '分钟）</div></div>';
                } else {
                  document.getElementById('modal-result').innerHTML = '<span style="color:#e63946;">HERE 驾车查询失败</span>';
                }
              });
            }
            return; // Async — don't fall through
          }

          function applyTransit(cacheKey, driveMin, fromLoc, toLoc) {
            var transitMin = Math.round(driveMin * TRANSIT_FACTOR);
            var ceilSlots = Math.ceil(transitMin / 30);
            transitCache[cacheKey] = ceilSlots;
            transitDetail[cacheKey] = { minutes: transitMin, engine: 'here-transit-est' };
            var resultEl = document.getElementById('modal-result');
            resultEl.innerHTML = '<div style="background:#fdf2f8;padding:10px;border-radius:8px;">'
              + '<span style="font-weight:700;color:#9b2c5e;">HERE 公交(估算)</span> '
              + '<span>' + transitMin + '分钟</span>'
              + '<div style="margin-top:4px;display:flex;align-items:center;gap:4px;font-size:11px;color:var(--color-primary);">'
              + fromLoc.name_zh + ' <span style="font-size:9px;">→' + transitMin + 'min→</span> ' + toLoc.name_zh
              + '</div>'
              + '<div style="font-size:10px;color:var(--color-text-secondary);margin-top:2px;">已更新至日程（间隔' + (ceilSlots*30) + '分钟）</div>'
              + '<div style="font-size:10px;color:#d97706;margin-top:2px;">由驾车' + driveMin + '分钟×' + TRANSIT_FACTOR + '换算（含步行到站+候车+换乘）</div></div>';
          }
        }

        // Export
        var btnExport = container.querySelector('#sched-export');
        if (btnExport) {
          btnExport.onclick = function() {
            var text = '';
            schedule.days.forEach(function(d) {
              text += d.label + '\n';
              d.blocks.forEach(function(b) {
                var loc = locById(b.locId);
                text += '  ' + slotsToTime(b.startSlot) + ' ' + (loc ? loc.name_zh : '?') + ' (' + (b.slots/2).toFixed(1).replace('.0','') + 'h)\n';
              });
              text += '\n';
            });
            if (navigator.clipboard) {
              navigator.clipboard.writeText(text).then(function() { App.showToast('日程已复制'); });
            }
          };
        }

        // ── Optimal Route Events ──
        bindOptRouteEvents(day);
      }

      function bindOptRouteEvents(day) {
        // Day +/- buttons
        container.querySelectorAll('.opt-day-btn').forEach(function(btn) {
          btn.onclick = function() {
            var adj = parseInt(btn.dataset.adj);
            optDays = Math.max(1, Math.min(7, optDays + adj));
            buildHTML();
          };
        });
        // Start/end time selects
        var startSel = container.querySelector('#opt-start');
        var endSel = container.querySelector('#opt-end');
        if (startSel) startSel.onchange = function() {
          optDayStart = parseInt(startSel.value);
          if (optDayStart >= optDayEnd) { optDayEnd = Math.min(48, optDayStart + 2); }
          buildHTML();
        };
        if (endSel) endSel.onchange = function() {
          optDayEnd = parseInt(endSel.value);
          if (optDayEnd <= optDayStart) { optDayStart = Math.max(0, optDayEnd - 2); }
          buildHTML();
        };

        // Chip toggle
        container.querySelectorAll('.opt-chip').forEach(function(chip) {
          chip.onclick = function() {
            var lid = chip.dataset.lid;
            var idx = optRouteLocs.indexOf(lid);
            if (idx >= 0) optRouteLocs.splice(idx, 1);
            else optRouteLocs.push(lid);
            optRouteResult = null;
            buildHTML();
          };
        });

        // Select all
        var selAll = container.querySelector('#opt-sel-all');
        if (selAll) selAll.onclick = function() {
          optRouteLocs = planLocs.map(function(l) { return l.id; });
          optRouteResult = null;
          buildHTML();
        };

        // Clear all
        var clrAll = container.querySelector('#opt-clr-all');
        if (clrAll) clrAll.onclick = function() {
          optRouteLocs = [];
          optRouteResult = null;
          buildHTML();
        };

        // Engine toggle
        container.querySelectorAll('.opt-eng-btn').forEach(function(btn) {
          btn.onclick = function() {
            optRouteEngine = btn.dataset.eng;
            optRouteResult = null;
            buildHTML();
          };
        });

        // Generate optimal route
        var genBtn = container.querySelector('#opt-generate');
        if (genBtn) {
          genBtn.onclick = function() {
            if (optRouteLocs.length < 2) {
              App.showToast('请至少选择2个取景地');
              return;
            }
            var locs = optRouteLocs.map(function(id) { return locById(id); }).filter(Boolean);
            if (locs.length < 2) return;

            // Step 1: Haversine nearest-neighbor sort (no API needed)
            var result = computeOptimalRoute(locs);
            if (!result) return;
            var ordered = result.ordered;

            // Step 2: Build consecutive segments from the ordered route (N-1 pairs only)
            var segments = [];
            for (var i = 0; i < ordered.length - 1; i++) {
              segments.push([ordered[i], ordered[i + 1]]);
            }

            // Clear caches for these segment keys, set correct engine
            var savedAmap = useAmap;
            var savedTransitMode = amapTransitMode;
            var isBest = optRouteEngine === 'amap-best';
            var isHereBest = optRouteEngine === 'here-best';
            var isHereTransit = optRouteEngine === 'here-transit';
            var isHereWalk = optRouteEngine === 'here-walk';
            var isHere = optRouteEngine === 'here' || isHereBest || isHereTransit || isHereWalk;
            useAmap = (optRouteEngine === 'amap' || optRouteEngine === 'amap-transit' || isBest);
            amapTransitMode = (optRouteEngine === 'amap-transit');
            segments.forEach(function(p) {
              var k = p[0].id + '|' + p[1].id;
              delete transitCache[k];
              delete transitDetail[k];
            });

            // Step 3: Fetch transit for each segment with selected engine
            var total = segments.length;
            var completed = 0;
            var genBtnEl = container.querySelector('#opt-generate');
            if (genBtnEl) { genBtnEl.disabled = true; genBtnEl.textContent = '查询中 0/' + total + '...'; }
            var engineLabel = optRouteEngine === 'amap-best' ? '高德最优' : optRouteEngine === 'amap' ? '高德驾车' : optRouteEngine === 'amap-transit' ? '高德公交' : optRouteEngine === 'here-best' ? 'HERE最优' : optRouteEngine === 'here' ? 'HERE驾车' : optRouteEngine === 'here-transit' ? 'HERE公交' : optRouteEngine === 'here-walk' ? 'HERE步行' : 'HERE驾车';
            App.showToast('Step1 最近邻排序完成 → Step2 ' + engineLabel + '查询' + total + '段交通...');

            // Batch dispatch: 2 per 400ms (gentle on API rate limits)
            var batchIdx = 0;
            function nextBatch() {
              var batch = segments.slice(batchIdx, batchIdx + 2);
              if (batch.length === 0) return;
              batchIdx += 2;
              batch.forEach(function(pair) {
                var fetchFn;
                if (isBest) {
                  var ck = pair[0].id + '|' + pair[1].id;
                  fetchFn = function(cb) { fetchAmapBest(pair[0], pair[1], ck, cb); };
                } else if (isHereBest) {
                  var hk = pair[0].id + '|' + pair[1].id;
                  fetchFn = function(cb) { fetchHEREBest(pair[0], pair[1], hk, cb); };
                } else if (isHereTransit) {
                  var htk = pair[0].id + '|' + pair[1].id;
                  fetchFn = function(cb) { fetchHERETransit(pair[0], pair[1], htk, cb); };
                } else if (isHereWalk) {
                  var hwk = pair[0].id + '|' + pair[1].id;
                  fetchFn = function(cb) { fetchHEREWalk(pair[0], pair[1], hwk, cb); };
                } else if (isHere) {
                  var hdk = pair[0].id + '|' + pair[1].id;
                  fetchFn = function(cb) { fetchHERE(pair[0], pair[1], hdk, cb); };
                } else {
                  fetchFn = function(cb) { fetchTransit(pair[0], pair[1], cb); };
                }
                fetchFn(function() {
                  completed++;
                  if (genBtnEl) { genBtnEl.textContent = '查询中 ' + completed + '/' + total + '...'; }
                  if (completed >= total) {
                    useAmap = savedAmap;
                    amapTransitMode = savedTransitMode;
                    var ok = 0;
                    segments.forEach(function(p) {
                      if (transitDetail[p[0].id + '|' + p[1].id]) ok++;
                    });
                    App.showToast(engineLabel + ': ' + ok + '/' + total + ' 段查询成功');
                    optRouteResult = packIntoDays(ordered, optRouteEngine);
                    buildHTML();
                  }
                });
              });
              setTimeout(nextBatch, 400);
            }
            nextBatch();
          };
        }

        // Apply all days to schedule
        var applyBtn = container.querySelector('#opt-apply');
        if (applyBtn) {
          applyBtn.onclick = function() {
            if (!optRouteResult || !optRouteResult.days) return;
            schedule.days = optRouteResult.days;
            currentDayIdx = 0;
            Storage.set('schedule', schedule);
            optRouteResult = null;
            optRouteLocs = [];
            buildHTML();
            App.showToast('已应用' + schedule.days.length + '天路线至日程');
          };
        }
      }

      buildHTML();
      prefetchTransit(); // pre-load all OSRM distances in background
    }

    function savePlanOrder(orderedLocs) {
      var ids = orderedLocs.map(function(l) { return l.id; });
      Storage.set('plan_order', ids);
    }

    function renderStory() {
      log('renderStory');
      var container = document.getElementById('view-story-content');
      if (!container) return;

      var byChapter = {};
      var order = (ipMeta && ipMeta.chapters) || [];
      locations.forEach(function(loc) {
        var ch = loc.chapter || '其他';
        if (!byChapter[ch]) byChapter[ch] = [];
        byChapter[ch].push(loc);
      });

      var keys = Object.keys(byChapter).sort(function(a, b) { return order.indexOf(a) - order.indexOf(b); });

      if (keys.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding-top:64px;">暂无剧情数据</div>';
        return;
      }

      var h = '<div style="padding:16px 16px 80px;">';
      keys.forEach(function(ch) {
        h += '<div class="card" style="margin-bottom:12px;">';
        h += '<div style="color:var(--color-primary);font-weight:700;font-size:14px;">' + ch + '</div><div style="margin-top:6px;">';
        byChapter[ch].forEach(function(loc) {
          h += '<div class="loc-link" data-lid="' + loc.id + '" style="cursor:pointer;padding:6px 0;font-size:14px;border-bottom:1px solid var(--color-border);">' + Icons.iconLabel('pin', loc.name_zh, 14) + ' <span style="color:#999;font-size:11px;">' + loc.city + '</span></div>';
        });
        h += '</div></div>';
      });
      h += '</div>';
      container.innerHTML = h;

      container.querySelectorAll('.loc-link').forEach(function(link) {
        link.addEventListener('click', function(e) {
          e.stopPropagation();
          var lid = link.dataset.lid;
          var loc = locations.find(function(l) { return l.id === lid; });
          if (loc) navigateToLoc(loc);
        });
      });
    }

    function renderMyPage() {
      log('renderMyPage');
      var container = document.getElementById('view-bookmarks-content');
      if (!container) return;

      var bookmarks = Storage.getBookmarks();
      var checkins = Storage.getCheckins();
      var profile = Storage.get('profile') || { nickname: '用户昵称', avatar: '' };
      var locs = locations.filter(function(l) { return bookmarks.indexOf(l.id) >= 0; });
      var checkedLocs = locs.filter(function(l) { return checkins[l.id]; });
      // Path map needs ALL check-ins, not just bookmarked ones
      var allCheckedLocs = locations.filter(function(l) { return checkins[l.id]; });
      var checked = allCheckedLocs.length;
      var totalLocs = locations.length;
      var hasSchedule = !!Storage.get('schedule');

      // Stats
      var cities = {};
      allCheckedLocs.forEach(function(l) { cities[l.city] = true; });
      var cityCount = Object.keys(cities).length;

      // Build check-in timeline (reverse chronological)
      var timeline = [];
      Object.keys(checkins).forEach(function(lid) {
        var loc = locations.find(function(l) { return l.id === lid; });
        if (loc) timeline.push({ loc: loc, ts: checkins[lid].timestamp });
      });
      timeline.sort(function(a, b) { return b.ts - a.ts; });

      var h = '<div style="padding:16px 12px 100px;">';

      // ── Profile header (centered) ──
      h += '<div style="text-align:center;padding:8px 0 16px;">';
      h += '<div id="profile-avatar" style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#b91c1c,#991b1b);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;box-shadow:0 4px 16px rgba(185,28,28,0.2);border:3px solid #fff;">';
      if (profile.avatar) {
        h += '<img src="' + profile.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
      } else {
        h += '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      }
      h += '</div>';
      h += '<div id="profile-nickname" style="font-weight:700;font-size:17px;color:#1c1917;cursor:pointer;margin-top:8px;">' + profile.nickname + '</div>';
      h += '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">巡礼' + checked + '次 · ' + cityCount + '座城市 · ' + bookmarks.length + '个收藏</div>';
      h += '</div>';

      // ── Stats cards ──
      h += '<div style="display:flex;gap:10px;padding:0 0 16px;">';
      h += '<div style="flex:1;padding:14px 12px;border-radius:14px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #bae6fd;text-align:center;">';
      h += '<div style="font-size:22px;margin-bottom:2px;">☆</div>';
      h += '<div style="font-size:10px;color:#0c4a6e;font-weight:500;">想去的地点</div>';
      h += '<div style="font-size:22px;font-weight:800;color:#0c4a6e;margin-top:2px;">' + bookmarks.length + '</div>';
      h += '</div>';
      h += '<div style="flex:1;padding:14px 12px;border-radius:14px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0;text-align:center;">';
      h += '<div style="font-size:22px;margin-bottom:2px;">✓</div>';
      h += '<div style="font-size:10px;color:#166534;font-weight:500;">已打卡</div>';
      h += '<div style="font-size:22px;font-weight:800;color:#166534;margin-top:2px;">' + checked + '<span style="font-size:14px;font-weight:500;">/' + totalLocs + '</span></div>';
      h += '</div>';
      if (hasSchedule) {
        var sched = Storage.get('schedule');
        var totalBlocks = 0;
        (sched.days || []).forEach(function(d) { totalBlocks += d.blocks.length; });
        h += '<div style="flex:1;padding:14px 12px;border-radius:14px;background:linear-gradient(135deg,#fff7ed,#fed7aa);border:1px solid #fdba74;text-align:center;">';
        h += '<div style="font-size:22px;margin-bottom:2px;">⏱</div>';
        h += '<div style="font-size:10px;color:#9a3412;font-weight:500;">我的行程</div>';
        h += '<div style="font-size:22px;font-weight:800;color:#9a3412;margin-top:2px;">' + (sched.days || []).length + '<span style="font-size:14px;font-weight:500;">天</span></div>';
        h += '</div>';
      }
      h += '</div>';

      // ── Check-in Timeline ──
      h += '<div style="margin-bottom:16px;">';
      h += '<div style="font-weight:700;font-size:15px;color:#1c1917;margin-bottom:12px;">📅 时间轴</div>';
      if (timeline.length === 0) {
        h += '<div style="text-align:center;padding:24px 16px;background:#fafaf8;border-radius:12px;border:1px dashed #e0dcd5;">';
        h += '<div style="font-size:32px;margin-bottom:8px;">🗺️</div>';
        h += '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.6;">还没有打卡记录</div>';
        h += '<div style="font-size:11px;color:var(--color-faint);">在地图上点击取景地，添加你的巡礼打卡</div>';
        h += '</div>';
      } else {
        var lastDate = '';
        timeline.forEach(function(entry, i) {
          var d = new Date(entry.ts);
          var dateStr = d.toISOString().slice(0, 10);
          var today = new Date().toISOString().slice(0, 10);
          var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          var label;
          if (dateStr === today) label = '今天';
          else if (dateStr === yesterday) label = '昨天';
          else label = (d.getMonth()+1) + '月' + d.getDate() + '日';

          if (dateStr !== lastDate) {
            if (lastDate !== '') h += '</div>';
            h += '<div style="margin-bottom:6px;">';
            h += '<div style="font-size:12px;font-weight:700;color:#1c1917;padding:8px 4px 4px;display:flex;align-items:center;gap:6px;">';
            h += '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--color-primary);"></span>' + label;
            h += '</div>';
            lastDate = dateStr;
          }

          var loc = entry.loc;
          var timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
          var thumbUrl = loc.real_photo || '';
          h += '<div class="card card-clickable" data-lid="' + loc.id + '" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:4px;border-radius:10px;">';
          if (thumbUrl) {
            h += '<div style="width:44px;height:44px;border-radius:8px;overflow:hidden;flex-shrink:0;background:#f0ede6;">';
            h += '<img src="' + thumbUrl + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">';
            h += '</div>';
          } else {
            h += '<div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
            h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
            h += '</div>';
          }
          h += '<div style="flex:1;min-width:0;">';
          h += '<div style="font-weight:600;font-size:13px;color:#1c1917;">' + loc.name_zh + '</div>';
          h += '<div style="font-size:10px;color:var(--color-text-secondary);">' + loc.city + ' · ' + timeStr + '</div>';
          h += '</div>';
          h += '<div style="font-size:18px;color:var(--color-primary);">✓</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      h += '</div>';

      if (locs.length >= 2) {
        h += '<button class="btn btn-outline btn-block btn-sm" id="btn-go-plan" style="width:100%;margin-bottom:24px;">' + Icons.iconLabel('map', '我的行程') + '</button>';
      }
      // ── Footer ──
      h += '<div style="text-align:center;padding:16px 0 20px;border-top:1px solid var(--color-border);margin-top:16px;">';
      h += '<div style="font-size:11px;color:var(--color-text-secondary);line-height:1.8;">';
      h += '<p style="margin:0 0 8px;">📧 联系邮箱：2062527951@qq.com</p>';
      h += '<div style="background:#fafaf8;border-radius:8px;padding:10px;margin:8px 0;text-align:center;font-size:10px;line-height:1.6;">';
      h += '<p style="font-weight:700;margin:0 0 4px;color:#1c1917;">📢 公告</p>';
      h += '<p style="margin:0;color:var(--color-text-secondary);">欢迎使用圣地巡礼！在地图上探索取景地，收藏感兴趣的景点，使用计划功能规划你的巡礼路线。';
      h += '点击取景地可查看详情、实景照片和原著原文摘录，打卡记录会在个人页形成时间轴。';
      h += '建议优先使用HERE引擎查询海外路线，高德引擎仅限中国大陆。如有问题或建议，欢迎邮件反馈。</p>';
      h += '</div>';
      h += '<p style="margin:0;font-size:10px;color:var(--color-faint);">更新日期：2026-05-13</p>';
      h += '</div>';
      h += '<div style="text-align:center;padding:4px 0 20px;">';
      h += '<span style="font-size:10px;color:var(--color-text-secondary);">数据</span>';
      h += '<span id="btn-export" style="font-size:10px;color:var(--color-primary);cursor:pointer;margin:0 10px;">导出备份</span>';
      h += '<span style="font-size:10px;color:var(--color-border);">|</span>';
      h += '<span id="btn-import" style="font-size:10px;color:var(--color-primary);cursor:pointer;margin:0 10px;">恢复备份</span>';
      h += '</div>';

      h += '</div>';
      container.innerHTML = h;

      // ── Events ──
      var avatarEl = container.querySelector('#profile-avatar');
      if (avatarEl) avatarEl.onclick = function() {
        var input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = function() {
          var file = input.files[0]; if (!file) return;
          var reader = new FileReader();
          reader.onload = function() { profile.avatar = reader.result; Storage.set('profile', profile); renderMyPage(); };
          reader.readAsDataURL(file);
        };
        input.click();
      };
      var nickEl = container.querySelector('#profile-nickname');
      if (nickEl) nickEl.onclick = function() {
        var name = prompt('修改昵称', profile.nickname);
        if (name && name.trim()) { profile.nickname = name.trim(); Storage.set('profile', profile); renderMyPage(); }
      };
      container.querySelectorAll('[data-lid]').forEach(function(item) {
        item.onclick = function() {
          var loc = locations.find(function(l) { return l.id === item.dataset.lid; });
          if (loc) navigateToLoc(loc);
        };
      });
      var btnGoPlan = container.querySelector('#btn-go-plan');
      if (btnGoPlan) btnGoPlan.onclick = function() { switchTab('plan'); };
      var btnExport = container.querySelector('#btn-export');
      if (btnExport) btnExport.onclick = function() {
        var data = {};
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key.indexOf('sj_') === 0) data[key] = localStorage.getItem(key);
        }
        var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url;
        a.download = 'scene-journey-backup-' + new Date().toISOString().slice(0,10) + '.json';
        a.click(); URL.revokeObjectURL(url);
        App.showToast('数据已导出');
      };
      var btnImport = container.querySelector('#btn-import');
      if (btnImport) btnImport.onclick = function() {
        var input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
        input.onchange = function() {
          var file = input.files[0]; if (!file) return;
          var reader = new FileReader();
          reader.onload = function() {
            try {
              var data = JSON.parse(reader.result);
              var count = 0;
              Object.keys(data).forEach(function(key) {
                if (key.indexOf('sj_') === 0) { localStorage.setItem(key, data[key]); count++; }
              });
              App.showToast('已恢复' + count + '条数据，即将刷新');
              setTimeout(function() { location.reload(); }, 1200);
            } catch(e) { App.showToast('文件格式错误'); }
          };
          reader.readAsText(file);
        };
        input.click();
      };
      updateBadges();
    }

    function showToast(msg) {
      var toast = document.getElementById('app-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.setAttribute('role', 'status');
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;z-index:9999;transition:opacity 0.3s;pointer-events:none;';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      clearTimeout(toast._timeout);
      toast._timeout = setTimeout(function() { toast.style.opacity = '0'; }, 2000);

      // Announce to screen reader
      var announcer = document.getElementById('sr-announcer');
      if (announcer) { announcer.textContent = ''; setTimeout(function() { announcer.textContent = msg; }, 50); }
    }

    function updateBadges() {
      var count = Storage.getBookmarks().length;
      var badge = document.querySelector('.bottom-bar [data-tab="bookmarks"] .badge');
      if (badge) { badge.textContent = count; badge.classList.toggle('hidden', count === 0); }
      var fab = document.getElementById('fab-plan-route');
      if (fab) fab.classList.toggle('hidden', count < 2);
    }

    window.App.showToast = showToast;

    function showGuide(title, text) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:14px;padding:24px 20px 20px;width:100%;max-width:360px;max-height:70vh;overflow-y:auto;';
      var lines = text.split('\n').filter(Boolean);
      var items = '';
      lines.forEach(function(line) {
        items += '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;font-size:13px;color:#1c1917;line-height:1.5;">';
        items += '<span style="width:18px;height:18px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px;">' + (lines.indexOf(line)+1) + '</span>';
        items += '<span>' + line + '</span>';
        items += '</div>';
      });
      box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
        + '<span style="font-weight:700;font-size:17px;">' + title + '</span>'
        + '<button style="border:none;background:none;font-size:22px;cursor:pointer;color:var(--color-text-secondary);padding:0 4px;line-height:1;" id="guide-close">×</button>'
        + '</div>' + items;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      document.getElementById('guide-close').onclick = function() { document.body.removeChild(overlay); };
    }
    window.App.showGuide = showGuide;
    window.App.switchTab = switchTab;

    // Boot
    log('Boot: readyState=' + document.readyState);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  } catch(e) {
    log('FATAL ERROR: ' + e.message + ' at line ' + e.lineNumber);
  }
})();
