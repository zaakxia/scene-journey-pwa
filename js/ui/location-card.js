// Location detail card (used in Bottom Sheet)
const LocationCard = (() => {

  function parseExcerpt(excerpt) {
    // 拆分原文部分
    var parts = excerpt.split('\n\n原文：\n');
    if (parts.length < 2) parts = excerpt.split('\n原文：\n');
    if (parts.length < 2) parts = excerpt.split('原文：\n');
    if (parts.length < 2) parts = excerpt.split('原文：');
    var context = (parts[0] || '').trim();
    var original = parts.length >= 2 ? parts[1].trim() : '';

    // 解析出处：【龙族X·第Y幕「名称」】→ 《龙族X》第Y幕-名称
    var sourceText = '';
    var summary = context;
    var sourceMatch = context.match(/【(.+?)】/);
    if (sourceMatch) {
      var raw = sourceMatch[1]
        .replace(/[《》]/g, '');  // 先清除任何已有的书名号
      var bk = raw.match(/龙族\s*(\d+)\s*(上|中|下)?/);
      var ch = raw.match(/第([^「」\s·⋅]+)/);
      var nm = raw.match(/「([^」」]+)」/);
      if (bk) {
        sourceText = '《龙族' + bk[1] + '》';
        if (bk[2]) sourceText += bk[2] + ' ';
        if (ch) sourceText += '第' + ch[1];
        if (nm) sourceText += '-' + nm[1].replace(/[】\]」]/g, '').trim();
      } else {
        sourceText = raw
          .replace(/龙族(\d+)/, '《龙族$1》')
          .replace(/[·⋅]/g, ' ').replace(/「([^」]+)」/g, '-$1');
      }
      summary = context.replace(sourceMatch[0], '').trim();
    }
    return { source: sourceText, summary: summary, original: original };
  }

  function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render(location, callbacks) {
    callbacks = callbacks || {};
    var isFav = Storage.isBookmarked(location.id);
    var isChecked = Storage.isCheckedIn(location.id);
    var checkinData = Storage.getCheckins()[location.id];

    var categoryZH = Format.category(location.category);
    var accessZH = Format.accessibility(location.accessibility);
    var stars = Icons.starFill + ' ×' + location.popularity;

    var h = '';

    // Header
    h += '<div class="sheet-header">';
    h += '<div><div class="sheet-title font-hand">' + location.name_zh + '</div>';
    h += '<div class="text-sm text-secondary">' + (location.name_local || '') + '</div></div>';
    h += '</div>';

    // Hero photo
    h += '<div class="card-photo-wrap">';
    h += '<img src="' + location.real_photo + '?t=2" alt="实地照片" class="card-photo" onerror="this.onerror=null;this.src=\'../assets/images/ui/placeholder-photo.svg\'">';
    h += '<div class="card-photo-label">实地照片 · ' + location.name_zh + '</div>';
    if (location.visit_duration) h += '<div class="card-photo-duration">' + Icons.iconLabel('clock', '建议游玩: ' + location.visit_duration) + '</div>';
    h += '</div>';

    // Novel excerpt — 出处 / 剧情简介 / 原著原文 三区块
    if (location.novel_excerpt) {
      var parsed = parseExcerpt(location.novel_excerpt);

      // ── 出处 ──
      if (parsed.source) {
        h += '<div style="margin-bottom:10px;">';
        h += '<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">' + Icons.iconLabel('book', '出处') + '</div>';
        h += '<div style="font-size:var(--font-size-sm);font-weight:600;color:var(--theme-primary);margin-top:2px;">' + parsed.source + '</div>';
        h += '</div>';
      }

      // ── 剧情简介 ──
      if (parsed.summary) {
        h += '<div style="margin-bottom:12px;">';
        h += '<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">' + Icons.iconLabel('edit', '剧情简介') + '</div>';
        h += '<div style="font-size:var(--font-size-sm);line-height:1.7;color:var(--color-text);margin-top:2px;">' + parsed.summary.replace(/\n/g, '<br>') + '</div>';
        h += '</div>';
      }

      // ── 原著原文 ──
      if (parsed.original) {
        h += '<div class="letter-card" style="margin-bottom:16px;">';
        h += '<div class="letter-title">' + Icons.iconLabel('scroll', '原著原文') + '</div>';
        var paras = parsed.original.split(/\n\n+/);
        var fp = '';
        for (var pi = 0; pi < paras.length; pi++) {
          var pt = paras[pi].replace(/\n/g, '<br>').trim();
          if (pt) {
            fp += '<p style="text-indent:2em;margin-bottom:' + (pi < paras.length - 1 ? '8px' : '0') + ';">' + pt + '</p>';
          }
        }
        h += '<div style="font-size:var(--font-size-sm);line-height:1.9;">' + fp + '</div>';
        h += '</div>';
      }
    }

    // Tags
    h += '<div class="location-meta">';
    if (location.popularity) h += '<span class="tag tag-accent">' + stars + '</span>';
    h += '<span class="tag">' + categoryZH + '</span>';
    h += '<span class="tag">' + accessZH + '</span>';
    if (location.city) h += '<span class="tag tag-info">' + location.city + '</span>';
    if (location.visit_duration) h += '<span class="tag">' + Icons.iconLabel('clock', location.visit_duration, 14) + '</span>';
    h += '</div>';

    // Operating hours
    if (location.open_time !== undefined && location.close_time !== undefined) {
      var toTime = function(s) { var h=Math.floor(s/2); var m=(s%2)*30; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); };
      var oh = toTime(location.open_time) + '-' + toTime(location.close_time);
      h += '<div class="memo-card" style="margin-bottom:8px;font-size:var(--font-size-xs);">';
      h += '<span style="color:var(--color-primary);font-weight:600;">开放时间：' + oh + '</span>';
      if (location.hours_note) h += '<div style="color:var(--color-text-secondary);margin-top:4px;font-size:11px;">' + location.hours_note + '</div>';
      h += '</div>';
    }
    h += '<div class="memo-card" style="margin-bottom:16px;">';
    h += '<div class="text-sm font-bold" style="margin-bottom:4px;">交通信息</div>';
    h += '<div class="text-sm text-secondary">' + Icons.iconLabel('pin', location.address, 14) + '</div>';
    if (location.nearest_station) h += '<div class="text-sm text-secondary">' + Icons.iconLabel('train', '最近车站: ' + location.nearest_station, 14) + '</div>';
    h += '</div>';

    // Editable duration for custom locations
    if (location.is_custom) {
      h += '<div class="memo-card" style="margin-bottom:8px;">';
      h += '<div style="display:flex;align-items:center;gap:8px;">';
      h += '<span style="font-size:13px;font-weight:600;">游玩时间：</span>';
      h += '<span id="txt-duration" style="font-size:13px;">' + (location.visit_duration || '2h') + '</span>';
      h += '<button class="btn btn-outline" id="btn-edit-duration" style="font-size:11px;padding:2px 10px;">编辑</button>';
      h += '</div></div>';
    }

    // Checkin stamp
    if (isChecked && checkinData) {
      h += '<div class="card" style="margin-bottom:16px;background:rgba(42,157,143,0.06);padding:12px 16px;">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">';
      h += '<span class="checkin-stamp">' + Icons.iconLabel('check', '已打卡') + '</span>';
      h += '<span class="text-xs text-secondary">' + Format.relativeTime(checkinData.timestamp) + '</span>';
      h += '</div>';
      if (checkinData.photo) h += '<img src="' + checkinData.photo + '" class="checkin-photo" alt="打卡照片">';
      if (checkinData.note) h += '<p class="text-sm text-secondary" style="margin-top:8px;">' + checkinData.note + '</p>';
      h += '</div>';
    }

    // Action buttons
    h += '<div style="display:flex;gap:8px;margin-top:8px;">';
    h += '<button class="btn btn-outline btn-block" id="btn-bookmark">';
    h += isFav ? '<span class="bookmark-sticker">' + Icons.iconLabel('starFill', '已收藏') + '</span>' : Icons.iconLabel('star', '收藏');
    h += '</button>';
    h += '<button class="btn btn-primary btn-block" id="btn-navigate">' + Icons.iconLabel('compass', '导航') + '</button>';
    if (!isChecked) {
      h += '<button class="btn btn-outline btn-block" id="btn-checkin">' + Icons.iconLabel('check', '打卡') + '</button>';
    }
    if (location.is_custom) {
      h += '<button class="btn btn-outline btn-block" id="btn-delete-custom" style="color:#e63946;border-color:#e63946;">删除取景地</button>';
    }
    h += '</div>';

    return h;
  }

  function bindEvents(location, callbacks) {
    callbacks = callbacks || {};
    var btnBookmark = document.getElementById('btn-bookmark');
    var btnNavigate = document.getElementById('btn-navigate');
    var btnCheckin = document.getElementById('btn-checkin');

    if (btnBookmark) {
      btnBookmark.addEventListener('click', function() {
        if (Storage.isBookmarked(location.id)) {
          Storage.removeBookmark(location.id);
          App.showToast('已取消收藏');
        } else {
          Storage.addBookmark(location.id);
          App.showToast('已加入收藏');
        }
        BottomSheet.close();
        setTimeout(function() {
          BottomSheet.open(render(location, callbacks), callbacks.onClose);
          bindEvents(location, callbacks);
        }, 300);
        if (callbacks.onBookmark) callbacks.onBookmark(location);
      });
    }

    if (btnNavigate) {
      btnNavigate.addEventListener('click', function() {
        ShareUtils.openExternalMap(
          location.coordinates.lat,
          location.coordinates.lng,
          location.name_zh
        );
        if (callbacks.onNavigate) callbacks.onNavigate(location);
      });
    }

    if (btnCheckin) {
      btnCheckin.addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.addEventListener('change', function(e) {
          var file = e.target.files[0];
          if (file) {
            var reader = new FileReader();
            reader.onload = function() {
              Storage.addCheckin(location.id, { photo: reader.result });
              App.showToast('打卡成功！');
              BottomSheet.close();
              if (callbacks.onCheckin) callbacks.onCheckin(location);
            };
            reader.readAsDataURL(file);
          } else {
            Storage.addCheckin(location.id);
            App.showToast('打卡成功！');
            BottomSheet.close();
            if (callbacks.onCheckin) callbacks.onCheckin(location);
          }
        });
        input.click();
      });
    }

    var btnEditDuration = document.getElementById('btn-edit-duration');
    if (btnEditDuration) {
      btnEditDuration.onclick = function() {
        var current = parseInt(location.visit_duration) || 2;
        var val = prompt('游玩时间（小时）：', current);
        if (val && !isNaN(val) && parseInt(val) > 0) {
          var hours = parseInt(val);
          location.visit_duration = hours + 'h';
          var customLocs = Storage.get('custom_locations') || [];
          var idx = -1;
          for (var i = 0; i < customLocs.length; i++) {
            if (customLocs[i].id === location.id) { idx = i; break; }
          }
          if (idx >= 0) {
            customLocs[idx].visit_duration = hours + 'h';
            Storage.set('custom_locations', customLocs);
          }
          // Refresh card to show updated duration
          BottomSheet.open(render(location, callbacks), callbacks.onClose);
          bindEvents(location, callbacks);
        }
      };
    }

    var btnDeleteCustom = document.getElementById('btn-delete-custom');
    if (btnDeleteCustom) {
      btnDeleteCustom.onclick = function() {
        if (confirm('确定删除此取景地？')) {
          var customLocs = Storage.get('custom_locations') || [];
          customLocs = customLocs.filter(function(l) { return l.id !== location.id; });
          Storage.set('custom_locations', customLocs);
          BottomSheet.close();
          if (callbacks.onDelete) callbacks.onDelete(location);
        }
      };
    }
  }

  return { render: render, bindEvents: bindEvents };
})();
