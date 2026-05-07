/* ═══════════════════════════════════════════════
   obiDesk — Shared Utilities
   ═══════════════════════════════════════════════ */

var OBI_WHATSAPP = '2348000000000';

function loadJSON(url) {
  return fetch(url).then(function(r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
}

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function formatPhone(phone) {
  if (!phone) return '';
  var clean = phone.replace(/\D/g, '');
  if (clean.startsWith('234') && clean.length === 13) {
    return '0' + clean.slice(3, 6) + ' ' + clean.slice(6, 9) + ' ' + clean.slice(9);
  }
  return phone;
}

function whatsappUrl(number, text) {
  var clean = (number || '').replace(/\D/g, '');
  var msg = (text || '').substring(0, 4000);
  return 'https://wa.me/' + clean + '?text=' + encodeURIComponent(msg);
}

function callUrl(phone) {
  return 'tel:' + (phone || '').replace(/\s/g, '');
}

function formatNaira(amount) {
  if (!amount && amount !== 0) return '\u20a60';
  return '\u20a6' + Number(amount).toLocaleString('en-NG');
}

function verificationBadge(status) {
  switch (status) {
    case 'verified':
      return '<span class="badge badge-verified">Verified</span>';
    case 'owner_claimed':
      return '<span class="badge badge-claimed">Claimed</span>';
    case 'field_checked':
      return '<span class="badge badge-field">Checked</span>';
    default:
      return '';
  }
}

function categoryName(categories, id) {
  var cat = categories.find(function(c) { return c.id === id; });
  return cat ? cat.name : id;
}

function categoryEmoji(categories, id) {
  var cat = categories.find(function(c) { return c.id === id; });
  return cat ? cat.emoji : '';
}

function areaName(areas, id) {
  var area = areas.find(function(a) { return a.id === id; });
  return area ? area.name : id;
}

function shareUrl(slug) {
  return location.origin + location.pathname.replace(/[^/]*$/, '') + 'desk.html?b=' + slug;
}

function shareBusiness(biz) {
  var url = shareUrl(biz.slug);
  var text = biz.name + ' \u2014 ' + biz.tagline + '\n' + url;
  if (navigator.share) {
    navigator.share({ title: biz.name, text: biz.tagline, url: url }).catch(function() {});
  } else {
    navigator.clipboard.writeText(text).then(function() {
      alert('Link copied!');
    }).catch(function() {
      prompt('Copy this link:', url);
    });
  }
}

/* ── Font Loading ────────────────────────────── */
var FONT_URL = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Ubuntu:wght@300;400;500;700&display=swap';

// Inline SVG logo mark — Seed of Life (sacred geometry)
var LOGO_SVG = '<svg class="nav-logo-svg" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">' +
  '<g stroke="currentColor" fill="none" stroke-width="1.2" opacity="0.8">' +
    '<circle cx="20" cy="20" r="8"/>' +
    '<circle cx="20" cy="12" r="8"/>' +
    '<circle cx="20" cy="28" r="8"/>' +
    '<circle cx="13.07" cy="16" r="8"/>' +
    '<circle cx="26.93" cy="16" r="8"/>' +
    '<circle cx="13.07" cy="24" r="8"/>' +
    '<circle cx="26.93" cy="24" r="8"/>' +
  '</g>' +
  '<circle cx="20" cy="20" r="1.5" fill="currentColor" opacity="0.9"/>' +
'</svg>';

var NAV_ITEMS = [
  { id: 'browse', href: 'browse.html', label: 'Directory', icon: '\ud83d\udcc2' },
  { id: 'deals', href: 'deals.html', label: 'Deals', icon: '\ud83d\udcb0' },
  { id: 'receipts', href: 'receipts.html', label: 'Receipts', icon: '\ud83e\uddfe' },
  { id: 'get-listed', href: 'get-listed.html', label: 'Get Listed', icon: '\u2795' },
  { id: 'field', href: 'field.html', label: 'Field Capture', icon: '\ud83d\udcf7' },
];

function renderHeader(activePage) {
  var header = document.getElementById('site-nav');
  if (!header) return;

  // Desktop nav links
  var links = NAV_ITEMS.map(function(item) {
    return '<a class="site-nav-link' + (activePage === item.id ? ' active' : '') + '" href="' + item.href + '">' + item.label + '</a>';
  }).join('<span class="site-nav-sep">\u00b7</span>');

  // Drawer links (mobile)
  var drawerLinks = NAV_ITEMS.map(function(item) {
    return '<a class="nav-drawer-link' + (activePage === item.id ? ' active' : '') + '" href="' + item.href + '">' +
      '<span class="drawer-icon">' + item.icon + '</span>' + item.label + '</a>';
  }).join('');

  header.innerHTML =
    '<a class="site-nav-brand" href="index.html">' + LOGO_SVG + '<span class="brand-obi">obi</span><span class="brand-desk">Desk</span></a>' +
    links +
    '<button class="theme-toggle desktop-only" onclick="obiThemeCycle()" aria-label="Toggle theme">' +
      '<span class="theme-icon"></span>' +
    '</button>' +
    '<button class="nav-burger" onclick="openDrawer()" aria-label="Menu">\u2630</button>';

  // Remove old drawer/backdrop if they exist (clean re-render)
  var oldDrawer = document.getElementById('nav-drawer');
  var oldBackdrop = document.getElementById('nav-backdrop');
  if (oldDrawer) oldDrawer.remove();
  if (oldBackdrop) oldBackdrop.remove();

  // Backdrop
  var backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  backdrop.id = 'nav-backdrop';
  backdrop.addEventListener('click', function() { closeDrawer(); });
  document.body.appendChild(backdrop);

  // Drawer
  var drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'nav-drawer';
  drawer.innerHTML =
    '<button class="nav-drawer-close" onclick="closeDrawer()">\u2715</button>' +
    '<a class="nav-drawer-link' + (activePage === 'home' ? ' active' : '') + '" href="index.html">' +
      '<span class="drawer-icon">\ud83c\udfe0</span>Home</a>' +
    drawerLinks +
    '<div class="nav-drawer-divider"></div>' +
    '<a class="nav-drawer-link" href="request-system.html">' +
      '<span class="drawer-icon">\ud83d\udee0\ufe0f</span>Request System</a>' +
    '<div class="nav-drawer-divider"></div>' +
    '<div style="padding:0.5rem 0.8rem;display:flex;align-items:center;gap:0.5rem;">' +
      '<button class="theme-toggle" onclick="obiThemeCycle()" aria-label="Toggle theme" style="margin-left:0;">' +
        '<span class="theme-icon"></span>' +
      '</button>' +
      '<span style="font-family:var(--font-code);font-size:0.52rem;color:var(--text-ghost);letter-spacing:0.1em;">THEME</span>' +
    '</div>';
  document.body.appendChild(drawer);
}

window.openDrawer = function() {
  var drawer = document.getElementById('nav-drawer');
  var backdrop = document.getElementById('nav-backdrop');
  if (drawer) { drawer.classList.add('open'); }
  if (backdrop) { backdrop.classList.add('open'); }
  document.body.style.overflow = 'hidden';
};

window.closeDrawer = function() {
  var drawer = document.getElementById('nav-drawer');
  var backdrop = document.getElementById('nav-backdrop');
  if (drawer) { drawer.classList.remove('open'); }
  if (backdrop) { backdrop.classList.remove('open'); }
  document.body.style.overflow = '';
};

function renderFooter() {
  var footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.innerHTML =
    '<p>"When you see a good person, think of becoming like them." \u2014 Confucius</p>' +
    '<p style="margin-top:0.4rem;font-style:normal;font-family:var(--font-code);font-size:0.6rem;letter-spacing:0.1em;color:var(--text-ghost);">' +
      'obiDesk by <a href="https://obiverse.net">OBIVERSE</a> &ensp;\u00b7&ensp; ' +
      '<a href="request-system.html">Request System</a>' +
    '</p>';
}

function renderBusinessCard(biz, categories, areas) {
  var catLabel = biz.categoryIds.map(function(id) {
    return '<span class="pill">' + categoryEmoji(categories, id) + ' ' + categoryName(categories, id) + '</span>';
  }).join('');
  var aLabel = '<span class="pill">' + areaName(areas, biz.areaId) + '</span>';

  return '<a class="biz-card" href="desk.html?b=' + biz.slug + '">' +
    '<div class="biz-card-name">' + biz.name + ' ' + verificationBadge(biz.verificationStatus) + '</div>' +
    '<div class="biz-card-tagline">' + (biz.tagline || '') + '</div>' +
    '<div class="biz-card-meta">' + catLabel + aLabel + '</div>' +
    '<div class="biz-card-cta">' +
      '<span class="wa-btn wa-btn-sm" onclick="event.preventDefault();event.stopPropagation();window.open(\'' + whatsappUrl(biz.whatsapp, 'Hi, I found you on obiDesk!') + '\')">WhatsApp</span>' +
    '</div>' +
  '</a>';
}
