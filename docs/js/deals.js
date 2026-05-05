/* ═══════════════════════════════════════════════
   obiDeals — Deal Listing & Detail Logic
   Fill empty slots. Find better deals.
   ═══════════════════════════════════════════════ */

var _deals, _areas, _amenities;

/* ── Utilities ────────────────────────────────── */

function formatNaira(amount) {
  if (!amount) return '\u20a60';
  return '\u20a6' + amount.toLocaleString('en-NG');
}

function discountPercent(normal, deal) {
  if (!normal || !deal) return 0;
  return Math.round(((normal - deal) / normal) * 100);
}

function dealCategoryLabel(cat) {
  var labels = {
    hotel: 'Hotel', shortlet: 'Shortlet', event_space: 'Event Space',
    salon: 'Salon', car_hire: 'Car Hire', coworking: 'Coworking',
    restaurant: 'Restaurant', other: 'Service'
  };
  return labels[cat] || cat;
}

function qualityLabel(q) {
  var labels = { budget: 'Budget', standard: 'Standard', premium: 'Premium', luxury: 'Luxury' };
  return labels[q] || '';
}

function amenityHtml(amenityId) {
  if (!_amenities || !_amenities[amenityId]) return '<span class="pill">' + amenityId + '</span>';
  var a = _amenities[amenityId];
  return '<span class="pill">' + a.icon + ' ' + a.name + '</span>';
}

function dealVerificationBadge(status) {
  switch (status) {
    case 'premium_partner': return '<span class="badge badge-verified">Premium Partner</span>';
    case 'obi_verified': return '<span class="badge badge-verified">Verified</span>';
    case 'owner_claimed': return '<span class="badge badge-claimed">Claimed</span>';
    case 'field_checked': return '<span class="badge badge-field">Checked</span>';
    default: return '';
  }
}

function mysteryBadge() {
  return '<span class="badge" style="background:rgba(139,62,139,0.12);color:#c084fc;">Mystery</span>';
}

/* ── Deal Card ────────────────────────────────── */

function renderDealCard(deal) {
  var isMystery = deal.dealType === 'mystery';
  var name = isMystery ? deal.title : (deal.providerName || deal.title);
  var discount = discountPercent(deal.normalPrice, deal.dealPrice);
  var area = areaName(_areas || [], deal.areaId);
  var quality = qualityLabel(deal.qualityLevel);

  var badges = dealVerificationBadge(deal.verificationStatus);
  if (isMystery) badges += ' ' + mysteryBadge();

  var amenityPills = (deal.amenities || []).slice(0, 4).map(amenityHtml).join('');

  return '<a class="biz-card' + (deal.featured ? ' featured' : '') + '" href="deal.html?d=' + deal.slug + '">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.3rem;">' +
      '<div class="biz-card-name" style="font-size:1rem;">' + name + '</div>' +
      '<div style="text-align:right;">' +
        '<div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--gold-bright);">' + formatNaira(deal.dealPrice) + '</div>' +
        '<div style="font-family:var(--font-code);font-size:0.55rem;color:var(--text-ghost);text-decoration:line-through;">' + formatNaira(deal.normalPrice) + '</div>' +
      '</div>' +
    '</div>' +
    (deal.description ? '<div class="biz-card-tagline" style="margin-bottom:0.5rem;">' + deal.description.substring(0, 100) + (deal.description.length > 100 ? '...' : '') + '</div>' : '') +
    '<div class="biz-card-meta">' +
      '<span class="pill">' + dealCategoryLabel(deal.category) + '</span>' +
      '<span class="pill">' + area + '</span>' +
      (quality ? '<span class="pill">' + quality + '</span>' : '') +
      (discount ? '<span class="pill-gold">' + discount + '% OFF</span>' : '') +
    '</div>' +
    '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.6rem;">' + amenityPills + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div>' + badges + '</div>' +
      '<span class="wa-btn wa-btn-sm" onclick="event.preventDefault();event.stopPropagation();" style="pointer-events:none;">Reserve</span>' +
    '</div>' +
  '</a>';
}

/* ── Deals Listing Page ──────────────────────── */

(function() {
  // Only run on deals.html
  if (!document.getElementById('deals-grid')) return;

  renderHeader('deals');
  renderFooter();

  Promise.all([
    loadJSON('data/deals.json'),
    loadJSON('data/areas.json'),
    loadJSON('data/amenities.json')
  ]).then(function(data) {
    _deals = data[0];
    _areas = data[1];
    _amenities = data[2];

    // Populate area filter
    var areaSel = document.getElementById('filter-area');
    _areas.forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      areaSel.appendChild(opt);
    });

    // Set from URL params
    var paramType = getParam('type') || '';
    var paramCat = getParam('cat') || '';
    var paramArea = getParam('area') || '';
    document.getElementById('filter-type').value = paramType;
    document.getElementById('filter-cat').value = paramCat;
    document.getElementById('filter-area').value = paramArea;

    document.getElementById('deal-count').textContent = _deals.filter(function(d) { return d.status === 'live'; }).length;

    applyDealFilters();
    bindDealEvents();
  });

  function applyDealFilters() {
    var type = document.getElementById('filter-type').value;
    var cat = document.getElementById('filter-cat').value;
    var area = document.getElementById('filter-area').value;

    var results = _deals.filter(function(d) {
      if (d.status !== 'live') return false;
      if (type && d.dealType !== type) return false;
      if (cat && d.category !== cat) return false;
      if (area && d.areaId !== area) return false;
      return true;
    });

    // Sort: featured first, then by price
    results.sort(function(a, b) {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.dealPrice - b.dealPrice;
    });

    var grid = document.getElementById('deals-grid');
    var noDeals = document.getElementById('no-deals');

    if (results.length === 0) {
      grid.innerHTML = '';
      noDeals.style.display = 'block';
    } else {
      noDeals.style.display = 'none';
      grid.innerHTML = results.map(renderDealCard).join('');
      if (window.revealCards) revealCards();
    }

    // Update URL
    var params = new URLSearchParams();
    if (type) params.set('type', type);
    if (cat) params.set('cat', cat);
    if (area) params.set('area', area);
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function bindDealEvents() {
    document.getElementById('filter-type').addEventListener('change', applyDealFilters);
    document.getElementById('filter-cat').addEventListener('change', applyDealFilters);
    document.getElementById('filter-area').addEventListener('change', applyDealFilters);
  }

  window.clearDealFilters = function() {
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-cat').value = '';
    document.getElementById('filter-area').value = '';
    applyDealFilters();
  };
})();

/* ── Deal Detail Page ────────────────────────── */

function renderDealDetail() {
  renderHeader('deals');
  renderFooter();

  var slug = getParam('d');
  if (!slug) {
    document.getElementById('deal-detail').innerHTML =
      '<p style="font-style:italic;color:var(--text-dim);">No deal specified. <a href="deals.html">Browse all deals</a>.</p>';
    return;
  }

  Promise.all([
    loadJSON('data/deals.json'),
    loadJSON('data/areas.json'),
    loadJSON('data/amenities.json')
  ]).then(function(data) {
    _deals = data[0];
    _areas = data[1];
    _amenities = data[2];

    var deal = _deals.find(function(d) { return d.slug === slug; });
    if (!deal) {
      document.getElementById('deal-detail').innerHTML =
        '<h2 style="font-family:var(--font-display);color:var(--gold-bright);">Deal not found</h2>' +
        '<p style="margin-top:0.5rem;font-style:italic;color:var(--text-dim);"><a href="deals.html">Browse all deals</a></p>';
      return;
    }
    document.title = deal.title + ' \u2014 obiDeals';
    renderDetailContent(deal);
  });
}

function renderDetailContent(deal) {
  var isMystery = deal.dealType === 'mystery';
  var area = areaName(_areas || [], deal.areaId);
  var discount = discountPercent(deal.normalPrice, deal.dealPrice);
  var quality = qualityLabel(deal.qualityLevel);
  var badges = dealVerificationBadge(deal.verificationStatus);
  if (isMystery) badges += ' ' + mysteryBadge();

  var html = '';

  // Header
  html += '<div class="profile-header" style="opacity:0;transform:translateY(20px);animation:fadeUp 0.8s 0.1s ease forwards;">';
  html += '<h1 class="profile-name" style="font-size:clamp(1.4rem,3.5vw,2rem);">' + deal.title + '</h1>';
  html += '<div class="profile-tagline">' + (isMystery ? 'Mystery deal \u2014 provider revealed after reservation' : deal.providerName || '') + '</div>';
  html += '<div class="profile-meta">';
  html += '<span class="pill">' + dealCategoryLabel(deal.category) + '</span>';
  html += '<span class="pill">' + area + '</span>';
  if (quality) html += '<span class="pill">' + quality + '</span>';
  html += badges;
  html += '</div>';

  // Price block
  html += '<div style="display:flex;align-items:baseline;gap:0.8rem;margin:1rem 0;">';
  html += '<span style="font-family:var(--font-display);font-size:2.2rem;font-weight:900;color:var(--gold-bright);text-shadow:0 0 40px rgba(201,125,29,0.2);">' + formatNaira(deal.dealPrice) + '</span>';
  html += '<span style="font-family:var(--font-code);font-size:0.85rem;color:var(--text-ghost);text-decoration:line-through;">' + formatNaira(deal.normalPrice) + '</span>';
  if (discount) html += '<span class="pill-gold">' + discount + '% OFF</span>';
  html += '</div>';

  // Reserve CTA
  html += '<div class="cta-row">';
  html += '<button class="wa-btn" onclick="reserveDeal()" style="animation:waPulse 3s ease-in-out infinite;">Reserve via WhatsApp</button>';
  html += '</div>';
  html += '</div>';

  // Mystery warning
  if (isMystery) {
    html += '<div class="detail-section" style="padding:1rem;background:rgba(139,62,139,0.06);border:1px solid rgba(192,132,252,0.15);border-radius:var(--radius-md);">';
    html += '<div style="font-family:var(--font-ui);font-size:0.78rem;font-weight:600;color:#c084fc;margin-bottom:0.3rem;">Mystery Deal</div>';
    html += '<div style="font-size:0.85rem;color:var(--text-dim);line-height:1.6;">This is a mystery deal. The exact provider name and address will be revealed after your reservation is confirmed. You can see the area, quality level, amenities, rules, and price before reserving.</div>';
    html += '</div>';
  }

  // Description
  if (deal.description) {
    html += '<div class="detail-section reveal">';
    html += '<div class="detail-label">About This Deal</div>';
    html += '<div class="detail-body">' + deal.description + '</div>';
    html += '</div>';
  }

  // Amenities
  if (deal.amenities && deal.amenities.length) {
    html += '<div class="detail-section reveal">';
    html += '<div class="detail-label">Amenities</div>';
    html += '<div class="service-list">' + deal.amenities.map(amenityHtml).join('') + '</div>';
    html += '</div>';
  }

  // Rules
  if (deal.rules && deal.rules.length) {
    html += '<div class="detail-section reveal">';
    html += '<div class="detail-label">Rules & Conditions</div>';
    html += '<ul class="feature-list">' + deal.rules.map(function(r) { return '<li>' + r + '</li>'; }).join('') + '</ul>';
    html += '</div>';
  }

  // Deal info
  html += '<div class="detail-section reveal">';
  html += '<div class="detail-label">Deal Details</div>';
  html += '<div class="detail-body" style="font-size:0.88rem;">';
  html += '<div><strong>Payment:</strong> ' + paymentLabel(deal.paymentMode) + '</div>';
  html += '<div><strong>Cancellation:</strong> ' + cancellationLabel(deal.cancellationPolicy) + '</div>';
  if (deal.maxGuests) html += '<div><strong>Max guests:</strong> ' + deal.maxGuests + '</div>';
  if (deal.quantity > 1) html += '<div><strong>Available:</strong> ' + deal.quantity + ' units</div>';
  html += '<div><strong>Valid:</strong> ' + deal.availableFrom + ' to ' + deal.availableTo + '</div>';
  html += '</div>';
  html += '</div>';

  // Reserve form
  html += '<div class="detail-section reveal" style="padding-top:1.5rem;border-top:1px solid var(--border);">';
  html += '<div class="detail-label">Reserve This Deal</div>';
  html += '<div class="form-grid" id="reserve-form">';
  html += '<div><label class="form-label">Your Name *</label><input class="form-input" id="r-name" placeholder="Full name"></div>';
  html += '<div><label class="form-label">WhatsApp *</label><input class="form-input" id="r-phone" placeholder="08x xxxx xxxx" type="tel"></div>';
  html += '<div><label class="form-label">Check-in Date</label><input class="form-input" id="r-date" type="date"></div>';
  html += '<div><label class="form-label">Guests</label><input class="form-input" id="r-guests" type="number" min="1" max="' + (deal.maxGuests || 10) + '" value="1"></div>';
  html += '<div class="form-full"><label class="form-label">Notes</label><textarea class="form-input" id="r-notes" placeholder="Any special requests?" rows="2"></textarea></div>';
  html += '<div class="form-full"><button class="wa-btn" onclick="reserveDeal()">Reserve via WhatsApp</button></div>';
  html += '</div>';
  html += '</div>';

  document.getElementById('deal-detail').innerHTML = html;
  window._deal = deal;

  // Trigger reveals
  var reveals = document.querySelectorAll('.reveal:not(.revealed)');
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -30px 0px', threshold: 0.1 });
    reveals.forEach(function(el) { obs.observe(el); });
  } else {
    reveals.forEach(function(el) { el.classList.add('revealed'); });
  }
}

function paymentLabel(mode) {
  var labels = {
    pay_on_arrival: 'Pay balance on arrival',
    reservation_fee: 'Small reservation fee, balance on arrival',
    manual_confirmation: 'Manual confirmation via WhatsApp',
    full_payment: 'Full payment required'
  };
  return labels[mode] || mode;
}

function cancellationLabel(policy) {
  var labels = {
    flexible: 'Free cancellation (before check-in)',
    final: 'Non-refundable',
    manual_review: 'Cancellation reviewed case-by-case'
  };
  return labels[policy] || policy;
}

window.reserveDeal = function() {
  var deal = window._deal;
  if (!deal) { location.href = 'deals.html'; return; }

  var name = (document.getElementById('r-name') || {}).value || '';
  var phone = (document.getElementById('r-phone') || {}).value || '';
  var date = (document.getElementById('r-date') || {}).value || '';
  var guests = (document.getElementById('r-guests') || {}).value || '1';
  var notes = (document.getElementById('r-notes') || {}).value || '';

  var area = areaName(_areas || [], deal.areaId);
  var isMystery = deal.dealType === 'mystery';

  var msg = 'RESERVATION REQUEST\n' +
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
    'Deal: ' + deal.title + '\n' +
    (isMystery ? 'Type: Mystery Deal\n' : 'Provider: ' + (deal.providerName || '') + '\n') +
    'Area: ' + area + '\n' +
    'Price: ' + formatNaira(deal.dealPrice) + ' (normal: ' + formatNaira(deal.normalPrice) + ')\n' +
    'Payment: ' + paymentLabel(deal.paymentMode) + '\n' +
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
    (name ? 'Name: ' + name + '\n' : '') +
    (phone ? 'Phone: ' + phone + '\n' : '') +
    (date ? 'Date: ' + date + '\n' : '') +
    (guests !== '1' ? 'Guests: ' + guests + '\n' : '') +
    (notes ? 'Notes: ' + notes + '\n' : '') +
    '\n\u2014 Sent via obiDeals';

  window.open(whatsappUrl(OBIDESK_WHATSAPP, msg), '_blank');
};
