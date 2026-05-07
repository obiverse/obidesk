/* ═══════════════════════════════════════════════
   obiDesk — Field Capture Logic
   Walk Abuja. Photograph signboards. Build the directory.
   ═══════════════════════════════════════════════ */

(function() {
  renderHeader('field');
  renderFooter();

  // Populate dropdowns
  Promise.all([
    loadJSON('data/categories.json'),
    loadJSON('data/areas.json')
  ]).then(function(data) {
    var cats = data[0], areas = data[1];
    var catSel = document.getElementById('fc-category');
    cats.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.emoji + ' ' + c.name;
      catSel.appendChild(opt);
    });
    var areaSel = document.getElementById('fc-area');
    areas.forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      areaSel.appendChild(opt);
    });
  });

  // Init IDB and load queue
  obiDB.init().then(refreshQueue);

  function getFormData() {
    return {
      name: document.getElementById('fc-name').value.trim(),
      category: document.getElementById('fc-category').value,
      area: document.getElementById('fc-area').value,
      address: document.getElementById('fc-address').value.trim(),
      phone: document.getElementById('fc-phone').value.trim(),
      notes: document.getElementById('fc-notes').value.trim()
    };
  }

  function clearForm() {
    ['fc-name', 'fc-address', 'fc-phone', 'fc-notes'].forEach(function(id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('fc-photo').value = '';
    // Reset photo label
    var label = document.getElementById('photo-label');
    if (label) label.classList.remove('has-photo');
    var text = document.getElementById('photo-text');
    if (text) text.textContent = 'Tap to take photo';
  }

  function readPhoto() {
    return new Promise(function(resolve) {
      var input = document.getElementById('fc-photo');
      if (!input.files || !input.files[0]) { resolve(null); return; }
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { resolve(null); };
      reader.readAsDataURL(input.files[0]);
    });
  }

  // Photo select UX
  window.onPhotoSelect = function(input) {
    var label = document.getElementById('photo-label');
    var text = document.getElementById('photo-text');
    if (input.files && input.files[0]) {
      if (label) label.classList.add('has-photo');
      if (text) text.textContent = input.files[0].name.substring(0, 30);
    } else {
      if (label) label.classList.remove('has-photo');
      if (text) text.textContent = 'Tap to take photo';
    }
  };

  window.saveCapture = function() {
    var data = getFormData();
    if (!data.name || !data.category || !data.area) {
      showFormStatus('field-form', 'Name, category, and area are required.', true);
      return;
    }
    readPhoto().then(function(photo) {
      data.photo = photo;
      return obiDB.saveCapture(data);
    }).then(function() {
      showFormStatus('field-form', 'Saved! (' + data.name + ')', false);
      clearForm();
      refreshQueue();
    });
  };

  window.sendCapture = function() {
    var data = getFormData();
    if (!data.name) {
      showFormStatus('field-form', 'Business name is required.', true);
      return;
    }
    var catEl = document.getElementById('fc-category');
    var areaEl = document.getElementById('fc-area');
    var catLabel = catEl && catEl.selectedOptions[0] ? catEl.selectedOptions[0].textContent : data.category;
    var areaLabel = areaEl && areaEl.selectedOptions[0] ? areaEl.selectedOptions[0].textContent : data.area;
    var msg = 'FIELD CAPTURE\n' +
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
      'Name: ' + data.name + '\n' +
      'Category: ' + catLabel + '\n' +
      'Area: ' + areaLabel + '\n' +
      (data.address ? 'Address: ' + data.address + '\n' : '') +
      (data.phone ? 'Phone: ' + data.phone + '\n' : '') +
      (data.notes ? 'Notes: ' + data.notes + '\n' : '') +
      '\n\u2014 Field captured via obiDesk';
    openWhatsApp(OBIDESK_WHATSAPP, msg);
  };

  function refreshQueue() {
    obiDB.getAllCaptures().then(function(captures) {
      // Update counters
      var countEl = document.getElementById('queue-count');
      if (countEl) countEl.textContent = '(' + captures.length + ')';
      var badgeEl = document.getElementById('queue-badge');
      if (badgeEl) badgeEl.textContent = captures.length;

      var list = document.getElementById('queue-list');
      if (!list) return;

      if (captures.length === 0) {
        list.innerHTML = '<p style="color:var(--text-ghost);font-size:0.78rem;font-style:italic;">No captures yet. Walk Abuja!</p>';
        return;
      }

      list.innerHTML = captures.map(function(c) {
        return '<div class="biz-card revealed" style="padding:0.8rem 1rem;margin-bottom:0.4rem;cursor:default;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<div class="biz-card-name" style="font-size:0.92rem;">' + c.name + '</div>' +
            '<button class="filter-clear" onclick="deleteCapture(' + c.id + ')">remove</button>' +
          '</div>' +
          '<div style="font-family:var(--font-ui);font-size:0.68rem;color:var(--text-dim);margin-top:0.2rem;">' +
            (c.category || '') + ' \u00b7 ' + (c.area || '') +
            (c.phone ? ' \u00b7 ' + c.phone : '') +
          '</div>' +
        '</div>';
      }).join('');
    });
  }

  window.deleteCapture = function(id) {
    obiDB.deleteCapture(id).then(refreshQueue);
  };

  window.clearQueue = function() {
    if (confirm('Clear all captured businesses?')) {
      obiDB.clearCaptures().then(refreshQueue);
    }
  };

  window.exportCaptures = function() {
    obiDB.getAllCaptures().then(function(captures) {
      if (!captures.length) { alert('No captures to export.'); return; }
      var clean = captures.map(function(c) {
        var copy = Object.assign({}, c);
        delete copy.photo;
        return copy;
      });
      var blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'obidesk-captures-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  window.addEventListener('online', function() {
    obiDB.getAllCaptures().then(function(captures) {
      if (captures.length > 0) {
        showFormStatus('field-form', 'Back online! ' + captures.length + ' captures ready to export.', false);
      }
    });
  });
})();
