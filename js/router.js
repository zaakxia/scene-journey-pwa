// Router: simple hash-based SPA routing
const Router = (() => {
  let currentView = null;
  const views = {};

  function register(name, handler) {
    views[name] = handler;
  }

  function navigate(view, params = {}) {
    currentView = view;
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    history.pushState({ view, params }, '', '#' + view + query);
    // View switching is handled by switchTab directly; Router only manages URL state
  }

  function init() {
    const hash = location.hash.replace('#', '') || 'map';
    const [view, queryStr] = hash.split('?');
    const params = {};
    if (queryStr) {
      new URLSearchParams(queryStr).forEach((v, k) => { params[k] = v; });
    }
    currentView = view;
    if (views[view]) {
      views[view](params);
    }
    window.addEventListener('popstate', () => {
      const h = location.hash.replace('#', '') || 'map';
      const [v, qs] = h.split('?');
      const p = {};
      if (qs) new URLSearchParams(qs).forEach((val, key) => { p[key] = val; });
      currentView = v;
      if (views[v]) views[v](p);
    });
  }

  return { register, navigate, init, getCurrent: () => currentView };
})();
