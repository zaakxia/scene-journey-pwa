// localStorage wrapper — scoped by IP/book ID
const Storage = (() => {
  const PREFIX = 'sj_';
  var _scope = '';

  function init(ipId) {
    _scope = ipId || '';
    if (_scope === 'dragon-raja') _migrate();
  }

  function _scopedKey(name) {
    return _scope ? PREFIX + _scope + '_' + name : PREFIX + name;
  }

  function _migrate() {
    // Non-destructive: copy old unscoped data into scoped dragon-raja keys once
    var oldKeys = ['bookmarks', 'routes', 'checkins'];
    for (var i = 0; i < oldKeys.length; i++) {
      var k = oldKeys[i];
      var oldKey = PREFIX + k;
      var newKey = _scopedKey(k);
      try {
        var oldVal = localStorage.getItem(oldKey);
        if (oldVal && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, oldVal);
        }
      } catch (e) { /* quota exceeded or private browsing, skip */ }
    }
  }

  function get(key, fallback) {
    try {
      var raw = localStorage.getItem(_scopedKey(key));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(_scopedKey(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    localStorage.removeItem(_scopedKey(key));
  }

  function getBookmarks() {
    return get('bookmarks', []);
  }

  function addBookmark(locationId) {
    var bookmarks = getBookmarks();
    if (bookmarks.indexOf(locationId) === -1) {
      bookmarks.push(locationId);
      set('bookmarks', bookmarks);
    }
    return bookmarks;
  }

  function removeBookmark(locationId) {
    var bookmarks = getBookmarks().filter(function(id) { return id !== locationId; });
    set('bookmarks', bookmarks);
    return bookmarks;
  }

  function isBookmarked(locationId) {
    return getBookmarks().indexOf(locationId) !== -1;
  }

  function getRoutes() {
    return get('routes', []);
  }

  function saveRoute(route) {
    var routes = getRoutes();
    var idx = -1;
    for (var i = 0; i < routes.length; i++) {
      if (routes[i].id === route.id) { idx = i; break; }
    }
    if (idx >= 0) routes[idx] = route;
    else routes.push(route);
    set('routes', routes);
    return routes;
  }

  function deleteRoute(routeId) {
    var routes = getRoutes().filter(function(r) { return r.id !== routeId; });
    set('routes', routes);
    return routes;
  }

  function getCheckins() {
    return get('checkins', {});
  }

  function addCheckin(locationId, data) {
    var checkins = getCheckins();
    checkins[locationId] = {
      timestamp: Date.now(),
      photo: (data && data.photo) || null,
      note: (data && data.note) || ''
    };
    set('checkins', checkins);
    return checkins;
  }

  function isCheckedIn(locationId) {
    return !!getCheckins()[locationId];
  }

  function getCheckinCount() {
    return Object.keys(getCheckins()).length;
  }

  return {
    init: init,
    get: get,
    set: set,
    remove: remove,
    getBookmarks: getBookmarks,
    addBookmark: addBookmark,
    removeBookmark: removeBookmark,
    isBookmarked: isBookmarked,
    getRoutes: getRoutes,
    saveRoute: saveRoute,
    deleteRoute: deleteRoute,
    getCheckins: getCheckins,
    addCheckin: addCheckin,
    isCheckedIn: isCheckedIn,
    getCheckinCount: getCheckinCount
  };
})();
