// Bottom Sheet UI component
const BottomSheet = (() => {
  let sheetEl = null;
  let overlayEl = null;
  let isOpen = false;
  let _onClose = null;
  let _closeBtn = null;

  function create() {
    if (sheetEl) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'bottom-sheet-overlay hidden';
    overlayEl.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); });
    overlayEl.addEventListener('touchmove', function(e) { e.preventDefault(); e.stopPropagation(); });

    sheetEl = document.createElement('div');
    sheetEl.className = 'bottom-sheet';
    // Prevent touch events from reaching the map underneath
    sheetEl.addEventListener('touchstart', function(e) { e.stopPropagation(); });
    sheetEl.addEventListener('touchmove', function(e) { e.stopPropagation(); });

    // Minimal close bar
    var closeBar = document.createElement('div');
    closeBar.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:6px 16px;flex-shrink:0;position:relative;';

    _closeBtn = document.createElement('button');
    _closeBtn.innerHTML = Icons.x;
    _closeBtn.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:none;background:var(--color-bg);color:var(--color-text-secondary);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    _closeBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); close(); });
    _closeBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); close(); });

    closeBar.innerHTML = '<div class="sheet-handle"></div>';
    closeBar.appendChild(_closeBtn);

    var contentEl = document.createElement('div');
    contentEl.className = 'sheet-content';
    contentEl.id = 'sheet-content';

    sheetEl.appendChild(closeBar);
    sheetEl.appendChild(contentEl);

    document.body.appendChild(overlayEl);
    document.body.appendChild(sheetEl);
  }

  function open(content, onClose) {
    create();
    _onClose = onClose || null;

    document.getElementById('sheet-content').innerHTML = content;

    overlayEl.style.display = '';
    overlayEl.classList.remove('hidden');
    sheetEl.style.display = '';
    sheetEl.classList.remove('hidden');
    sheetEl.style.transform = '';
    document.body.style.overflow = 'hidden';
    isOpen = true;
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    sheetEl.style.display = 'none';
    sheetEl.classList.add('hidden');
    overlayEl.style.display = 'none';
    overlayEl.classList.add('hidden');
    document.body.style.overflow = '';
    if (_onClose) { var cb = _onClose; _onClose = null; cb(); }
  }

  return { open, close };
})();
