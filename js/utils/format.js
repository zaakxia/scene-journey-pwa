// Formatting utilities
const Format = (() => {
  function date(timestamp) {
    const d = new Date(timestamp);
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function relativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + '分钟前';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + '小时前';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + '天前';
    return date(timestamp);
  }

  function difficulty(d) {
    const map = { easy: '轻松', medium: '适中', hard: '挑战' };
    return map[d] || d;
  }

  function category(c) {
    const map = { landmark: '地标', street: '街景', nature: '自然', interior: '室内', other: '其他' };
    return map[c] || c;
  }

  function accessibility(a) {
    const map = { public: '可自由访问', limited: '限时开放', private: '私人区域' };
    return map[a] || a;
  }

  return { date, relativeTime, difficulty, category, accessibility };
})();

// Share utility
const ShareUtils = (() => {
  function encodeRoute(routeId, locationIds) {
    const data = { r: routeId, l: locationIds.join(',') };
    try {
      return btoa(JSON.stringify(data));
    } catch {
      return '';
    }
  }

  function decodeRoute(hash) {
    try {
      return JSON.parse(atob(hash));
    } catch {
      return null;
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    }
  }

  function isInChina(lat, lng) {
    return lng >= 73 && lng <= 135 && lat >= 18 && lat <= 54;
  }

  function openExternalMap(lat, lng, label) {
    var name = encodeURIComponent(label || '');
    var url;

    if (isInChina(lat, lng)) {
      // 国内 → 高德地图
      url = 'https://uri.amap.com/navigation?to=' + lng + ',' + lat + ',' + name + '&mode=car&callnative=1';
    } else {
      // 国外 → Google Maps
      url = 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
    }

    window.open(url, '_blank');
  }

  return { encodeRoute, decodeRoute, copy, openExternalMap };
})();
