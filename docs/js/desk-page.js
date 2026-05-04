/* ═══════════════════════════════════════════════
   obiDesk — Business Profile Page
   ═══════════════════════════════════════════════ */

(function() {
  renderHeader('desk');
  renderFooter();

  var slug = getParam('b');
  if (!slug) {
    document.getElementById('profile').innerHTML =
      '<p style="font-style:italic;color:var(--text-dim);">No business specified. <a href="browse.html">Browse all businesses</a>.</p>';
    return;
  }

  Promise.all([
    loadJSON('data/businesses.json'),
    loadJSON('data/categories.json'),
    loadJSON('data/areas.json')
  ]).then(function(data) {
    var businesses = data[0], categories = data[1], areas = data[2];
    var biz = businesses.find(function(b) { return b.slug === slug; });
    if (!biz) {
      document.getElementById('profile').innerHTML =
        '<h2 style="font-family:var(--font-display);color:var(--gold-bright);">Business not found</h2>' +
        '<p style="margin-top:0.5rem;font-style:italic;color:var(--text-dim);"><a href="browse.html">Browse all businesses</a></p>';
      return;
    }
    document.title = biz.name + ' \u2014 obiDesk';
    renderProfile(biz, categories, areas);
  });

  function renderProfile(biz, categories, areas) {
    var catLabels = biz.categoryIds.map(function(id) {
      return '<span class="pill">' + categoryEmoji(categories, id) + ' ' + categoryName(categories, id) + '</span>';
    }).join('');
    var aLabel = '<span class="pill">' + areaName(areas, biz.areaId) + '</span>';
    var badge = verificationBadge(biz.verificationStatus);

    var services = biz.services.map(function(s) {
      return '<span class="pill">' + s + '</span>';
    }).join('');

    var waMsg = 'Hello ' + biz.name + ', I found you on obiDesk and I\'d like to inquire about your services.';

    var html = '';

    // Header with fadeUp
    html += '<div class="profile-header" style="opacity:0;transform:translateY(20px);animation:fadeUp 0.8s 0.1s ease forwards;">';
    html += '<h1 class="profile-name">' + biz.name + ' ' + badge + '</h1>';
    html += '<div class="profile-tagline">' + (biz.tagline || '') + '</div>';
    html += '<div class="profile-meta">' + catLabels + aLabel + '</div>';

    // CTA Row
    html += '<div class="cta-row">';
    if (biz.whatsapp) {
      html += '<a class="wa-btn" href="' + whatsappUrl(biz.whatsapp, waMsg) + '" target="_blank" rel="noopener">WhatsApp</a>';
    }
    if (biz.phone) {
      html += '<a class="cta-btn" href="' + callUrl(biz.phone) + '">Call ' + formatPhone(biz.phone) + '</a>';
    }
    if (biz.mapUrl) {
      html += '<a class="cta-btn" href="' + biz.mapUrl + '" target="_blank" rel="noopener">Map</a>';
    }
    html += '<button class="cta-btn" onclick="shareBusiness(window._biz)">Share</button>';
    html += '</div>';
    html += '</div>';

    // Description
    if (biz.description) {
      html += '<div class="detail-section reveal">';
      html += '<div class="detail-label">About</div>';
      html += '<div class="detail-body">' + biz.description + '</div>';
      html += '</div>';
    }

    // Services
    if (biz.services && biz.services.length) {
      html += '<div class="detail-section reveal">';
      html += '<div class="detail-label">Services</div>';
      html += '<div class="service-list">' + services + '</div>';
      html += '</div>';
    }

    // Details
    html += '<div class="detail-section reveal">';
    html += '<div class="detail-label">Details</div>';
    html += '<div class="detail-body">';
    if (biz.address) html += '<div><strong>Address:</strong> ' + biz.address + '</div>';
    if (biz.landmark) html += '<div><strong>Landmark:</strong> ' + biz.landmark + '</div>';
    if (biz.hours) html += '<div><strong>Hours:</strong> ' + biz.hours + '</div>';
    if (biz.phone) html += '<div><strong>Phone:</strong> ' + formatPhone(biz.phone) + '</div>';
    html += '</div>';
    html += '</div>';

    // Inquiry Form
    html += '<div class="detail-section reveal" style="padding-top:1.5rem;border-top:1px solid var(--border);">';
    html += '<div class="detail-label">Send Inquiry</div>';
    html += '<div class="form-grid" id="inquiry-form">';
    html += '<div><label class="form-label">Your Name</label><input class="form-input" id="inq-name" placeholder="Your name"></div>';
    html += '<div><label class="form-label">Your Phone</label><input class="form-input" id="inq-phone" placeholder="08x xxxx xxxx"></div>';
    html += '<div class="form-full"><label class="form-label">Message</label><textarea class="form-input" id="inq-msg" placeholder="What do you need?"></textarea></div>';
    html += '<div class="form-full"><button class="wa-btn" onclick="sendInquiry()">Send via WhatsApp</button></div>';
    html += '</div>';
    html += '</div>';

    document.getElementById('profile').innerHTML = html;
    window._biz = biz;

    // Trigger reveal on detail sections
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

  window.sendInquiry = function() {
    var name = document.getElementById('inq-name').value.trim();
    var phone = document.getElementById('inq-phone').value.trim();
    var msg = document.getElementById('inq-msg').value.trim();
    var biz = window._biz;
    if (!biz || !biz.whatsapp) return;

    var text = 'Hi ' + biz.name + ',\n\n' +
      'I found you on obiDesk.\n\n' +
      (name ? 'Name: ' + name + '\n' : '') +
      (phone ? 'Phone: ' + phone + '\n' : '') +
      (msg ? '\n' + msg : '') +
      '\n\n\u2014 Sent via obiDesk';

    window.open(whatsappUrl(biz.whatsapp, text), '_blank');
  };
})();
