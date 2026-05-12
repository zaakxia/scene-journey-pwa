// SVG icon system — replaces emoji for consistent cross-platform rendering
const Icons = (() => {
  // Inline SVG helper: keeps HTML clean, supports CSS color inherit
  function svg(viewBox, path, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="' + viewBox + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  function svgFill(viewBox, body, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="' + viewBox + '" fill="currentColor" aria-hidden="true">' + body + '</svg>';
  }

  var I = {};

  I.pin       = svg('0 0 24 24', '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>');
  I.book      = svg('0 0 24 24', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>');
  I.edit      = svg('0 0 24 24', '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>');
  I.scroll    = svg('0 0 24 24', '<path d="M8 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M8 2v4h4"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/>');
  I.clock     = svg('0 0 24 24', '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>');
  I.train     = svg('0 0 24 24', '<rect x="4" y="3" width="16" height="16" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="8" y1="3" x2="8" y2="11"/><line x1="16" y1="3" x2="16" y2="11"/><circle cx="6" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>');
  I.compass   = svg('0 0 24 24', '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>');
  I.star      = svg('0 0 24 24', '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');
  I.starFill  = svgFill('0 0 24 24', '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');
  I.check     = svg('0 0 24 24', '<polyline points="20 6 9 17 4 12"/>');
  I.map       = svg('0 0 24 24', '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>');
  I.x         = svg('0 0 24 24', '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
  I.arrowUp   = svg('0 0 24 24', '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>');
  I.arrowDown = svg('0 0 24 24', '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>');
  I.camera    = svg('0 0 24 24', '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>');
  I.refresh   = svg('0 0 24 24', '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>');
  I.save      = svg('0 0 24 24', '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>');

  // Icon with label — for consistent inline icon+text pattern
  function iconLabel(iconName, label, size) {
    return '<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">' + I[iconName] + '<span>' + label + '</span></span>';
  }

  return Object.assign(I, { iconLabel: iconLabel });
})();
