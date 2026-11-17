/*!
 * Newsletter Builder - editor UI
 * Framework-free editor shared by the standalone tool and the SPFx web part.
 * Hosts supply a "provider" (open/save) and optional extra toolbar actions.
 * Source of truth: NewsletterBuilder/standalone/js/nl-editor.js
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./nl-core.js')); }
  else { root.NLEditor = factory(root.NLCore); }
})(typeof self !== 'undefined' ? self : this, function (NLCore) {
  'use strict';

  var U = NLCore.util;

  /* ------------------------------------------------------------------ CSS */
  var CSS = [
    '.nlb{--b:#2563eb;--b2:#1d4ed8;--bd:#dfe3ea;--bg:#f4f6f9;--pn:#ffffff;--tx:#1f2937;--mu:#6b7280;--dg:#b91c1c;',
    'font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif;font-size:13px;color:var(--tx);background:var(--bg);display:flex;flex-direction:column;height:100%;min-height:560px;box-sizing:border-box;position:relative;}',
    '.nlb *,.nlb *::before,.nlb *::after,.nlb-ovl *{box-sizing:border-box;}',
    '.nlb button,.nlb-ovl button{font:inherit;cursor:pointer;border:1px solid var(--bd);background:#fff;color:var(--tx);border-radius:6px;padding:6px 10px;line-height:1.2;white-space:nowrap;}',
    '.nlb button:hover,.nlb-ovl button:hover{border-color:#b8c0cc;background:#f8fafc;} .nlb button:disabled,.nlb-ovl button:disabled{opacity:.45;cursor:default;}',
    '.nlb button.nlb-primary,.nlb-ovl button.nlb-primary{background:var(--b);border-color:var(--b);color:#fff;} .nlb button.nlb-primary:hover,.nlb-ovl button.nlb-primary:hover{background:var(--b2);}',
    '.nlb button.nlb-danger,.nlb-ovl button.nlb-danger{color:var(--dg);} .nlb button.nlb-icon{padding:5px 8px;min-width:30px;}',
    '.nlb input,.nlb select,.nlb textarea,.nlb-ovl input,.nlb-ovl select,.nlb-ovl textarea{font:inherit;color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:6px 8px;background:#fff;width:100%;}',
    '.nlb input:focus,.nlb select:focus,.nlb textarea:focus,.nlb .nlb-rt-area:focus,.nlb-ovl input:focus,.nlb-ovl select:focus,.nlb-ovl textarea:focus{outline:2px solid rgba(37,99,235,.35);border-color:var(--b);}',
    '.nlb textarea,.nlb-ovl textarea{min-height:64px;resize:vertical;} .nlb-ovl input[type=checkbox]{width:auto;}',
    '.nlb-top{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--pn);border-bottom:1px solid var(--bd);flex-wrap:wrap;}',
    '.nlb-brand{font-weight:700;font-size:15px;display:flex;align-items:center;gap:6px;white-space:nowrap;}',
    '.nlb-brand span{color:var(--b);font-size:18px;}',
    '.nlb-title{max-width:280px;font-weight:600;}',
    '.nlb-dirty{color:#d97706;font-size:12px;white-space:nowrap;}',
    '.nlb-spacer{flex:1;}',
    '.nlb-group{display:flex;gap:4px;align-items:center;flex-wrap:wrap;}',
    '.nlb-sep{width:1px;height:22px;background:var(--bd);margin:0 4px;}',
    '.nlb-body{flex:1;display:flex;min-height:0;}',
    '.nlb-left{width:250px;background:var(--pn);border-right:1px solid var(--bd);display:flex;flex-direction:column;min-height:0;}',
    '.nlb-right{width:340px;background:var(--pn);border-left:1px solid var(--bd);overflow:auto;min-height:0;}',
    '.nlb-tabs{display:flex;border-bottom:1px solid var(--bd);}',
    '.nlb-tabs button{flex:1;border:0;border-radius:0;background:none;padding:10px 4px;color:var(--mu);border-bottom:2px solid transparent;}',
    '.nlb-tabs button.on{color:var(--b);border-bottom-color:var(--b);font-weight:600;}',
    '.nlb-tabpane{flex:1;overflow:auto;padding:10px;}',
    '.nlb-h{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--mu);margin:12px 2px 6px;font-weight:600;}',
    '.nlb-h:first-child{margin-top:2px;}',
    '.nlb-pal{display:grid;grid-template-columns:1fr 1fr;gap:6px;}',
    '.nlb-pal button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;white-space:normal;text-align:center;font-size:12px;}',
    '.nlb-pal button i{font-style:normal;font-size:18px;line-height:1;}',
    '.nlb-pal button.people{border-color:#c7d7fe;background:#f5f8ff;}',
    '.nlb-hint{color:var(--mu);font-size:12px;line-height:1.45;margin:8px 2px;}',
    '.nlb-outline{list-style:none;margin:0;padding:0;}',
    '.nlb-outline li{display:flex;align-items:center;gap:6px;padding:7px 8px;border:1px solid var(--bd);border-radius:6px;margin-bottom:5px;background:#fff;cursor:pointer;}',
    '.nlb-outline li.on{border-color:var(--b);background:#eff4ff;}',
    '.nlb-outline li.drag-over{border-top:3px solid var(--b);}',
    '.nlb-outline li .g{cursor:grab;color:#9aa3af;} .nlb-outline li .t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} .nlb-outline li .t small{color:var(--mu);margin-left:4px;}',
    '.nlb-canvas{flex:1;overflow:auto;min-width:0;display:flex;flex-direction:column;}',
    '.nlb-canvasbar{display:flex;gap:6px;align-items:center;padding:6px 12px;border-bottom:1px solid var(--bd);background:#fbfcfd;position:sticky;top:0;z-index:3;}',
    '.nlb-canvasbar .on{background:#e8efff;border-color:var(--b);color:var(--b);}',
    '.nlb-stage{padding:18px;display:flex;justify-content:center;}',
    '.nlb-framewrap{position:relative;transition:width .2s;max-width:100%;}',
    '.nlb-framewrap iframe{display:block;width:100%;border:0;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12);min-height:300px;}',
    '.nlb-seltb{position:absolute;right:6px;display:none;gap:3px;z-index:2;background:#1e293b;border-radius:6px;padding:3px;box-shadow:0 2px 6px rgba(0,0,0,.25);}',
    '.nlb-seltb button{background:transparent;color:#fff;border:0;padding:4px 7px;font-size:12px;}',
    '.nlb-seltb button:hover{background:rgba(255,255,255,.15);}',
    '.nlb-seltb span{color:#cbd5e1;font-size:11px;padding:4px 6px;align-self:center;}',
    '.nlb-props{padding:12px;}',
    '.nlb-props-head{display:flex;align-items:center;gap:4px;margin-bottom:10px;}',
    '.nlb-props-head h3{flex:1;margin:0;font-size:14px;}',
    '.nlb-f{margin-bottom:10px;} .nlb-f>label{display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#374151;}',
    '.nlb-f.cb{display:flex;align-items:center;gap:8px;} .nlb-f.cb input{width:auto;} .nlb-f.cb>label{margin:0;font-weight:500;}',
    '.nlb-color{display:flex;gap:6px;align-items:center;} .nlb-color input[type=color]{width:38px;height:32px;padding:2px;flex:none;} .nlb-color button{flex:none;}',
    '.nlb-img{border:1px dashed #c3cad5;border-radius:6px;padding:8px;background:#fafbfc;}',
    '.nlb-img.drop{border-color:var(--b);background:#eff4ff;}',
    '.nlb-img .pv{display:flex;align-items:center;justify-content:center;min-height:60px;margin-bottom:6px;background:repeating-conic-gradient(#eef0f3 0% 25%,#fff 0% 50%) 50%/14px 14px;border-radius:4px;overflow:hidden;}',
    '.nlb-img .pv img{max-width:100%;max-height:120px;display:block;}',
    '.nlb-img .pv em{color:var(--mu);font-size:12px;padding:12px;text-align:center;}',
    '.nlb-img .row{display:flex;gap:4px;margin-top:4px;}',
    '.nlb-rt{border:1px solid var(--bd);border-radius:6px;background:#fff;}',
    '.nlb-rt-bar{display:flex;gap:2px;padding:3px;border-bottom:1px solid var(--bd);background:#f8fafc;border-radius:6px 6px 0 0;flex-wrap:wrap;}',
    '.nlb-rt-bar button{border:0;background:none;padding:3px 7px;min-width:26px;}',
    '.nlb-rt-bar button:hover{background:#e5e9f0;}',
    '.nlb-rt-area{min-height:80px;max-height:260px;overflow:auto;padding:8px;line-height:1.5;border-radius:0 0 6px 6px;}',
    '.nlb-rt-area p{margin:0 0 8px;} .nlb-rt-area ul,.nlb-rt-area ol{margin:0 0 8px;padding-left:20px;}',
    '.nlb-grp{border:1px solid var(--bd);border-radius:8px;margin:0 0 10px;background:#fff;}',
    '.nlb-grp>summary{padding:8px 10px;cursor:pointer;font-weight:600;font-size:12px;list-style:none;display:flex;align-items:center;gap:6px;}',
    '.nlb-grp>summary::-webkit-details-marker{display:none;}',
    '.nlb-grp>summary::before{content:"\\25B8";color:var(--mu);transition:transform .15s;} .nlb-grp[open]>summary::before{transform:rotate(90deg);}',
    '.nlb-grp>.in{padding:4px 10px 6px;}',
    '.nlb-item{border:1px solid var(--bd);border-radius:8px;margin-bottom:8px;background:#fbfcfe;}',
    '.nlb-item>summary{display:flex;align-items:center;gap:6px;padding:7px 8px;cursor:pointer;list-style:none;}',
    '.nlb-item>summary::-webkit-details-marker{display:none;}',
    '.nlb-item>summary .nm{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.nlb-item>summary img,.nlb-item>summary .av{width:26px;height:26px;border-radius:50%;object-fit:cover;flex:none;background:#cbd5e1;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700;}',
    '.nlb-item>summary button{padding:2px 6px;font-size:11px;}',
    '.nlb-item>.in{padding:6px 10px 2px;border-top:1px solid var(--bd);}',
    '.nlb-foot{display:flex;align-items:center;gap:12px;padding:5px 12px;border-top:1px solid var(--bd);background:var(--pn);font-size:12px;color:var(--mu);}',
    '.nlb-foot .ver{font-weight:600;color:#475569;}',
    '.nlb-menu{position:relative;display:inline-block;}',
    '.nlb-menu>.dd{display:none;position:absolute;right:0;top:calc(100% + 4px);background:#fff;border:1px solid var(--bd);border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.15);min-width:300px;z-index:50;padding:4px;}',
    '.nlb-menu.open>.dd{display:block;}',
    '.nlb-menu .dd button{display:block;width:100%;text-align:left;border:0;padding:8px 10px;white-space:normal;}',
    '.nlb-menu .dd button b{display:block;font-weight:600;} .nlb-menu .dd button small{color:var(--mu);}',
    '.nlb-ovl{--b:#2563eb;--b2:#1d4ed8;--bd:#dfe3ea;--tx:#1f2937;--mu:#6b7280;--dg:#b91c1c;position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:100000;padding:20px;font-family:"Segoe UI",system-ui,Arial,sans-serif;font-size:13px;color:#1f2937;}',
    '.nlb-modal{background:#fff;border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.3);width:520px;max-width:100%;max-height:calc(100vh - 40px);display:flex;flex-direction:column;}',
    '.nlb-modal.wide{width:960px;} .nlb-modal.mid{width:720px;}',
    '.nlb-modal h2{margin:0;padding:14px 18px;font-size:16px;border-bottom:1px solid #dfe3ea;}',
    '.nlb-modal .mb{padding:16px 18px;overflow:auto;}',
    '.nlb-modal .mf{padding:12px 18px;border-top:1px solid #dfe3ea;display:flex;justify-content:flex-end;gap:8px;}',
    '.nlb-tpls{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}',
    '.nlb-tpls button{text-align:left;padding:12px;white-space:normal;display:block;height:100%;}',
    '.nlb-tpls button b{display:block;font-size:14px;margin-bottom:4px;} .nlb-tpls button small{color:#6b7280;}',
    '.nlb-tpls button.on{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.25);}',
    '.nlb-toast{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);background:#1e293b;color:#fff;padding:9px 16px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:60;max-width:80%;font-size:13px;}',
    '.nlb-toast.err{background:#b91c1c;} .nlb-toast.ok{background:#15803d;}',
    '.nlb-table{width:100%;border-collapse:collapse;} .nlb-table th,.nlb-table td{text-align:left;padding:7px 8px;border-bottom:1px solid #e5e7eb;vertical-align:middle;} .nlb-table th{font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:.4px;}',
    '.nlb-table tr.click{cursor:pointer;} .nlb-table tr.click:hover td{background:#f5f8ff;}',
    '.nlb-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#e5e7eb;}',
    '.nlb-banner{padding:8px 12px;background:#fff7ed;border-bottom:1px solid #fed7aa;color:#9a3412;font-size:12px;display:flex;gap:8px;align-items:center;}',
    '.nlb-empty{padding:30px;text-align:center;color:#6b7280;}',
    '@media (max-width:1100px){.nlb-left{width:200px;} .nlb-right{width:300px;}}',
    '@media (max-width:820px){.nlb-body{flex-direction:column;} .nlb-left,.nlb-right{width:auto;max-height:40vh;} }'
  ].join('\n');

  function injectCss(doc) {
    doc = doc || document;
    if (doc.getElementById('nlb-css')) return;
    var st = doc.createElement('style');
    st.id = 'nlb-css';
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------ dom util */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function getPath(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function setPath(o, path, v) {
    var ks = path.split('.'), last = ks.pop();
    var t = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; return a[k]; }, o);
    t[last] = v;
  }
  function download(name, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name, style: { display: 'none' } });
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1500);
  }
  function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function htmlToText(html) {
    var d = document.createElement('div');
    d.innerHTML = html.replace(/<(style|title)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h\d|tr|li)>/gi, '\n');
    return (d.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* --------------------------------------------------------- image intake */
  function readFileAsDataUrl(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); });
  }
  function loadImage(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('Could not read image')); }; i.src = src; });
  }
  /** Resize/compress uploads so newsletters stay small. Photos are square-cropped. */
  function processImage(file, opt) {
    opt = opt || {};
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('Please choose an image file.'));
    return readFileAsDataUrl(file).then(function (dataUrl) {
      if (file.type === 'image/gif' && file.size < 600 * 1024) return dataUrl; // keep animation
      return loadImage(dataUrl).then(function (img) {
        var c = document.createElement('canvas'), ctx = c.getContext('2d');
        var sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0, tw, th;
        if (opt.photo) {
          var side = Math.min(sw, sh); sx = (sw - side) / 2; sy = Math.max(0, (sh - side) / 2 - side * 0.08); // bias towards faces
          sy = Math.min(sy, sh - side); sw = sh = side; tw = th = Math.min(320, side);
        } else {
          var maxW = opt.maxW || 1280; tw = Math.min(maxW, sw); th = Math.round(sh * tw / sw);
        }
        c.width = tw; c.height = th;
        var keepPng = file.type === 'image/png' && !opt.photo;
        if (!keepPng) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, tw, th); }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
        if (keepPng) { var png = c.toDataURL('image/png'); if (png.length < 450 * 1024) return png; ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tw, th); }
        return c.toDataURL('image/jpeg', 0.84);
      });
    });
  }

  /* ============================================================ EDITOR */

  function create(container, options) {
    options = options || {};
    injectCss();
    var provider = options.provider || {};
    var appName = options.appName || 'Newsletter Builder';
    var appVersion = options.version || NLCore.VERSION;
    var autosaveKey = options.autosaveKey === undefined ? 'nlb.autosave' : options.autosaveKey;

    var state = {
      doc: NLCore.newDocument(options.initialTemplate || 'people'),
      ref: null, name: null,           // provider reference of the open document
      selected: null, dirty: false,
      undo: [], redo: [], lastSnap: 0,
      device: 'desktop', tab: 'add'
    };
    var renderTimer = null, autosaveTimer = null;
    var openItems = typeof WeakSet !== 'undefined' ? new WeakSet() : { has: function () { return false; }, add: function () {}, delete: function () {} };
    function initialsOf(n) { return String(n || '?').trim().split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase() || '?'; }

    /* ---------- layout ---------- */
    var root = h('div', { class: 'nlb' });
    container.innerHTML = '';
    container.appendChild(root);

    var titleInput = h('input', { class: 'nlb-title', title: 'Newsletter name', oninput: function () { snapshot(); state.doc.title = titleInput.value; touched(false); } });
    var dirtyEl = h('span', { class: 'nlb-dirty' });
    var undoBtn = h('button', { class: 'nlb-icon', title: 'Undo (Ctrl+Z)', onclick: undo, text: '↶' });
    var redoBtn = h('button', { class: 'nlb-icon', title: 'Redo (Ctrl+Y)', onclick: redo, text: '↷' });

    var fileGroup = h('div', { class: 'nlb-group' },
      h('button', { onclick: cmdNew, title: 'Start a new newsletter from a layout', text: 'New' }),
      provider.open ? h('button', { onclick: cmdOpen, text: provider.openLabel || 'Open' }) : null,
      provider.save ? h('button', { onclick: function () { cmdSave(false); }, title: 'Save (Ctrl+S)', text: provider.saveLabel || 'Save' }) : null,
      provider.save ? h('button', { onclick: function () { cmdSave(true); }, text: 'Save as' }) : null,
      provider.showImportExport ? h('span', { class: 'nlb-sep' }) : null,
      provider.showImportExport ? h('button', { onclick: cmdImport, title: 'Import a newsletter .json file from your computer', text: 'Import' }) : null,
      provider.showImportExport ? h('button', { onclick: cmdExportJson, title: 'Download this newsletter as a .json file', text: 'Export' }) : null,
      h('span', { class: 'nlb-sep' }), undoBtn, redoBtn
    );

    var hostGroup = h('div', { class: 'nlb-group' });
    (options.actions || []).forEach(function (a) {
      hostGroup.appendChild(h('button', { class: a.primary ? 'nlb-primary' : '', title: a.title || '', text: a.label, onclick: function () { a.run(api); } }));
    });

    var outMenu = h('div', { class: 'nlb-menu' },
      h('button', { class: 'nlb-primary', text: 'Get email ▾', onclick: function (e) { e.stopPropagation(); outMenu.classList.toggle('open'); } }),
      h('div', { class: 'dd' },
        menuItem('Open in Outlook (.eml)', 'Recommended. Opens as a new draft in classic Outlook with images embedded.', cmdEml),
        menuItem('Copy for Outlook', 'Copies the formatted email; paste into a new Outlook message.', cmdCopyRich),
        menuItem('Copy HTML code', 'Raw HTML source for other mail tools.', cmdCopyHtml),
        menuItem('Download HTML file', 'Self-contained .html file.', cmdDownloadHtml)
      ));
    document.addEventListener('click', closeMenus);

    var top = h('header', { class: 'nlb-top' },
      h('div', { class: 'nlb-brand' }, h('span', { text: '✉' }), appName),
      titleInput, dirtyEl, h('div', { class: 'nlb-spacer' }), fileGroup, hostGroup.childNodes.length ? h('span', { class: 'nlb-sep' }) : null, hostGroup,
      h('span', { class: 'nlb-sep' }), h('button', { text: 'Preview', onclick: cmdPreview }), outMenu);

    // left
    var tabs = h('div', { class: 'nlb-tabs' });
    var tabPane = h('div', { class: 'nlb-tabpane' });
    [['add', 'Add'], ['outline', 'Outline'], ['settings', 'Settings']].forEach(function (t) {
      tabs.appendChild(h('button', { 'data-tab': t[0], text: t[1], onclick: function () { state.tab = t[0]; renderLeft(); } }));
    });
    var left = h('aside', { class: 'nlb-left' }, tabs, tabPane);

    // canvas
    var iframe = h('iframe', { title: 'Newsletter canvas' });
    var selTb = h('div', { class: 'nlb-seltb' });
    var frameWrap = h('div', { class: 'nlb-framewrap' }, iframe, selTb);
    var devBtns = {
      desktop: h('button', { text: '🖥 Desktop', onclick: function () { setDevice('desktop'); } }),
      mobile: h('button', { text: '📱 Mobile', onclick: function () { setDevice('mobile'); } })
    };
    var sizeEl = h('span', { class: 'nlb-hint', style: { margin: '0 0 0 auto' } });
    var canvas = h('main', { class: 'nlb-canvas' },
      h('div', { class: 'nlb-canvasbar' }, devBtns.desktop, devBtns.mobile, h('span', { class: 'nlb-hint', text: 'Click a section to edit it.' }), sizeEl),
      h('div', { class: 'nlb-stage' }, frameWrap));

    var right = h('aside', { class: 'nlb-right' });
    var statusEl = h('span');
    var foot = h('footer', { class: 'nlb-foot' }, statusEl, h('div', { class: 'nlb-spacer' }),
      options.footerNote ? h('span', { text: options.footerNote }) : null,
      h('span', { class: 'ver', text: appName + ' v' + appVersion + (appVersion !== NLCore.VERSION ? ' (core ' + NLCore.VERSION + ')' : '') }));

    var bannerSlot = h('div');
    root.appendChild(top);
    root.appendChild(bannerSlot);
    root.appendChild(h('div', { class: 'nlb-body' }, left, canvas, right));
    root.appendChild(foot);

    function menuItem(title, sub, fn) {
      return h('button', { onclick: function () { closeMenus(); fn(); } }, h('b', { text: title }), h('small', { text: sub }));
    }
    function closeMenus() { outMenu.classList.remove('open'); }

    /* ---------- state helpers ---------- */
    function snapshot(force) {
      var now = Date.now();
      if (force || now - state.lastSnap > 1200) {
        state.undo.push(JSON.stringify(state.doc));
        if (state.undo.length > 80) state.undo.shift();
        state.redo = [];
      }
      state.lastSnap = force ? 0 : now;
      updateUndo();
    }
    function updateUndo() { undoBtn.disabled = !state.undo.length; redoBtn.disabled = !state.redo.length; }
    function undo() {
      if (!state.undo.length) return;
      state.redo.push(JSON.stringify(state.doc));
      state.doc = JSON.parse(state.undo.pop());
      state.lastSnap = 0; afterLoad(true);
    }
    function redo() {
      if (!state.redo.length) return;
      state.undo.push(JSON.stringify(state.doc));
      state.doc = JSON.parse(state.redo.pop());
      state.lastSnap = 0; afterLoad(true);
    }
    function touched(rebuildPanels) {
      setDirty(true);
      scheduleRender();
      scheduleAutosave();
      if (rebuildPanels) { renderLeft(); renderProps(); }
    }
    function setDirty(d) {
      state.dirty = d;
      dirtyEl.textContent = d ? '● Unsaved changes' : (state.name ? 'Saved' + (provider.locationLabel ? ' to ' + provider.locationLabel : '') : '');
      if (options.onDirtyChange) options.onDirtyChange(d);
    }
    function afterLoad(keepDirty) {
      if (state.selected && !findSection(state.selected)) state.selected = null;
      titleInput.value = state.doc.title || '';
      updateUndo();
      renderLeft(); renderProps(); renderCanvas();
      if (keepDirty) touched(false);
    }
    function findSection(id) { return state.doc.sections.filter(function (s) { return s.id === id; })[0]; }
    function indexOf(id) { for (var i = 0; i < state.doc.sections.length; i++) if (state.doc.sections[i].id === id) return i; return -1; }

    /* ---------- section ops ---------- */
    function addSection(type) {
      snapshot(true);
      var sec = NLCore.makeSection(type);
      var idx = state.selected ? indexOf(state.selected) + 1 : state.doc.sections.length;
      // keep footer last when appending
      if (!state.selected) { var last = state.doc.sections[state.doc.sections.length - 1]; if (last && last.type === 'footer' && type !== 'footer') idx--; }
      state.doc.sections.splice(Math.max(0, idx), 0, sec);
      state.selected = sec.id;
      touched(true);
      setTimeout(scrollToSelected, 120);
    }
    function moveSection(id, dir) {
      var i = indexOf(id), j = i + dir;
      if (i < 0 || j < 0 || j >= state.doc.sections.length) return;
      snapshot(true);
      var s = state.doc.sections.splice(i, 1)[0];
      state.doc.sections.splice(j, 0, s);
      touched(true);
    }
    function moveSectionTo(id, targetIdx) {
      var i = indexOf(id); if (i < 0) return;
      snapshot(true);
      var s = state.doc.sections.splice(i, 1)[0];
      if (targetIdx > i) targetIdx--;
      state.doc.sections.splice(targetIdx, 0, s);
      touched(true);
    }
    function duplicateSection(id) {
      var i = indexOf(id); if (i < 0) return;
      snapshot(true);
      var c = U.clone(state.doc.sections[i]); c.id = U.uid('s');
      state.doc.sections.splice(i + 1, 0, c);
      state.selected = c.id;
      touched(true);
    }
    function deleteSection(id) {
      var i = indexOf(id); if (i < 0) return;
      snapshot(true);
      state.doc.sections.splice(i, 1);
      if (state.selected === id) state.selected = null;
      touched(true);
      toast('Section deleted - Undo with Ctrl+Z');
    }
    function select(id) {
      state.selected = id;
      renderProps(); applySelection();
      if (state.tab === 'outline') renderLeft();
    }

    /* ---------- left panel ---------- */
    function renderLeft() {
      Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === state.tab); });
      tabPane.innerHTML = '';
      if (state.tab === 'add') renderPalette();
      else if (state.tab === 'outline') renderOutline();
      else renderSettings(tabPane);
    }
    function renderPalette() {
      NLCore.GROUPS.forEach(function (g) {
        tabPane.appendChild(h('div', { class: 'nlb-h', text: g === 'People' ? 'People announcements' : g }));
        var grid = h('div', { class: 'nlb-pal' });
        Object.keys(NLCore.SECTIONS).forEach(function (type) {
          var def = NLCore.SECTIONS[type];
          if (def.group !== g) return;
          grid.appendChild(h('button', { class: g === 'People' ? 'people' : '', title: 'Add ' + def.label, onclick: function () { addSection(type); } }, h('i', { text: def.icon }), def.label));
        });
        tabPane.appendChild(grid);
      });
      tabPane.appendChild(h('p', { class: 'nlb-hint', text: 'New sections are inserted below the selected section (or at the end). Reorder them in the Outline tab or with the arrows on the canvas.' }));
    }
    function sectionSummary(s) {
      var p = s.props || {};
      var t = p.title || p.text || p.heading || p.label || '';
      if (!t && p.html) t = U.sanitizeRich(p.html).replace(/<[^>]+>/g, ' ').trim();
      var n = (p.people || p.items || []).length;
      return (n ? n + ' · ' : '') + String(t).slice(0, 40);
    }
    function renderOutline() {
      var ul = h('ul', { class: 'nlb-outline' });
      var dragId = null;
      state.doc.sections.forEach(function (s, i) {
        var def = NLCore.SECTIONS[s.type];
        var li = h('li', { class: s.id === state.selected ? 'on' : '', draggable: 'true', onclick: function () { select(s.id); scrollToSelected(); } },
          h('span', { class: 'g', text: '⋮⋮' }), h('span', { text: def.icon }),
          h('span', { class: 't' }, def.label, h('small', { text: sectionSummary(s) })),
          h('button', { class: 'nlb-icon', title: 'Move up', text: '↑', onclick: function (e) { e.stopPropagation(); moveSection(s.id, -1); } }),
          h('button', { class: 'nlb-icon', title: 'Move down', text: '↓', onclick: function (e) { e.stopPropagation(); moveSection(s.id, 1); } }));
        li.addEventListener('dragstart', function (e) { dragId = s.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', s.id); } catch (x) { /* IE */ } });
        li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('drag-over'); });
        li.addEventListener('dragleave', function () { li.classList.remove('drag-over'); });
        li.addEventListener('drop', function (e) { e.preventDefault(); li.classList.remove('drag-over'); if (dragId && dragId !== s.id) moveSectionTo(dragId, i); });
        ul.appendChild(li);
      });
      var endZone = h('li', { style: { border: '1px dashed #c3cad5', background: 'transparent', justifyContent: 'center', color: '#9aa3af' }, text: 'Drop here to move to end' });
      endZone.addEventListener('dragover', function (e) { e.preventDefault(); });
      endZone.addEventListener('drop', function (e) { e.preventDefault(); if (dragId) moveSectionTo(dragId, state.doc.sections.length); });
      ul.appendChild(endZone);
      tabPane.appendChild(h('div', { class: 'nlb-h', text: 'Sections (drag to reorder)' }));
      tabPane.appendChild(ul);
    }
    function renderSettings(pane) {
      var d = state.doc;
      var th = d.theme;
      pane.appendChild(h('div', { class: 'nlb-h', text: 'Email' }));
      buildFields(pane, [
        { k: 'subject', label: 'Email subject', type: 'text', placeholder: 'Subject line used when sending' },
        { k: 'preheader', label: 'Preview text (preheader)', type: 'text', placeholder: 'Shown after the subject in the inbox' }
      ], d, function () { touched(false); });

      pane.appendChild(h('div', { class: 'nlb-h', text: 'Theme' }));
      var presetSel = h('select', { onchange: function () {
        var p = NLCore.THEME_PRESETS[presetSel.value]; if (!p) return;
        snapshot(true);
        Object.keys(p).forEach(function (k) { if (k !== 'label') th[k] = p[k]; });
        th.preset = presetSel.value;
        touched(true);
      } });
      presetSel.appendChild(h('option', { value: '', text: '- Apply a colour preset -' }));
      Object.keys(NLCore.THEME_PRESETS).forEach(function (k) { presetSel.appendChild(h('option', { value: k, text: NLCore.THEME_PRESETS[k].label })); });
      pane.appendChild(h('div', { class: 'nlb-f' }, presetSel));
      buildFields(pane, [
        { k: 'primary', label: 'Primary (header, buttons)', type: 'color' },
        { k: 'accent', label: 'Accent', type: 'color' },
        { k: 'heading', label: 'Headings', type: 'color' },
        { k: 'text', label: 'Body text', type: 'color' },
        { k: 'muted', label: 'Secondary text', type: 'color' },
        { k: 'link', label: 'Links', type: 'color' },
        { k: 'pageBg', label: 'Page background', type: 'color' },
        { k: 'contentBg', label: 'Content background', type: 'color' },
        { k: 'cardBg', label: 'Card background', type: 'color' },
        { k: 'font', label: 'Body font', type: 'select', options: NLCore.FONTS },
        { k: 'headingFont', label: 'Heading font', type: 'select', options: NLCore.FONTS },
        { k: 'width', label: 'Email width', type: 'select', options: [{ value: 600, label: '600 px (safest)' }, { value: 640, label: '640 px' }, { value: 700, label: '700 px' }] },
        { k: 'radius', label: 'Corner radius (px)', type: 'number', min: 0, max: 24 },
        { k: 'dateFormat', label: 'Date format', type: 'select', options: NLCore.DATE_FORMATS.map(function (f) { return { value: f, label: f + '  (' + U.fmtDate('2026-11-17', f) + ')' }; }) }
      ], th, function () { touched(false); });
    }

    /* ---------- properties panel ---------- */
    function renderProps() {
      right.innerHTML = '';
      var wrap = h('div', { class: 'nlb-props' });
      right.appendChild(wrap);
      var sec = state.selected && findSection(state.selected);
      if (!sec) {
        wrap.appendChild(h('h3', { text: 'Nothing selected', style: { margin: '0 0 8px', fontSize: '14px' } }));
        wrap.appendChild(h('p', { class: 'nlb-hint', text: 'Click a section on the canvas to edit its content and layout. Use the Add tab to insert new sections, and Settings for subject line, colours and fonts.' }));
        return;
      }
      var def = NLCore.SECTIONS[sec.type];
      wrap.appendChild(h('div', { class: 'nlb-props-head' },
        h('h3', { text: def.icon + '  ' + def.label }),
        h('button', { class: 'nlb-icon', title: 'Move up', text: '↑', onclick: function () { moveSection(sec.id, -1); } }),
        h('button', { class: 'nlb-icon', title: 'Move down', text: '↓', onclick: function () { moveSection(sec.id, 1); } }),
        h('button', { class: 'nlb-icon', title: 'Duplicate', text: '⧉', onclick: function () { duplicateSection(sec.id); } }),
        h('button', { class: 'nlb-icon nlb-danger', title: 'Delete', text: '✕', onclick: function () { deleteSection(sec.id); } })));
      var onCh = function (rebuild) { touched(false); if (rebuild) renderProps(); };
      buildFields(wrap, def.fields, sec.props, onCh);
      var g = h('details', { class: 'nlb-grp' }, h('summary', { text: 'Section spacing & background' }));
      var gin = h('div', { class: 'in' }); g.appendChild(gin);
      buildFields(gin, NLCore.sectionStyleFields(), sec.props, onCh);
      wrap.appendChild(g);
    }

    /** Generic form builder driven by the section field schema. */
    function buildFields(parent, fields, obj, onChange) {
      fields.forEach(function (f) {
        if (f.type === 'group') {
          var g = h('details', { class: 'nlb-grp' }, h('summary', { text: f.label }));
          var gin = h('div', { class: 'in' }); g.appendChild(gin);
          if (getPath(obj, f.k) == null) setPath(obj, f.k, {});
          buildFields(gin, f.fields, getPath(obj, f.k), onChange);
          parent.appendChild(g);
          return;
        }
        if (f.type === 'list') { parent.appendChild(buildList(f, obj, onChange)); return; }
        parent.appendChild(buildField(f, obj, onChange));
      });
    }

    function buildField(f, obj, onChange) {
      var val = getPath(obj, f.k);
      var set = function (v, rebuild) { snapshot(); setPath(obj, f.k, v); onChange(rebuild); };
      var wrap = h('div', { class: 'nlb-f' + (f.type === 'checkbox' ? ' cb' : '') });
      var id = U.uid('f');
      var input;
      switch (f.type) {
        case 'checkbox':
          input = h('input', { type: 'checkbox', id: id, onchange: function () { set(input.checked); } });
          input.checked = !!val;
          wrap.appendChild(input); wrap.appendChild(h('label', { for: id, text: f.label }));
          return wrap;
        case 'textarea':
          input = h('textarea', { id: id, placeholder: f.placeholder || '', oninput: function () { set(input.value); } });
          input.value = val == null ? '' : val;
          break;
        case 'number':
          input = h('input', { type: 'number', id: id, min: f.min, max: f.max, oninput: function () { if (input.value !== '') set(+input.value); } });
          input.value = val == null ? '' : val;
          break;
        case 'select':
          input = h('select', { id: id, onchange: function () {
            var o = f.options[input.selectedIndex]; set(o.value, f.rebuild);
          } });
          f.options.forEach(function (o) { input.appendChild(h('option', { value: String(o.value), text: o.label })); });
          input.value = String(val);
          break;
        case 'color':
          input = buildColor(f, val, set);
          break;
        case 'date':
          input = h('input', { type: 'date', id: id, oninput: function () { set(input.value); } });
          input.value = /^\d{4}-\d{2}-\d{2}$/.test(val || '') ? val : '';
          break;
        case 'richtext':
          input = buildRich(val, function (v) { set(v); });
          break;
        case 'image':
          input = buildImage(f, val, function (v) { set(v); });
          break;
        case 'url':
          input = h('input', { type: 'url', id: id, placeholder: 'https://', oninput: function () { set(input.value); } });
          input.value = val == null ? '' : val;
          break;
        default:
          input = h('input', { type: 'text', id: id, placeholder: f.placeholder || '', oninput: function () { set(input.value); } });
          input.value = val == null ? '' : val;
      }
      wrap.appendChild(h('label', { for: id, text: f.label }));
      wrap.appendChild(input);
      return wrap;
    }

    function buildColor(f, val, set) {
      var txt = h('input', { type: 'text', placeholder: f.allowEmpty ? 'default' : '#000000', style: { flex: '1' } });
      var pick = h('input', { type: 'color' });
      txt.value = val || '';
      pick.value = /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#ffffff';
      pick.addEventListener('input', function () { txt.value = pick.value; set(pick.value); });
      txt.addEventListener('input', function () {
        var v = txt.value.trim();
        if (v === '' && f.allowEmpty) { set(''); return; }
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) { if (v.length === 7) pick.value = v; set(v); }
      });
      var row = h('div', { class: 'nlb-color' }, pick, txt);
      if (f.allowEmpty) row.appendChild(h('button', { class: 'nlb-icon', title: 'Use default', text: '⟲', onclick: function () { txt.value = ''; set(''); } }));
      return row;
    }

    function buildRich(val, set) {
      var area = h('div', { class: 'nlb-rt-area', contenteditable: 'true' });
      area.innerHTML = U.sanitizeRich(val || '');
      var emit = function () { set(area.innerHTML); };
      area.addEventListener('input', emit);
      area.addEventListener('paste', function (e) {
        // paste as clean text-with-structure (avoid Word/Outlook junk)
        var html = e.clipboardData && e.clipboardData.getData('text/html');
        var text = e.clipboardData && e.clipboardData.getData('text/plain');
        e.preventDefault();
        if (html) document.execCommand('insertHTML', false, U.sanitizeRich(html));
        else if (text) document.execCommand('insertText', false, text);
      });
      function cmd(c, arg) { return function (e) { e.preventDefault(); area.focus(); document.execCommand(c, false, arg); emit(); }; }
      var bar = h('div', { class: 'nlb-rt-bar' },
        h('button', { title: 'Bold', onmousedown: cmd('bold'), html: '<b>B</b>' }),
        h('button', { title: 'Italic', onmousedown: cmd('italic'), html: '<i>I</i>' }),
        h('button', { title: 'Underline', onmousedown: cmd('underline'), html: '<u>U</u>' }),
        h('button', { title: 'Insert link', text: '🔗', onmousedown: function (e) {
          e.preventDefault();
          var sel = window.getSelection();
          if (!sel || sel.isCollapsed) { toast('Select some text first, then add the link.'); return; }
          var range = sel.getRangeAt(0);
          var url = window.prompt('Link address (https://…, mailto:…)', 'https://');
          if (!url) return;
          area.focus(); sel.removeAllRanges(); sel.addRange(range);
          document.execCommand('createLink', false, U.safeUrl(url) || url);
          emit();
        } }),
        h('button', { title: 'Remove link', text: '⛓', onmousedown: cmd('unlink') }),
        h('button', { title: 'Bullet list', text: '•', onmousedown: cmd('insertUnorderedList') }),
        h('button', { title: 'Numbered list', text: '1.', onmousedown: cmd('insertOrderedList') }),
        h('button', { title: 'Clear formatting', text: 'Tx', onmousedown: cmd('removeFormat') }));
      return h('div', { class: 'nlb-rt' }, bar, area);
    }

    function buildImage(f, val, set) {
      var box = h('div', { class: 'nlb-img' });
      var fileIn = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      var urlIn = h('input', { type: 'url', placeholder: 'or paste an image URL (https://…)' });
      var pv = h('div', { class: 'pv' });
      function paint(v) {
        pv.innerHTML = '';
        if (v) pv.appendChild(h('img', { src: v, alt: '' }));
        else pv.appendChild(h('em', { text: f.photo ? 'No photo - initials will be shown' : 'No image - drop a file here' }));
        urlIn.value = v && !/^data:/.test(v) ? v : '';
      }
      function take(file) {
        if (!file) return;
        processImage(file, { photo: f.photo, maxW: f.maxW }).then(function (data) { paint(data); set(data); })
          .catch(function (e) { toast(e.message || 'Image could not be loaded', 'err'); });
      }
      fileIn.addEventListener('change', function () { take(fileIn.files[0]); fileIn.value = ''; });
      urlIn.addEventListener('change', function () { var u = U.safeUrl(urlIn.value); if (urlIn.value && !u) { toast('That URL is not allowed', 'err'); return; } paint(u); set(u); });
      box.addEventListener('dragover', function (e) { e.preventDefault(); box.classList.add('drop'); });
      box.addEventListener('dragleave', function () { box.classList.remove('drop'); });
      box.addEventListener('drop', function (e) { e.preventDefault(); box.classList.remove('drop'); take(e.dataTransfer.files[0]); });
      box.addEventListener('paste', function (e) {
        var it = Array.prototype.filter.call((e.clipboardData && e.clipboardData.items) || [], function (i) { return i.type.indexOf('image/') === 0; })[0];
        if (it) { e.preventDefault(); take(it.getAsFile()); }
      });
      paint(val);
      box.appendChild(pv);
      box.appendChild(h('div', { class: 'row' },
        h('button', { text: f.photo ? 'Upload photo…' : 'Upload image…', onclick: function () { fileIn.click(); } }),
        h('button', { class: 'nlb-danger', text: 'Remove', onclick: function () { paint(''); set(''); } })));
      box.appendChild(h('div', { class: 'row' }, urlIn));
      box.appendChild(fileIn);
      return box;
    }

    function buildList(f, obj, onChange) {
      var arr = getPath(obj, f.k);
      if (!Array.isArray(arr)) { arr = []; setPath(obj, f.k, arr); }
      var wrap = h('div', { class: 'nlb-f' });
      wrap.appendChild(h('label', { text: f.label + (f.fixed ? '' : ' (' + arr.length + ')') }));
      arr.forEach(function (item, i) {
        var nameOf = function () { return item[f.itemLabel] || ('Item ' + (i + 1)); };
        var nm = h('span', { class: 'nm', text: nameOf() });
        var avatar = null;
        if (f.fields.some(function (x) { return x.k === 'photo'; })) {
          avatar = item.photo ? h('img', { src: item.photo, alt: '' }) : h('span', { class: 'av', text: initialsOf(item.name) });
        }
        var stop = function (fn) { return function (e) { e.preventDefault(); e.stopPropagation(); fn(); }; };
        var sum = h('summary', null, avatar, nm,
          f.fixed ? null : h('button', { title: 'Move up', text: '↑', onclick: stop(function () { if (i > 0) { snapshot(true); arr.splice(i - 1, 0, arr.splice(i, 1)[0]); onChange(true); } }) }),
          f.fixed ? null : h('button', { title: 'Move down', text: '↓', onclick: stop(function () { if (i < arr.length - 1) { snapshot(true); arr.splice(i + 1, 0, arr.splice(i, 1)[0]); onChange(true); } }) }),
          f.fixed ? null : h('button', { title: 'Duplicate', text: '⧉', onclick: stop(function () { snapshot(true); var c = U.clone(item); c.id = U.uid('p'); arr.splice(i + 1, 0, c); onChange(true); }) }),
          f.fixed ? null : h('button', { class: 'nlb-danger', title: 'Remove', text: '✕', onclick: stop(function () { snapshot(true); arr.splice(i, 1); onChange(true); }) }));
        var det = h('details', { class: 'nlb-item' }, sum);
        var inner = h('div', { class: 'in' });
        det.appendChild(inner);
        var fill = function () {
          if (inner.childNodes.length) return;
          buildFields(inner, f.fields, item, function (rebuild) {
            nm.textContent = nameOf();
            if (avatar) {
              var nav = item.photo ? h('img', { src: item.photo, alt: '' }) : h('span', { class: 'av', text: initialsOf(item.name) });
              avatar.replaceWith(nav); avatar = nav;
            }
            onChange(rebuild);
          });
        };
        det.addEventListener('toggle', function () {
          if (det.open) { openItems.add(item); fill(); } else openItems.delete(item);
        });
        if (item.__open) { delete item.__open; openItems.add(item); }
        if (openItems.has(item)) { det.open = true; fill(); }
        wrap.appendChild(det);
      });
      if (!f.fixed) {
        wrap.appendChild(h('button', { text: '+ Add ' + (f.k === 'people' || f.k === 'items' ? 'person' : 'item'), onclick: function () {
          snapshot(true);
          var it = { id: U.uid('p'), __open: true };
          f.fields.forEach(function (x) { it[x.k] = x.type === 'select' ? x.options[0].value : ''; });
          arr.push(it);
          onChange(true);
        } }));
      }
      return wrap;
    }

    /* ---------- canvas ---------- */
    function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(renderCanvas, 140); }
    function renderCanvas() {
      clearTimeout(renderTimer);
      var html = NLCore.render(state.doc, { editor: true });
      var d = iframe.contentDocument;
      if (!d) return;
      d.open(); d.write(html); d.close();
      d.addEventListener('click', function (e) {
        e.preventDefault();
        var tr = e.target.closest && e.target.closest('tr[data-nl-id]');
        if (tr) select(tr.getAttribute('data-nl-id'));
      });
      Array.prototype.forEach.call(d.images, function (img) { if (!img.complete) img.addEventListener('load', resizeFrame); });
      applySelection();
      resizeFrame();
      var size = html.length;
      sizeEl.textContent = 'Email size ≈ ' + fmtBytes(size) + (size > 3 * 1048576 ? ' - large; use smaller/fewer images' : '');
      sizeEl.style.color = size > 3 * 1048576 ? '#b91c1c' : '';
    }
    function resizeFrame() {
      var d = iframe.contentDocument;
      if (!d || !d.body) return;
      iframe.style.height = Math.max(300, d.documentElement.scrollHeight) + 'px';
      positionToolbar();
    }
    function setDevice(dev) {
      state.device = dev;
      devBtns.desktop.classList.toggle('on', dev === 'desktop');
      devBtns.mobile.classList.toggle('on', dev === 'mobile');
      frameWrap.style.width = dev === 'mobile' ? '390px' : (+(state.doc.theme.width || 640) + 60) + 'px';
      setTimeout(resizeFrame, 250);
    }
    function applySelection() {
      var d = iframe.contentDocument; if (!d) return;
      Array.prototype.forEach.call(d.querySelectorAll('tr.nl-selected'), function (r) { r.classList.remove('nl-selected'); });
      if (state.selected) { var r = d.querySelector('tr[data-nl-id="' + state.selected + '"]'); if (r) r.classList.add('nl-selected'); }
      positionToolbar();
    }
    function positionToolbar() {
      var d = iframe.contentDocument;
      var r = state.selected && d && d.querySelector('tr[data-nl-id="' + state.selected + '"]');
      if (!r) { selTb.style.display = 'none'; return; }
      var def = NLCore.SECTIONS[(findSection(state.selected) || {}).type] || { label: '' };
      selTb.innerHTML = '';
      var id = state.selected;
      append(selTb, [h('span', { text: def.label }),
        h('button', { title: 'Move up', text: '↑', onclick: function () { moveSection(id, -1); } }),
        h('button', { title: 'Move down', text: '↓', onclick: function () { moveSection(id, 1); } }),
        h('button', { title: 'Duplicate', text: '⧉', onclick: function () { duplicateSection(id); } }),
        h('button', { title: 'Delete', text: '✕', onclick: function () { deleteSection(id); } })]);
      selTb.style.display = 'flex';
      var top = r.getBoundingClientRect().top - 30;
      selTb.style.top = Math.max(0, top) + 'px';
    }
    function scrollToSelected() {
      var d = iframe.contentDocument;
      var r = state.selected && d && d.querySelector('tr[data-nl-id="' + state.selected + '"]');
      if (!r) return;
      var y = r.getBoundingClientRect().top + iframe.offsetTop - 60;
      canvas.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }

    /* ---------- autosave (browser only, best effort) ---------- */
    function scheduleAutosave() {
      if (!autosaveKey) return;
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(function () {
        try {
          localStorage.setItem(autosaveKey, JSON.stringify({ at: new Date().toISOString(), ref: state.ref, name: state.name, dirty: state.dirty, doc: state.doc }));
          if (statusEl.dataset.autosaveFail) { delete statusEl.dataset.autosaveFail; status(''); }
        } catch (e) {
          statusEl.dataset.autosaveFail = '1';
          status('Browser draft backup unavailable (newsletter too large) - save regularly.');
        }
      }, 1500);
    }
    function checkAutosave() {
      if (!autosaveKey) return;
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(autosaveKey) || 'null'); } catch (e) { raw = null; }
      if (!raw || !raw.doc || !raw.dirty) return;
      var when = new Date(raw.at);
      var bar = h('div', { class: 'nlb-banner' },
        h('span', { text: 'Unsaved draft "' + (raw.doc.title || 'Untitled') + '" from ' + when.toLocaleString() + ' was found.' }),
        h('button', { text: 'Restore', onclick: function () {
          try { setDoc(NLCore.normalizeDocument(raw.doc), { ref: raw.ref, name: raw.name, dirty: true }); toast('Draft restored', 'ok'); } catch (e) { toast(e.message, 'err'); }
          bar.remove();
        } }),
        h('button', { text: 'Discard', onclick: function () { try { localStorage.removeItem(autosaveKey); } catch (e) { /* ignore */ } bar.remove(); } }));
      bannerSlot.appendChild(bar);
    }

    /* ---------- commands ---------- */
    function confirmDiscard() {
      if (!state.dirty) return Promise.resolve(true);
      return confirmDialog('Discard unsaved changes?', 'You have unsaved changes to "' + (state.doc.title || 'Untitled') + '".', 'Discard changes');
    }
    function cmdNew() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        var chosen = 'people';
        var grid = h('div', { class: 'nlb-tpls' });
        NLCore.TEMPLATES.forEach(function (t) {
          var b = h('button', { class: t.id === chosen ? 'on' : '', onclick: function () { chosen = t.id; Array.prototype.forEach.call(grid.children, function (x) { x.classList.remove('on'); }); b.classList.add('on'); }, ondblclick: function () { go(); } },
            h('b', { text: t.label }), h('small', { text: t.description }));
          grid.appendChild(b);
        });
        var keepTheme = h('input', { type: 'checkbox', id: 'nlb-keep-theme', checked: true });
        var m = modal({ title: 'New newsletter - choose a layout', size: 'mid', body: [grid, h('div', { class: 'nlb-f cb', style: { marginTop: '12px' } }, keepTheme, h('label', { for: 'nlb-keep-theme', text: 'Keep current colours and fonts' }))],
          actions: [{ label: 'Cancel' }, { label: 'Create', primary: true, onClick: function () { go(); return false; } }] });
        function go() {
          var d = NLCore.newDocument(chosen);
          if (keepTheme.checked) d.theme = U.clone(state.doc.theme);
          m.close();
          setDoc(d, { ref: null, name: null, dirty: false });
        }
      });
    }
    function cmdOpen() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        Promise.resolve(provider.open(api)).then(function (r) {
          if (!r) return;
          setDoc(NLCore.normalizeDocument(r.doc), { ref: r.ref, name: r.name, dirty: false });
          toast('Opened ' + (r.name || r.doc.title), 'ok');
        }).catch(function (e) { if (e && e.name === 'AbortError') return; toast('Could not open: ' + (e.message || e), 'err'); });
      });
    }
    function cmdSave(saveAs) {
      if (!provider.save) return Promise.resolve();
      status('Saving…');
      return Promise.resolve(provider.save(api, { saveAs: !!saveAs })).then(function (r) {
        if (!r) { status(''); return; }
        state.ref = r.ref; state.name = r.name;
        setDirty(false); scheduleAutosave();
        status('Saved ' + (r.name || '') + ' at ' + new Date().toLocaleTimeString());
        toast('Saved', 'ok');
      }).catch(function (e) { status(''); if (e && e.name === 'AbortError') return; toast('Save failed: ' + (e.message || e), 'err'); });
    }
    function cmdImport() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        var inp = h('input', { type: 'file', accept: '.json,application/json' });
        inp.addEventListener('change', function () {
          var f = inp.files[0]; if (!f) return;
          f.text().then(function (t) {
            setDoc(NLCore.normalizeDocument(JSON.parse(t)), { ref: null, name: null, dirty: true });
            toast('Imported ' + f.name, 'ok');
          }).catch(function (e) { toast('Import failed: ' + e.message, 'err'); });
        });
        inp.click();
      });
    }
    function cmdExportJson() {
      download(U.slugify(state.doc.title) + '.newsletter.json', NLCore.serialize(state.doc), 'application/json');
    }
    function cmdEml() {
      if (!state.doc.subject) toast('Tip: set an email subject in Settings.');
      download(U.slugify(state.doc.title) + '.eml', NLCore.buildEml(state.doc), 'message/rfc822');
      infoOnce('eml', 'Open the downloaded .eml file - classic Outlook opens it as a new draft. Add recipients and press Send. (New Outlook / Outlook on the web: use "Copy for Outlook" instead.)');
    }
    function cmdCopyRich() {
      var html = NLCore.render(state.doc);
      var text = htmlToText(html);
      var ok = function () { toast('Copied - paste into a new Outlook message (Ctrl+V)', 'ok'); };
      if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })])
          .then(ok).catch(function () { legacyCopyRich(html) ? ok() : toast('Copy blocked by the browser - use the .eml option', 'err'); });
      } else if (legacyCopyRich(html)) ok();
      else toast('Copy not supported here - use the .eml option', 'err');
    }
    function legacyCopyRich(html) {
      var holder = h('div', { contenteditable: 'true', style: { position: 'fixed', left: '-10000px', top: '0' } });
      holder.innerHTML = html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
      document.body.appendChild(holder);
      var r = document.createRange(); r.selectNodeContents(holder);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      s.removeAllRanges(); holder.remove();
      return ok;
    }
    function cmdCopyHtml() {
      var html = NLCore.render(state.doc);
      var done = function () { toast('HTML code copied', 'ok'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(html).then(done).catch(function () { fallbackCopyText(html) ? done() : toast('Copy failed', 'err'); });
      else if (fallbackCopyText(html)) done();
    }
    function fallbackCopyText(t) {
      var ta = h('textarea', { style: { position: 'fixed', left: '-10000px' } }); ta.value = t; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); return ok;
    }
    function cmdDownloadHtml() { download(U.slugify(state.doc.title) + '.html', NLCore.render(state.doc), 'text/html'); }
    function cmdPreview() {
      var fr = h('iframe', { style: { width: '100%', height: '70vh', border: '1px solid #dfe3ea', borderRadius: '6px', background: '#fff' } });
      var bDesk = h('button', { text: '🖥 Desktop', onclick: function () { fr.style.width = '100%'; } });
      var bMob = h('button', { text: '📱 Mobile', onclick: function () { fr.style.width = '390px'; } });
      modal({ title: 'Preview - ' + (state.doc.subject || state.doc.title), size: 'wide', body: [h('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' } }, bDesk, bMob), h('div', { style: { display: 'flex', justifyContent: 'center' } }, fr)], actions: [{ label: 'Close', primary: true }] });
      setTimeout(function () { var d = fr.contentDocument; d.open(); d.write(NLCore.render(state.doc)); d.close(); d.addEventListener('click', function (e) { if (e.target.closest('a')) e.preventDefault(); }); }, 0);
    }
    var shownInfo = {};
    function infoOnce(key, msg) { if (shownInfo[key]) { toast(msg); return; } shownInfo[key] = 1; modal({ title: 'Next step', body: h('p', { text: msg, style: { margin: 0, lineHeight: '1.5' } }), actions: [{ label: 'OK', primary: true }] }); }

    /* ---------- UI helpers ---------- */
    function modal(o) {
      var ovl = h('div', { class: 'nlb-ovl' });
      var m = h('div', { class: 'nlb-modal' + (o.size ? ' ' + o.size : '') });
      var body = h('div', { class: 'mb' }); append(body, o.body);
      var foot = h('div', { class: 'mf' });
      var api2 = { el: m, body: body, close: function () { ovl.remove(); document.removeEventListener('keydown', onKey); if (o.onClose) o.onClose(); } };
      (o.actions || [{ label: 'Close' }]).forEach(function (a) {
        foot.appendChild(h('button', { class: a.primary ? 'nlb-primary' : (a.danger ? 'nlb-danger' : ''), text: a.label, onclick: function () {
          var r = a.onClick ? a.onClick(api2) : undefined;
          if (r !== false) api2.close();
        } }));
      });
      function onKey(e) { if (e.key === 'Escape') api2.close(); }
      document.addEventListener('keydown', onKey);
      m.appendChild(h('h2', { text: o.title || '' })); m.appendChild(body); m.appendChild(foot);
      ovl.appendChild(m);
      ovl.addEventListener('mousedown', function (e) { if (e.target === ovl && !o.sticky) api2.close(); });
      document.body.appendChild(ovl);
      return api2;
    }
    function confirmDialog(title, msg, okLabel) {
      return new Promise(function (res) {
        var answered = false;
        modal({ title: title, body: h('p', { text: msg, style: { margin: 0 } }), onClose: function () { if (!answered) res(false); },
          actions: [{ label: 'Cancel' }, { label: okLabel || 'OK', primary: true, onClick: function () { answered = true; res(true); } }] });
      });
    }
    var toastTimer = null, toastEl = null;
    function toast(msg, kind) {
      if (toastEl) toastEl.remove();
      toastEl = h('div', { class: 'nlb-toast' + (kind ? ' ' + kind : ''), text: msg });
      root.appendChild(toastEl);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { if (toastEl) { toastEl.remove(); toastEl = null; } }, kind === 'err' ? 6000 : 3200);
    }
    function status(msg) { statusEl.textContent = msg || ''; }

    function setDoc(doc, meta) {
      meta = meta || {};
      state.doc = doc;
      state.ref = meta.ref || null; state.name = meta.name || null;
      state.selected = null; state.undo = []; state.redo = []; state.lastSnap = 0;
      afterLoad(false);
      setDirty(!!meta.dirty);
      setDevice(state.device);
      scheduleAutosave();
    }

    /* ---------- keyboard ---------- */
    function onKeyDown(e) {
      if (!root.isConnected) return;
      var inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); cmdSave(false); }
      else if (!inField && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (!inField && (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    }
    document.addEventListener('keydown', onKeyDown);
    function onBeforeUnload(e) { if (state.dirty && options.warnOnUnload !== false) { e.preventDefault(); e.returnValue = ''; return ''; } }
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('resize', positionToolbar);

    /* ---------- public API ---------- */
    var api = {
      getDoc: function () { return state.doc; },
      setDoc: setDoc,
      getRef: function () { return state.ref; },
      getName: function () { return state.name; },
      isDirty: function () { return state.dirty; },
      renderHtml: function () { return NLCore.render(state.doc); },
      mailPackage: function () { return NLCore.buildMailPackage(state.doc); },
      graphMessage: function () { return NLCore.buildGraphMessage(state.doc); },
      serialize: function () { return NLCore.serialize(state.doc); },
      save: cmdSave,
      toast: toast,
      status: status,
      modal: modal,
      confirm: confirmDialog,
      h: h,
      download: download,
      banner: function (el) { bannerSlot.appendChild(el); },
      destroy: function () {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('click', closeMenus);
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('resize', positionToolbar);
        container.innerHTML = '';
      }
    };

    // initial paint
    titleInput.value = state.doc.title;
    renderLeft(); renderProps(); updateUndo();
    setDevice('desktop');
    // iframe must be attached before writing
    setTimeout(function () { renderCanvas(); checkAutosave(); }, 0);
    return api;
  }

  return { create: create, processImage: processImage, injectCss: injectCss, VERSION: NLCore.VERSION };
});
