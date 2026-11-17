/*!
 * Newsletter Builder - core
 * Data model, section registry, Outlook-safe HTML renderer, .eml and Graph mail packaging.
 * Shared by the standalone tool and the SPFx web part. No dependencies.
 * Source of truth: NewsletterBuilder/standalone/js/nl-core.js (copied into spfx/src/core by scripts/sync-core.js)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.NLCore = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var SCHEMA_VERSION = 1;

  /* ------------------------------------------------------------------ utils */

  function uid(prefix) {
    return (prefix || 's') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nl2br(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^(https?:|mailto:|tel:|cid:|#|\/)/i.test(u)) return u;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u; // bare domain
    return '';
  }
  function clampInt(v, min, max, dflt) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return dflt;
    return Math.max(min, Math.min(max, n));
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function slugify(s) {
    return String(s || 'newsletter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'newsletter';
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /** Format an ISO date (YYYY-MM-DD). Free text is returned untouched. */
  function fmtDate(v, fmt) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    if (!m) return String(v || '');
    var y = +m[1], mo = +m[2], d = +m[3];
    var MMMM = MONTHS[mo - 1] || '', MMM = MMMM.slice(0, 3);
    var dd = (d < 10 ? '0' : '') + d, mm = (mo < 10 ? '0' : '') + mo;
    switch (fmt) {
      case 'DD/MM/YYYY': return dd + '/' + mm + '/' + y;
      case 'MM/DD/YYYY': return mm + '/' + dd + '/' + y;
      case 'YYYY-MM-DD': return y + '-' + mm + '-' + dd;
      case 'D MMMM YYYY': return d + ' ' + MMMM + ' ' + y;
      case 'MMMM D, YYYY': return MMMM + ' ' + d + ', ' + y;
      case 'D MMMM': return d + ' ' + MMMM;
      default: return d + ' ' + MMM + ' ' + y; // 'D MMM YYYY'
    }
  }

  /** Whitelist sanitiser for rich text. Uses the DOM when available, else strips tags. */
  var ALLOWED_TAGS = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, P: 1, UL: 1, OL: 1, LI: 1, A: 1, SPAN: 1 };
  function sanitizeRich(html) {
    html = String(html || '');
    if (typeof document === 'undefined' || !document.createElement) {
      return esc(html.replace(/<[^>]*>/g, ' '));
    }
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    function walk(node, out) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var c = node.childNodes[i];
        if (c.nodeType === 3) { out.push(esc(c.nodeValue)); continue; }
        if (c.nodeType !== 1) continue;
        var tag = c.tagName.toUpperCase();
        if (tag === 'DIV') tag = 'P';
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        if (!ALLOWED_TAGS[tag]) { walk(c, out); continue; }
        var t = tag.toLowerCase();
        if (t === 'br') { out.push('<br>'); continue; }
        if (t === 'a') {
          var href = safeUrl(c.getAttribute('href'));
          out.push(href ? '<a href="' + esc(href) + '">' : '<span>');
          walk(c, out);
          out.push(href ? '</a>' : '</span>');
          continue;
        }
        if (t === 'span') {
          // keep only bold/italic/underline hints coming from execCommand
          var st = (c.getAttribute('style') || '').toLowerCase();
          var open = '', close = '';
          if (/font-weight:\s*(bold|[6-9]00)/.test(st)) { open += '<b>'; close = '</b>' + close; }
          if (/font-style:\s*italic/.test(st)) { open += '<i>'; close = '</i>' + close; }
          if (/text-decoration[^;]*underline/.test(st)) { open += '<u>'; close = '</u>' + close; }
          out.push(open); walk(c, out); out.push(close);
          continue;
        }
        out.push('<' + t + '>'); walk(c, out); out.push('</' + t + '>');
      }
    }
    var out = [];
    walk(tpl.content, out);
    return out.join('');
  }

  /** Apply inline email styles to sanitised rich text. */
  function styleRich(html, th, opts) {
    opts = opts || {};
    var color = opts.color || th.text;
    var size = opts.size || 15;
    var align = opts.align || 'left';
    var pStyle = 'margin:0 0 12px 0;font-family:' + th.font + ';font-size:' + size + 'px;line-height:1.55;color:' + color + ';text-align:' + align + ';';
    var listStyle = 'margin:0 0 12px 0;padding:0 0 0 22px;font-family:' + th.font + ';font-size:' + size + 'px;line-height:1.55;color:' + color + ';';
    var s = sanitizeRich(html);
    if (!/^\s*<(p|ul|ol)>/.test(s)) s = '<p>' + s + '</p>';
    return s
      .replace(/<p>/g, '<p style="' + pStyle + '">')
      .replace(/<ul>/g, '<ul style="' + listStyle + '">')
      .replace(/<ol>/g, '<ol style="' + listStyle + '">')
      .replace(/<li>/g, '<li style="margin:0 0 4px 0;">')
      .replace(/<a href=/g, '<a style="color:' + th.link + ';text-decoration:underline;" href=')
      .replace(/<p style="[^"]*">\s*<\/p>/g, '');
  }

  /* ----------------------------------------------------------------- themes */

  var DEFAULT_THEME = {
    preset: 'corporate',
    pageBg: '#eef1f6',
    contentBg: '#ffffff',
    primary: '#1f4e79',
    accent: '#f2a900',
    text: '#333a45',
    muted: '#6b7280',
    heading: '#1f4e79',
    link: '#1a73c8',
    cardBg: '#f5f8fc',
    font: "'Segoe UI', Arial, Helvetica, sans-serif",
    headingFont: "'Segoe UI', Arial, Helvetica, sans-serif",
    width: 640,
    radius: 6,
    dateFormat: 'D MMM YYYY'
  };

  var THEME_PRESETS = {
    corporate: { label: 'Corporate blue', primary: '#1f4e79', accent: '#f2a900', heading: '#1f4e79', link: '#1a73c8', pageBg: '#eef1f6', cardBg: '#f5f8fc' },
    teal: { label: 'Teal', primary: '#0f766e', accent: '#f59e0b', heading: '#0f766e', link: '#0d9488', pageBg: '#ecf5f4', cardBg: '#f0faf8' },
    purple: { label: 'Purple', primary: '#5b21b6', accent: '#ec4899', heading: '#5b21b6', link: '#7c3aed', pageBg: '#f2effa', cardBg: '#f7f4fd' },
    crimson: { label: 'Crimson', primary: '#9f1239', accent: '#0ea5e9', heading: '#9f1239', link: '#be123c', pageBg: '#f8eff1', cardBg: '#fdf4f6' },
    forest: { label: 'Forest', primary: '#166534', accent: '#eab308', heading: '#166534', link: '#15803d', pageBg: '#eef4ef', cardBg: '#f3f9f4' },
    slate: { label: 'Slate', primary: '#1e293b', accent: '#38bdf8', heading: '#0f172a', link: '#0369a1', pageBg: '#e9edf2', cardBg: '#f4f6f9' }
  };

  var FONTS = [
    { label: 'Segoe UI', value: "'Segoe UI', Arial, Helvetica, sans-serif" },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Calibri', value: 'Calibri, Arial, Helvetica, sans-serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
    { label: 'Trebuchet MS', value: "'Trebuchet MS', Arial, sans-serif" },
    { label: 'Georgia (serif)', value: 'Georgia, Times, serif' },
    { label: 'Times New Roman (serif)', value: "'Times New Roman', Times, serif" }
  ];

  var DATE_FORMATS = ['D MMM YYYY', 'D MMMM YYYY', 'MMMM D, YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

  /* -------------------------------------------------------- shared helpers */

  function sectionStyleFields() {
    return [
      { k: 'style.bg', label: 'Background colour', type: 'color', allowEmpty: true },
      { k: 'style.pt', label: 'Padding top (px)', type: 'number', min: 0, max: 120 },
      { k: 'style.pb', label: 'Padding bottom (px)', type: 'number', min: 0, max: 120 },
      { k: 'style.px', label: 'Padding sides (px)', type: 'number', min: 0, max: 80 }
    ];
  }
  var ALIGN = [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }];

  function btnHtml(label, href, th, o) {
    o = o || {};
    href = safeUrl(href) || '#';
    var bg = o.bg || th.primary, color = o.color || '#ffffff', r = o.radius == null ? th.radius : o.radius;
    var align = o.align || 'left';
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="' + align + '" style="margin:' + (align === 'center' ? '0 auto' : '0') + ';">' +
      '<tr><td bgcolor="' + esc(bg) + '" style="background:' + esc(bg) + ';border-radius:' + r + 'px;mso-padding-alt:12px 26px;">' +
      '<a href="' + esc(href) + '" target="_blank" style="display:inline-block;padding:12px 26px;font-family:' + th.font + ';font-size:15px;font-weight:bold;color:' + esc(color) + ';text-decoration:none;border-radius:' + r + 'px;">' +
      esc(label || 'Read more') + '</a></td></tr></table>';
  }

  function headingHtml(text, th, o) {
    o = o || {};
    var sizes = { 1: 28, 2: 22, 3: 18 };
    var size = sizes[o.level || 2] || 22;
    return '<h' + (o.level || 2) + ' style="margin:0 0 ' + (o.mb == null ? 10 : o.mb) + 'px 0;font-family:' + th.headingFont + ';font-size:' + size + 'px;line-height:1.25;font-weight:bold;color:' + esc(o.color || th.heading) + ';text-align:' + (o.align || 'left') + ';mso-line-height-rule:exactly;">' +
      esc(text) + '</h' + (o.level || 2) + '>';
  }

  function imgHtml(src, alt, width, o) {
    o = o || {};
    src = safeUrl(src);
    if (!src) return '';
    var w = Math.round(width);
    var img = '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" width="' + w + '" class="' + (o.full ? 'nl-img-full' : '') + '" style="display:block;width:' + w + 'px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;' + (o.radius ? 'border-radius:' + o.radius + 'px;' : '') + (o.center ? 'margin:0 auto;' : '') + '">';
    var href = safeUrl(o.href);
    return href ? '<a href="' + esc(href) + '" target="_blank" style="text-decoration:none;">' + img + '</a>' : img;
  }

  /** Round photo with initials fallback (Outlook desktop shows square corners - acceptable). */
  function avatarHtml(name, photo, size, th, shape) {
    var radius = shape === 'square' ? th.radius : Math.round(size / 2);
    var src = safeUrl(photo);
    if (src) {
      return '<img src="' + esc(src) + '" alt="' + esc(name || '') + '" width="' + size + '" height="' + size + '" style="display:block;margin:0 auto;width:' + size + 'px;height:' + size + 'px;border-radius:' + radius + 'px;border:0;object-fit:cover;">';
    }
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>' +
      '<td width="' + size + '" height="' + size + '" align="center" valign="middle" bgcolor="' + th.primary + '" style="width:' + size + 'px;height:' + size + 'px;background:' + th.primary + ';border-radius:' + radius + 'px;font-family:' + th.font + ';font-size:' + Math.round(size * 0.36) + 'px;font-weight:bold;color:#ffffff;text-align:center;">' +
      esc(initials(name)) + '</td></tr></table>';
  }

  /** Lay out N cards per row in an Outlook-safe table grid; stacks on mobile. */
  function gridHtml(cards, perRow, gap) {
    perRow = clampInt(perRow, 1, 4, 2);
    gap = gap == null ? 8 : gap;
    if (!cards.length) return '';
    var w = Math.floor(100 / perRow);
    var rows = [];
    for (var i = 0; i < cards.length; i += perRow) {
      var cells = [];
      for (var j = 0; j < perRow; j++) {
        var c = cards[i + j];
        cells.push('<td class="nl-col" width="' + w + '%" valign="top" style="width:' + w + '%;padding:' + gap + 'px;vertical-align:top;">' + (c || '&nbsp;') + '</td>');
      }
      rows.push('<tr>' + cells.join('') + '</tr>');
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">' + rows.join('') + '</table>';
  }

  function personCardHtml(p, th, sec, lines) {
    var shape = sec.photoShape || 'circle';
    var size = clampInt(sec.photoSize, 48, 160, 96);
    var bg = sec.cardBg || th.cardBg;
    var align = sec.cardAlign || 'center';
    var parts = [];
    parts.push('<tr><td align="' + align + '" style="padding:0 0 10px 0;">' + avatarHtml(p.name, p.photo, size, th, shape).replace('margin:0 auto', align === 'center' ? 'margin:0 auto' : 'margin:0') + '</td></tr>');
    if (p.badge) parts.push('<tr><td align="' + align + '" style="padding:0 0 6px 0;font-family:' + th.font + ';font-size:12px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:' + esc(sec.accent || th.accent) + ';">' + esc(p.badge) + '</td></tr>');
    parts.push('<tr><td align="' + align + '" style="padding:0 0 4px 0;font-family:' + th.headingFont + ';font-size:17px;font-weight:bold;line-height:1.3;color:' + th.heading + ';">' + esc(p.name || 'Name') + '</td></tr>');
    lines.forEach(function (l) {
      if (l.value == null || String(l.value).trim() === '') return;
      var st = 'padding:0 0 3px 0;font-family:' + th.font + ';font-size:14px;line-height:1.45;color:' + (l.strong ? th.text : th.muted) + ';' + (l.strong ? 'font-weight:bold;' : '');
      var content = l.label ? '<span style="color:' + th.muted + ';">' + esc(l.label) + ':</span> <span style="color:' + th.text + ';">' + esc(l.value) + '</span>' : esc(l.value);
      parts.push('<tr><td align="' + align + '" style="' + st + '">' + content + '</td></tr>');
    });
    if (p.message) parts.push('<tr><td align="' + align + '" style="padding:8px 0 0 0;font-family:' + th.font + ';font-size:14px;line-height:1.5;font-style:italic;color:' + th.text + ';">' + nl2br(p.message) + '</td></tr>');
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + esc(bg) + '" style="width:100%;background:' + esc(bg) + ';border-radius:' + th.radius + 'px;' + (sec.cardBorder ? 'border-top:4px solid ' + esc(sec.accent || th.accent) + ';' : '') + '">' +
      '<tr><td style="padding:18px 16px;text-align:' + align + ';"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + parts.join('') + '</table></td></tr></table>';
  }

  function peopleIntroHtml(sec, th) {
    var h = '';
    if (sec.title) h += headingHtml(sec.title, th, { level: 2, align: sec.titleAlign || 'center', mb: sec.intro ? 8 : 16 });
    if (sec.intro) h += '<div style="padding:0 0 8px 0;">' + styleRich(sec.intro, th, { align: sec.titleAlign || 'center' }) + '</div>';
    return h;
  }

  function peopleFields(extraItemFields, labelsFields, itemKey, itemLabel) {
    return [
      { k: 'title', label: 'Section title', type: 'text' },
      { k: 'intro', label: 'Intro text', type: 'richtext' },
      { k: 'titleAlign', label: 'Title alignment', type: 'select', options: ALIGN },
      { k: 'perRow', label: 'Cards per row', type: 'select', options: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }] },
      { k: 'photoShape', label: 'Photo shape', type: 'select', options: [{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Rounded square' }] },
      { k: 'photoSize', label: 'Photo size (px)', type: 'number', min: 48, max: 160 },
      { k: 'cardAlign', label: 'Card text alignment', type: 'select', options: ALIGN },
      { k: 'cardBg', label: 'Card background', type: 'color', allowEmpty: true },
      { k: 'cardBorder', label: 'Accent bar on cards', type: 'checkbox' },
      { k: 'accent', label: 'Accent colour', type: 'color', allowEmpty: true },
      { k: 'labels', label: 'Field labels', type: 'group', fields: labelsFields },
      { k: itemKey, label: itemLabel, type: 'list', itemLabel: 'name', fields: [{ k: 'name', label: 'Name', type: 'text' }, { k: 'photo', label: 'Photo', type: 'image', photo: true }].concat(extraItemFields) }
    ];
  }

  /* ------------------------------------------------------- section registry */

  var SECTIONS = {};

  SECTIONS.header = {
    label: 'Header / banner', group: 'Basic', icon: '▀',
    defaults: function () {
      return { logo: '', logoWidth: 140, title: 'Team Newsletter', subtitle: 'News, people and updates', dateText: '', align: 'center', textColor: '#ffffff', bgImage: '', style: { bg: '', pt: 36, pb: 36, px: 32 } };
    },
    fields: [
      { k: 'logo', label: 'Logo', type: 'image', maxW: 600 },
      { k: 'logoWidth', label: 'Logo width (px)', type: 'number', min: 40, max: 500 },
      { k: 'title', label: 'Title', type: 'text' },
      { k: 'subtitle', label: 'Subtitle', type: 'text' },
      { k: 'dateText', label: 'Edition / date text', type: 'text', placeholder: 'e.g. November 2026 | Issue 12' },
      { k: 'align', label: 'Alignment', type: 'select', options: ALIGN },
      { k: 'textColor', label: 'Text colour', type: 'color' },
      { k: 'bgImage', label: 'Banner image (shown below title)', type: 'image', maxW: 1280 }
    ],
    defaultBg: function (th) { return th.primary; },
    render: function (s, th, ctx) {
      var h = '';
      var align = s.align || 'center';
      if (s.logo) h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="' + align + '" style="padding:0 0 16px 0;">' + imgHtml(s.logo, 'Logo', clampInt(s.logoWidth, 40, 500, 140), { center: align === 'center' }) + '</td></tr></table>';
      if (s.dateText) h += '<p style="margin:0 0 8px 0;font-family:' + th.font + ';font-size:12px;letter-spacing:1px;text-transform:uppercase;color:' + esc(s.textColor) + ';opacity:0.85;text-align:' + align + ';">' + esc(s.dateText) + '</p>';
      if (s.title) h += '<h1 style="margin:0;font-family:' + th.headingFont + ';font-size:32px;line-height:1.2;font-weight:bold;color:' + esc(s.textColor) + ';text-align:' + align + ';">' + esc(s.title) + '</h1>';
      if (s.subtitle) h += '<p style="margin:8px 0 0 0;font-family:' + th.font + ';font-size:16px;line-height:1.4;color:' + esc(s.textColor) + ';text-align:' + align + ';">' + esc(s.subtitle) + '</p>';
      if (s.bgImage) h += '<div style="padding:20px 0 0 0;">' + imgHtml(s.bgImage, s.title || '', ctx.innerWidth, { full: true, radius: th.radius }) + '</div>';
      return h;
    }
  };

  SECTIONS.heading = {
    label: 'Heading', group: 'Basic', icon: 'H',
    defaults: function () { return { text: 'Section heading', level: 2, align: 'left', color: '', style: { bg: '', pt: 20, pb: 4, px: 32 } }; },
    fields: [
      { k: 'text', label: 'Text', type: 'text' },
      { k: 'level', label: 'Size', type: 'select', options: [{ value: 1, label: 'Large' }, { value: 2, label: 'Medium' }, { value: 3, label: 'Small' }] },
      { k: 'align', label: 'Alignment', type: 'select', options: ALIGN },
      { k: 'color', label: 'Colour', type: 'color', allowEmpty: true }
    ],
    render: function (s, th) { return headingHtml(s.text, th, { level: +s.level || 2, align: s.align, color: s.color, mb: 0 }); }
  };

  SECTIONS.text = {
    label: 'Text', group: 'Basic', icon: '¶',
    defaults: function () { return { html: '<p>Write your message here. You can use <b>bold</b>, <i>italic</i>, lists and <a href="https://example.com">links</a>.</p>', align: 'left', size: 15, style: { bg: '', pt: 8, pb: 8, px: 32 } }; },
    fields: [
      { k: 'html', label: 'Text', type: 'richtext' },
      { k: 'align', label: 'Alignment', type: 'select', options: ALIGN },
      { k: 'size', label: 'Font size (px)', type: 'number', min: 11, max: 24 }
    ],
    render: function (s, th) { return styleRich(s.html, th, { align: s.align, size: clampInt(s.size, 11, 24, 15) }); }
  };

  SECTIONS.image = {
    label: 'Image', group: 'Basic', icon: '▣',
    defaults: function () { return { src: '', alt: '', href: '', widthPct: 100, align: 'center', caption: '', rounded: true, style: { bg: '', pt: 12, pb: 12, px: 32 } }; },
    fields: [
      { k: 'src', label: 'Image', type: 'image', maxW: 1280 },
      { k: 'alt', label: 'Alt text', type: 'text' },
      { k: 'href', label: 'Link (optional)', type: 'url' },
      { k: 'widthPct', label: 'Width (%)', type: 'number', min: 10, max: 100 },
      { k: 'align', label: 'Alignment', type: 'select', options: ALIGN },
      { k: 'rounded', label: 'Rounded corners', type: 'checkbox' },
      { k: 'caption', label: 'Caption', type: 'text' }
    ],
    render: function (s, th, ctx) {
      if (!s.src) return ctx.editor ? '<div style="padding:40px;border:2px dashed #c3cad5;text-align:center;font-family:Arial;color:#8a94a6;">Image - upload or paste a URL in the properties panel</div>' : '';
      var pct = clampInt(s.widthPct, 10, 100, 100);
      var w = Math.round(ctx.innerWidth * pct / 100);
      var h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="' + (s.align || 'center') + '">' +
        imgHtml(s.src, s.alt, w, { full: pct === 100, href: s.href, radius: s.rounded ? th.radius : 0, center: s.align === 'center' }) + '</td></tr>';
      if (s.caption) h += '<tr><td align="' + (s.align || 'center') + '" style="padding:8px 0 0 0;font-family:' + th.font + ';font-size:13px;color:' + th.muted + ';">' + esc(s.caption) + '</td></tr>';
      return h + '</table>';
    }
  };

  SECTIONS.button = {
    label: 'Button', group: 'Basic', icon: '⬭',
    defaults: function () { return { label: 'Read more', href: 'https://', align: 'center', bg: '', color: '#ffffff', style: { bg: '', pt: 12, pb: 16, px: 32 } }; },
    fields: [
      { k: 'label', label: 'Label', type: 'text' },
      { k: 'href', label: 'Link', type: 'url' },
      { k: 'align', label: 'Alignment', type: 'select', options: ALIGN },
      { k: 'bg', label: 'Button colour', type: 'color', allowEmpty: true },
      { k: 'color', label: 'Text colour', type: 'color' }
    ],
    render: function (s, th) {
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="' + (s.align || 'center') + '">' + btnHtml(s.label, s.href, th, { bg: s.bg, color: s.color, align: s.align }) + '</td></tr></table>';
    }
  };

  SECTIONS.imageText = {
    label: 'Image + text', group: 'Layout', icon: '◧',
    defaults: function () {
      return { src: '', alt: '', imagePosition: 'left', imageWidthPct: 40, heading: 'Story headline', html: '<p>A short summary of the story goes here.</p>', buttonLabel: '', buttonHref: '', valign: 'middle', style: { bg: '', pt: 16, pb: 16, px: 32 } };
    },
    fields: [
      { k: 'src', label: 'Image', type: 'image', maxW: 800 },
      { k: 'alt', label: 'Alt text', type: 'text' },
      { k: 'imagePosition', label: 'Image position', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
      { k: 'imageWidthPct', label: 'Image column width (%)', type: 'number', min: 20, max: 60 },
      { k: 'valign', label: 'Vertical alignment', type: 'select', options: [{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }] },
      { k: 'heading', label: 'Heading', type: 'text' },
      { k: 'html', label: 'Text', type: 'richtext' },
      { k: 'buttonLabel', label: 'Button label (optional)', type: 'text' },
      { k: 'buttonHref', label: 'Button link', type: 'url' }
    ],
    render: function (s, th, ctx) {
      if (!s.src && !ctx.editor) {
        var only = '';
        if (s.heading) only += headingHtml(s.heading, th, { level: 3, mb: 8 });
        if (s.html) only += styleRich(s.html, th, {});
        if (s.buttonLabel) only += btnHtml(s.buttonLabel, s.buttonHref, th, {});
        return only;
      }
      var pct = clampInt(s.imageWidthPct, 20, 60, 40);
      var imgW = Math.round((ctx.innerWidth - 20) * pct / 100);
      var imgCell = '<td class="nl-col" width="' + pct + '%" valign="' + (s.valign || 'middle') + '" style="width:' + pct + '%;padding:0;vertical-align:' + (s.valign || 'middle') + ';">' +
        (s.src ? imgHtml(s.src, s.alt, imgW, { radius: th.radius, full: true }) : (ctx.editor ? '<div style="height:120px;border:2px dashed #c3cad5;"></div>' : '')) + '</td>';
      var gap = '<td class="nl-col nl-gap" width="20" style="width:20px;font-size:0;line-height:0;">&nbsp;</td>';
      var txt = '';
      if (s.heading) txt += headingHtml(s.heading, th, { level: 3, mb: 8 });
      if (s.html) txt += styleRich(s.html, th, {});
      if (s.buttonLabel) txt += btnHtml(s.buttonLabel, s.buttonHref, th, {});
      var txtCell = '<td class="nl-col" valign="' + (s.valign || 'middle') + '" style="vertical-align:' + (s.valign || 'middle') + ';">' + txt + '</td>';
      var cells = s.imagePosition === 'right' ? txtCell + gap + imgCell : imgCell + gap + txtCell;
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>' + cells + '</tr></table>';
    }
  };

  SECTIONS.columns = {
    label: 'Columns (2-3)', group: 'Layout', icon: '▥',
    defaults: function () {
      return {
        count: 2, cardStyle: true, align: 'left',
        cols: [
          { src: '', heading: 'Column one', html: '<p>Short text for the first column.</p>', buttonLabel: 'Read more', buttonHref: 'https://' },
          { src: '', heading: 'Column two', html: '<p>Short text for the second column.</p>', buttonLabel: 'Read more', buttonHref: 'https://' },
          { src: '', heading: 'Column three', html: '<p>Short text for the third column.</p>', buttonLabel: '', buttonHref: '' }
        ],
        style: { bg: '', pt: 12, pb: 12, px: 24 }
      };
    },
    fields: [
      { k: 'count', label: 'Number of columns', type: 'select', options: [{ value: 2, label: '2' }, { value: 3, label: '3' }] },
      { k: 'cardStyle', label: 'Show as cards', type: 'checkbox' },
      { k: 'align', label: 'Text alignment', type: 'select', options: ALIGN },
      { k: 'cols', label: 'Columns', type: 'list', fixed: true, itemLabel: 'heading', fields: [
        { k: 'src', label: 'Image', type: 'image', maxW: 640 },
        { k: 'href', label: 'Image link', type: 'url' },
        { k: 'heading', label: 'Heading', type: 'text' },
        { k: 'html', label: 'Text', type: 'richtext' },
        { k: 'buttonLabel', label: 'Button label', type: 'text' },
        { k: 'buttonHref', label: 'Button link', type: 'url' }
      ] }
    ],
    render: function (s, th, ctx) {
      var n = clampInt(s.count, 2, 3, 2);
      var colW = Math.floor((ctx.innerWidth - n * 16) / n);
      var cards = (s.cols || []).slice(0, n).map(function (c) {
        var inner = '';
        if (c.src) inner += '<div style="padding:0 0 12px 0;">' + imgHtml(c.src, c.heading, s.cardStyle ? colW - 32 : colW, { full: true, radius: th.radius, href: c.href }) + '</div>';
        if (c.heading) inner += headingHtml(c.heading, th, { level: 3, mb: 6, align: s.align });
        if (c.html) inner += styleRich(c.html, th, { size: 14, align: s.align });
        if (c.buttonLabel) inner += btnHtml(c.buttonLabel, c.buttonHref, th, { align: s.align === 'center' ? 'center' : 'left' });
        if (!s.cardStyle) return inner;
        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + th.cardBg + '" style="width:100%;background:' + th.cardBg + ';border-radius:' + th.radius + 'px;"><tr><td style="padding:16px;">' + inner + '</td></tr></table>';
      });
      return gridHtml(cards, n, 8);
    }
  };

  SECTIONS.linkList = {
    label: 'Links list', group: 'Layout', icon: '☰',
    defaults: function () {
      return { title: 'Useful links', links: [{ label: 'Intranet home', href: 'https://', description: 'News and resources' }, { label: 'HR portal', href: 'https://', description: '' }], style: { bg: '', pt: 16, pb: 16, px: 32 } };
    },
    fields: [
      { k: 'title', label: 'Title', type: 'text' },
      { k: 'links', label: 'Links', type: 'list', itemLabel: 'label', fields: [
        { k: 'label', label: 'Label', type: 'text' }, { k: 'href', label: 'URL', type: 'url' }, { k: 'description', label: 'Description', type: 'text' }
      ] }
    ],
    render: function (s, th) {
      var h = s.title ? headingHtml(s.title, th, { level: 3, mb: 10 }) : '';
      h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">';
      (s.links || []).forEach(function (l) {
        var href = safeUrl(l.href) || '#';
        h += '<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-family:' + th.font + ';font-size:15px;line-height:1.4;">' +
          '<span style="color:' + th.accent + ';font-weight:bold;">&#8250;</span>&nbsp; <a href="' + esc(href) + '" target="_blank" style="color:' + th.link + ';font-weight:bold;text-decoration:none;">' + esc(l.label || href) + '</a>' +
          (l.description ? '<span style="color:' + th.muted + ';font-size:13px;"> &mdash; ' + esc(l.description) + '</span>' : '') + '</td></tr>';
      });
      return h + '</table>';
    }
  };

  SECTIONS.divider = {
    label: 'Divider', group: 'Layout', icon: '—',
    defaults: function () { return { color: '#dde3ea', thickness: 1, widthPct: 100, style: { bg: '', pt: 12, pb: 12, px: 32 } }; },
    fields: [
      { k: 'color', label: 'Colour', type: 'color' },
      { k: 'thickness', label: 'Thickness (px)', type: 'number', min: 1, max: 8 },
      { k: 'widthPct', label: 'Width (%)', type: 'number', min: 10, max: 100 }
    ],
    render: function (s) {
      var t = clampInt(s.thickness, 1, 8, 1), w = clampInt(s.widthPct, 10, 100, 100);
      return '<table role="presentation" width="' + w + '%" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td height="' + t + '" bgcolor="' + esc(s.color) + '" style="height:' + t + 'px;line-height:' + t + 'px;font-size:0;background:' + esc(s.color) + ';">&nbsp;</td></tr></table>';
    }
  };

  SECTIONS.spacer = {
    label: 'Spacer', group: 'Layout', icon: '↕',
    defaults: function () { return { height: 24, style: { bg: '', pt: 0, pb: 0, px: 0 } }; },
    fields: [{ k: 'height', label: 'Height (px)', type: 'number', min: 4, max: 160 }],
    render: function (s) { var h = clampInt(s.height, 4, 160, 24); return '<div style="height:' + h + 'px;line-height:' + h + 'px;font-size:0;">&nbsp;</div>'; }
  };

  /* --- the four people layouts --- */

  SECTIONS.newJoiners = {
    label: 'New joiners', group: 'People', icon: '👋',
    defaults: function () {
      return {
        title: 'Welcome to our new joiners', intro: '<p>Please join us in welcoming the newest members of the team.</p>', titleAlign: 'center',
        perRow: 2, photoShape: 'circle', photoSize: 96, cardAlign: 'center', cardBg: '', cardBorder: true, accent: '',
        labels: { role: '', team: 'Team', buddy: 'Buddy', joiningDate: 'Joined' },
        people: [
          { id: uid('p'), name: 'Jane Doe', photo: '', role: 'Business Analyst', team: 'Digital Transformation', buddy: 'John Smith', joiningDate: '', message: '' },
          { id: uid('p'), name: 'Ali Khan', photo: '', role: 'Software Engineer', team: 'Platform', buddy: 'Sara Lee', joiningDate: '', message: '' }
        ],
        style: { bg: '', pt: 24, pb: 16, px: 24 }
      };
    },
    fields: peopleFields([
      { k: 'role', label: 'Job title', type: 'text' },
      { k: 'team', label: 'Team', type: 'text' },
      { k: 'buddy', label: 'Buddy name', type: 'text' },
      { k: 'joiningDate', label: 'Joining date', type: 'date' },
      { k: 'message', label: 'Short bio / message', type: 'textarea' }
    ], [
      { k: 'role', label: 'Job title label (blank = none)', type: 'text' },
      { k: 'team', label: 'Team label', type: 'text' },
      { k: 'buddy', label: 'Buddy label', type: 'text' },
      { k: 'joiningDate', label: 'Joining date label', type: 'text' }
    ], 'people', 'New joiners'),
    render: function (s, th) {
      var L = s.labels || {};
      var cards = (s.people || []).map(function (p) {
        return personCardHtml(p, th, s, [
          { label: L.role, value: p.role, strong: !L.role },
          { label: L.team, value: p.team },
          { label: L.buddy, value: p.buddy },
          { label: L.joiningDate, value: fmtDate(p.joiningDate, th.dateFormat) }
        ]);
      });
      return peopleIntroHtml(s, th) + gridHtml(cards, s.perRow, 8);
    }
  };

  var CELEBRATION_KINDS = [
    { value: 'birthday', label: 'Birthday', badge: '🎂 Happy Birthday' },
    { value: 'wedding', label: 'Wedding', badge: '💍 Just Married' },
    { value: 'engagement', label: 'Engagement', badge: '💞 Engaged' },
    { value: 'baby', label: 'New baby', badge: '🍼 New Arrival' },
    { value: 'anniversary', label: 'Work anniversary', badge: '🎉 Work Anniversary' },
    { value: 'other', label: 'Other (custom badge)', badge: '🎉 Congratulations' }
  ];

  SECTIONS.celebrations = {
    label: 'Birthdays & weddings', group: 'People', icon: '🎉',
    defaults: function () {
      return {
        title: 'Celebrations', intro: '<p>Wishing our colleagues all the very best!</p>', titleAlign: 'center',
        perRow: 3, photoShape: 'circle', photoSize: 88, cardAlign: 'center', cardBg: '', cardBorder: true, accent: '',
        showBadge: true, birthdayHideYear: true,
        labels: { date: '', team: '' },
        items: [
          { id: uid('p'), name: 'Maria Garcia', photo: '', kind: 'birthday', customBadge: '', team: 'Finance', date: '', message: '' },
          { id: uid('p'), name: 'Tom & Emma', photo: '', kind: 'wedding', customBadge: '', team: 'Sales', date: '', message: 'Congratulations on your wedding!' }
        ],
        style: { bg: '', pt: 24, pb: 16, px: 24 }
      };
    },
    fields: (function () {
      var f = peopleFields([
        { k: 'kind', label: 'Occasion', type: 'select', options: CELEBRATION_KINDS.map(function (k) { return { value: k.value, label: k.label }; }) },
        { k: 'customBadge', label: 'Custom badge text (optional)', type: 'text' },
        { k: 'team', label: 'Team', type: 'text' },
        { k: 'date', label: 'Date', type: 'date' },
        { k: 'message', label: 'Message', type: 'textarea' }
      ], [
        { k: 'team', label: 'Team label (blank = none)', type: 'text' },
        { k: 'date', label: 'Date label (blank = none)', type: 'text' }
      ], 'items', 'Announcements');
      f.splice(10, 0, { k: 'showBadge', label: 'Show occasion badge', type: 'checkbox' }, { k: 'birthdayHideYear', label: 'Hide year on birthdays', type: 'checkbox' });
      return f;
    })(),
    render: function (s, th) {
      var L = s.labels || {};
      var cards = (s.items || []).map(function (p) {
        var kind = CELEBRATION_KINDS.filter(function (k) { return k.value === p.kind; })[0] || CELEBRATION_KINDS[5];
        var q = clone(p);
        q.badge = s.showBadge === false ? '' : (p.customBadge || kind.badge);
        var df = (p.kind === 'birthday' && s.birthdayHideYear !== false) ? 'D MMMM' : th.dateFormat;
        return personCardHtml(q, th, s, [
          { label: L.team, value: p.team },
          { label: L.date, value: fmtDate(p.date, df) }
        ]);
      });
      return peopleIntroHtml(s, th) + gridHtml(cards, s.perRow, 8);
    }
  };

  SECTIONS.promotions = {
    label: 'Promotions', group: 'People', icon: '🏆',
    defaults: function () {
      return {
        title: 'Congratulations on your promotion', intro: '<p>Recognising colleagues who have stepped up into new roles.</p>', titleAlign: 'center',
        perRow: 2, photoShape: 'circle', photoSize: 96, cardAlign: 'center', cardBg: '', cardBorder: true, accent: '',
        showArrow: true,
        labels: { previousRole: 'From', newRole: 'To', team: 'Team', effectiveDate: 'Effective' },
        people: [
          { id: uid('p'), name: 'Priya Patel', photo: '', previousRole: 'Senior Consultant', newRole: 'Manager', team: 'Advisory', effectiveDate: '', message: '' }
        ],
        style: { bg: '', pt: 24, pb: 16, px: 24 }
      };
    },
    fields: peopleFields([
      { k: 'previousRole', label: 'Previous role', type: 'text' },
      { k: 'newRole', label: 'New role', type: 'text' },
      { k: 'team', label: 'Team', type: 'text' },
      { k: 'effectiveDate', label: 'Effective date', type: 'date' },
      { k: 'message', label: 'Message', type: 'textarea' }
    ], [
      { k: 'previousRole', label: 'Previous role label', type: 'text' },
      { k: 'newRole', label: 'New role label', type: 'text' },
      { k: 'team', label: 'Team label', type: 'text' },
      { k: 'effectiveDate', label: 'Effective date label', type: 'text' }
    ], 'people', 'Promoted colleagues'),
    render: function (s, th) {
      var L = s.labels || {};
      var cards = (s.people || []).map(function (p) {
        var q = clone(p);
        q.badge = p.newRole ? '★ ' + p.newRole : '';
        return personCardHtml(q, th, s, [
          { label: L.previousRole, value: p.previousRole },
          { label: L.newRole, value: p.newRole },
          { label: L.team, value: p.team },
          { label: L.effectiveDate, value: fmtDate(p.effectiveDate, th.dateFormat) }
        ]);
      });
      return peopleIntroHtml(s, th) + gridHtml(cards, s.perRow, 8);
    }
  };

  SECTIONS.examPasses = {
    label: 'Exam passes', group: 'People', icon: '🎓',
    defaults: function () {
      return {
        title: 'Exam success', intro: '<p>Well done to everyone who passed their exams this month!</p>', titleAlign: 'center',
        perRow: 3, photoShape: 'circle', photoSize: 88, cardAlign: 'center', cardBg: '', cardBorder: true, accent: '',
        labels: { exam: '', body: 'Awarding body', result: 'Result', date: 'Passed', team: 'Team' },
        people: [
          { id: uid('p'), name: 'Chen Wei', photo: '', exam: 'ACCA Strategic Business Leader', body: 'ACCA', result: 'Pass', team: 'Audit', date: '', message: '' }
        ],
        style: { bg: '', pt: 24, pb: 16, px: 24 }
      };
    },
    fields: peopleFields([
      { k: 'exam', label: 'Exam / certification', type: 'text' },
      { k: 'body', label: 'Awarding body', type: 'text' },
      { k: 'result', label: 'Result / grade', type: 'text' },
      { k: 'team', label: 'Team', type: 'text' },
      { k: 'date', label: 'Date passed', type: 'date' },
      { k: 'message', label: 'Message', type: 'textarea' }
    ], [
      { k: 'exam', label: 'Exam label (blank = none)', type: 'text' },
      { k: 'body', label: 'Awarding body label', type: 'text' },
      { k: 'result', label: 'Result label', type: 'text' },
      { k: 'team', label: 'Team label', type: 'text' },
      { k: 'date', label: 'Date label', type: 'text' }
    ], 'people', 'Colleagues'),
    render: function (s, th) {
      var L = s.labels || {};
      var cards = (s.people || []).map(function (p) {
        var q = clone(p);
        q.badge = '🎓 Passed';
        return personCardHtml(q, th, s, [
          { label: L.exam, value: p.exam, strong: !L.exam },
          { label: L.body, value: p.body },
          { label: L.result, value: p.result },
          { label: L.team, value: p.team },
          { label: L.date, value: fmtDate(p.date, th.dateFormat) }
        ]);
      });
      return peopleIntroHtml(s, th) + gridHtml(cards, s.perRow, 8);
    }
  };

  SECTIONS.footer = {
    label: 'Footer', group: 'Basic', icon: '▁',
    defaults: function () {
      return { html: '<p>You are receiving this newsletter as a member of the organisation.<br>Questions or stories to share? Reply to this email.</p>', align: 'center', textColor: '#6b7280', links: [], style: { bg: '#f3f5f8', pt: 24, pb: 28, px: 32 } };
    },
    fields: [
      { k: 'html', label: 'Footer text', type: 'richtext' },
      { k: 'align', label: 'Alignment', type: 'select', options: ALIGN },
      { k: 'textColor', label: 'Text colour', type: 'color' },
      { k: 'links', label: 'Footer links', type: 'list', itemLabel: 'label', fields: [{ k: 'label', label: 'Label', type: 'text' }, { k: 'href', label: 'URL', type: 'url' }] }
    ],
    render: function (s, th) {
      var h = styleRich(s.html, th, { align: s.align, size: 12, color: s.textColor });
      var links = (s.links || []).filter(function (l) { return l.label; }).map(function (l) {
        return '<a href="' + esc(safeUrl(l.href) || '#') + '" target="_blank" style="color:' + th.link + ';text-decoration:underline;">' + esc(l.label) + '</a>';
      });
      if (links.length) h += '<p style="margin:0;font-family:' + th.font + ';font-size:12px;text-align:' + s.align + ';color:' + esc(s.textColor) + ';">' + links.join(' &nbsp;|&nbsp; ') + '</p>';
      return h;
    }
  };

  var GROUPS = ['People', 'Basic', 'Layout'];

  /* ------------------------------------------------------------ documents */

  function makeSection(type, overrides) {
    var def = SECTIONS[type];
    if (!def) throw new Error('Unknown section type: ' + type);
    var props = def.defaults();
    if (overrides) deepMerge(props, overrides);
    return { id: uid('s'), type: type, props: props };
  }
  function deepMerge(target, src) {
    Object.keys(src).forEach(function (k) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) deepMerge(target[k], src[k]);
      else target[k] = src[k];
    });
    return target;
  }

  function newDocument(templateId) {
    var tpl = TEMPLATES.filter(function (t) { return t.id === templateId; })[0] || TEMPLATES[0];
    var now = new Date().toISOString();
    var doc = {
      schemaVersion: SCHEMA_VERSION,
      appVersion: VERSION,
      id: uid('nl'),
      title: tpl.id === 'blank' ? 'Untitled newsletter' : tpl.label,
      subject: tpl.id === 'blank' ? '' : tpl.label,
      preheader: '',
      created: now,
      modified: now,
      theme: clone(DEFAULT_THEME),
      sections: tpl.build()
    };
    return doc;
  }

  /** Validate and upgrade a loaded document. Throws on garbage. */
  function normalizeDocument(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) throw new Error('This file is not a Newsletter Builder document.');
    var doc = clone(raw);
    doc.schemaVersion = doc.schemaVersion || 1;
    if (doc.schemaVersion > SCHEMA_VERSION) throw new Error('This newsletter was created with a newer version of the tool (schema ' + doc.schemaVersion + ').');
    doc.id = doc.id || uid('nl');
    doc.title = doc.title || 'Untitled newsletter';
    doc.subject = doc.subject || '';
    doc.preheader = doc.preheader || '';
    doc.theme = deepMerge(clone(DEFAULT_THEME), doc.theme || {});
    doc.sections = doc.sections.filter(function (s) { return s && SECTIONS[s.type]; }).map(function (s) {
      var props = deepMerge(SECTIONS[s.type].defaults(), s.props || {});
      // Lists with defaults should not be merged index-by-index with sample data
      ['people', 'items', 'links'].forEach(function (k) { if (s.props && Array.isArray(s.props[k])) props[k] = s.props[k]; });
      return { id: s.id || uid('s'), type: s.type, props: props };
    });
    return doc;
  }

  function serialize(doc) {
    var d = clone(doc);
    d.appVersion = VERSION;
    d.schemaVersion = SCHEMA_VERSION;
    d.modified = new Date().toISOString();
    return JSON.stringify(d, null, 2);
  }

  /* ------------------------------------------------------------ templates */

  var TEMPLATES = [
    { id: 'blank', label: 'Blank', description: 'Header and footer only.', build: function () { return [makeSection('header'), makeSection('text'), makeSection('footer')]; } },
    {
      id: 'people', label: 'People & culture update', description: 'New joiners, celebrations, promotions and exam passes.',
      build: function () {
        return [
          makeSection('header', { title: 'People & Culture Update', subtitle: 'Celebrating our people' }),
          makeSection('text', { html: '<p>Hello everyone,</p><p>Here is this month\'s round-up of everything happening across our teams.</p>' }),
          makeSection('newJoiners'),
          makeSection('divider'),
          makeSection('celebrations'),
          makeSection('divider'),
          makeSection('promotions'),
          makeSection('divider'),
          makeSection('examPasses'),
          makeSection('footer')
        ];
      }
    },
    {
      id: 'classic', label: 'Classic newsletter', description: 'Intro, feature story, image + text stories, columns and links.',
      build: function () {
        return [
          makeSection('header'),
          makeSection('heading', { text: 'In this issue', level: 2 }),
          makeSection('text'),
          makeSection('image'),
          makeSection('imageText'),
          makeSection('imageText', { imagePosition: 'right', heading: 'Another story' }),
          makeSection('columns'),
          makeSection('linkList'),
          makeSection('footer')
        ];
      }
    },
    {
      id: 'announcement', label: 'Single announcement', description: 'One big message with an image and a call to action.',
      build: function () {
        return [
          makeSection('header', { title: 'Announcement', subtitle: '' }),
          makeSection('image'),
          makeSection('heading', { text: 'Big news', level: 1, align: 'center' }),
          makeSection('text', { align: 'center' }),
          makeSection('button'),
          makeSection('footer')
        ];
      }
    },
    {
      id: 'digest', label: 'Two-column digest', description: 'Compact news cards in columns with a links list.',
      build: function () {
        return [
          makeSection('header', { title: 'Weekly Digest', subtitle: 'The week at a glance' }),
          makeSection('columns', { count: 2 }),
          makeSection('columns', { count: 2 }),
          makeSection('linkList'),
          makeSection('footer')
        ];
      }
    }
  ];

  /* ------------------------------------------------------------- renderer */

  /**
   * Render the full email document.
   * opts.editor: adds data-nl-id hooks and placeholders for the editing canvas.
   */
  function render(doc, opts) {
    opts = opts || {};
    var th = deepMerge(clone(DEFAULT_THEME), doc.theme || {});
    var width = clampInt(th.width, 480, 800, 640);
    var rows = (doc.sections || []).map(function (sec) {
      var def = SECTIONS[sec.type];
      if (!def) return '';
      var p = sec.props || {};
      var st = p.style || {};
      var px = clampInt(st.px, 0, 80, 32);
      var ctx = { editor: !!opts.editor, innerWidth: width - 2 * px, width: width };
      var inner;
      try { inner = def.render(p, th, ctx); } catch (e) { inner = opts.editor ? '<p style="color:#b91c1c">Render error: ' + esc(e.message) + '</p>' : ''; }
      var bg = st.bg || (def.defaultBg ? def.defaultBg(th) : '');
      var attrs = opts.editor ? ' data-nl-id="' + esc(sec.id) + '"' : '';
      return '<tr' + attrs + '><td class="nl-pad"' + (bg ? ' bgcolor="' + esc(bg) + '"' : '') + ' style="padding:' + clampInt(st.pt, 0, 120, 16) + 'px ' + px + 'px ' + clampInt(st.pb, 0, 120, 16) + 'px ' + px + 'px;' + (bg ? 'background:' + esc(bg) + ';' : '') + '">' + (inner || (opts.editor ? '&nbsp;' : '')) + '</td></tr>';
    }).join('\n');

    var editorCss = opts.editor ?
      'tr[data-nl-id]{cursor:pointer;} tr[data-nl-id]:hover>td{box-shadow:inset 0 0 0 2px rgba(37,99,235,.45);} tr.nl-selected>td{box-shadow:inset 0 0 0 3px #2563eb !important;} a{pointer-events:none;}' : '';

    return '<!DOCTYPE html>\n' +
      '<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">\n<head>\n' +
      '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta http-equiv="X-UA-Compatible" content="IE=edge">\n' +
      '<meta name="x-apple-disable-message-reformatting">\n<meta name="generator" content="Newsletter Builder ' + VERSION + '">\n' +
      '<title>' + esc(doc.subject || doc.title || '') + '</title>\n' +
      '<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->\n' +
      '<style>body{margin:0;padding:0;} table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;} img{-ms-interpolation-mode:bicubic;}' +
      '@media only screen and (max-width:' + (width + 20) + 'px){.nl-container{width:100% !important;} .nl-col{display:block !important;width:100% !important;max-width:100% !important;box-sizing:border-box;} .nl-gap{height:16px !important;} .nl-pad{padding-left:16px !important;padding-right:16px !important;} .nl-img-full{width:100% !important;height:auto !important;}}' +
      editorCss + '</style>\n</head>\n' +
      '<body style="margin:0;padding:0;background:' + th.pageBg + ';">\n' +
      (doc.preheader ? '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">' + esc(doc.preheader) + '</div>\n' : '') +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + th.pageBg + '" style="width:100%;background:' + th.pageBg + ';"><tr><td align="center" style="padding:24px 8px;">\n' +
      '<!--[if mso]><table role="presentation" width="' + width + '" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->\n' +
      '<table role="presentation" class="nl-container" width="' + width + '" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="' + th.contentBg + '" style="width:' + width + 'px;max-width:' + width + 'px;margin:0 auto;background:' + th.contentBg + ';">\n' +
      rows + '\n</table>\n' +
      '<!--[if mso]></td></tr></table><![endif]-->\n' +
      '</td></tr></table>\n</body>\n</html>';
  }

  /* ---------------------------------------------------- mail packaging */

  function b64EncodeUtf8(str) {
    if (typeof TextEncoder !== 'undefined') {
      var bytes = new TextEncoder().encode(str), bin = '';
      for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    }
    return btoa(unescape(encodeURIComponent(str)));
  }
  function wrap76(s) { return s.replace(/(.{76})/g, '$1\r\n'); }

  /**
   * Convert embedded data: images to cid: references.
   * Returns { subject, html (cid refs), inlineHtml (data URIs), attachments:[{name,contentType,contentId,contentBytes}] }
   * attachments are shaped for Microsoft Graph sendMail (add @odata.type + isInline when posting).
   */
  function buildMailPackage(doc) {
    var html = render(doc, { editor: false });
    var map = {}, attachments = [], n = 0;
    var cidHtml = html.replace(/src="(data:image\/(png|jpe?g|gif|webp);base64,([^"]+))"/gi, function (m, full, ext, data) {
      if (!map[full]) {
        n++;
        var e = ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase();
        var cid = 'nlimg' + n + '@newsletter';
        map[full] = cid;
        attachments.push({ name: 'image' + n + '.' + e, contentType: 'image/' + (e === 'jpg' ? 'jpeg' : e), contentId: cid, contentBytes: data });
      }
      return 'src="cid:' + map[full] + '"';
    });
    return { subject: doc.subject || doc.title || 'Newsletter', html: cidHtml, inlineHtml: html, attachments: attachments, generator: 'Newsletter Builder ' + VERSION };
  }

  /** Graph-ready payload (recipients added by Power Automate). */
  function buildGraphMessage(doc) {
    var pkg = buildMailPackage(doc);
    return {
      subject: pkg.subject,
      body: { contentType: 'HTML', content: pkg.html },
      attachments: pkg.attachments.map(function (a) {
        return { '@odata.type': '#microsoft.graph.fileAttachment', name: a.name, contentType: a.contentType, contentId: a.contentId, isInline: true, contentBytes: a.contentBytes };
      })
    };
  }

  /**
   * RFC 822 message with X-Unsent: 1 - classic Outlook for Windows/Mac opens it as an editable draft,
   * with images embedded as inline attachments (works where data: URIs do not).
   */
  function buildEml(doc, o) {
    o = o || {};
    var pkg = buildMailPackage(doc);
    var boundary = '----=_NLB_' + Math.random().toString(36).slice(2);
    var CRLF = '\r\n';
    var subj = '=?UTF-8?B?' + b64EncodeUtf8(pkg.subject) + '?=';
    var lines = [];
    lines.push('X-Unsent: 1');
    if (o.to) lines.push('To: ' + o.to);
    lines.push('Subject: ' + subj);
    lines.push('MIME-Version: 1.0');
    lines.push('X-Mailer: Newsletter Builder ' + VERSION);
    lines.push('Content-Type: multipart/related; type="text/html"; boundary="' + boundary + '"');
    lines.push('');
    lines.push('--' + boundary);
    lines.push('Content-Type: text/html; charset="utf-8"');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(wrap76(b64EncodeUtf8(pkg.html)));
    pkg.attachments.forEach(function (a) {
      lines.push('--' + boundary);
      lines.push('Content-Type: ' + a.contentType + '; name="' + a.name + '"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('Content-ID: <' + a.contentId + '>');
      lines.push('Content-Disposition: inline; filename="' + a.name + '"');
      lines.push('');
      lines.push(wrap76(a.contentBytes));
    });
    lines.push('--' + boundary + '--');
    lines.push('');
    return lines.join(CRLF);
  }

  /** Approximate byte size of the rendered email - Exchange/Outlook limits apply. */
  function estimateSize(doc) {
    return render(doc).length;
  }

  return {
    VERSION: VERSION,
    SCHEMA_VERSION: SCHEMA_VERSION,
    SECTIONS: SECTIONS,
    GROUPS: GROUPS,
    TEMPLATES: TEMPLATES,
    THEME_PRESETS: THEME_PRESETS,
    DEFAULT_THEME: DEFAULT_THEME,
    FONTS: FONTS,
    DATE_FORMATS: DATE_FORMATS,
    sectionStyleFields: sectionStyleFields,
    makeSection: makeSection,
    newDocument: newDocument,
    normalizeDocument: normalizeDocument,
    serialize: serialize,
    render: render,
    buildMailPackage: buildMailPackage,
    buildGraphMessage: buildGraphMessage,
    buildEml: buildEml,
    estimateSize: estimateSize,
    util: { uid: uid, clone: clone, esc: esc, safeUrl: safeUrl, fmtDate: fmtDate, sanitizeRich: sanitizeRich, slugify: slugify, deepMerge: deepMerge, b64EncodeUtf8: b64EncodeUtf8 }
  };
});
