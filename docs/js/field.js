/* obiDesk — Field Capture Logic */

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
    var catLabel = document.getElementById('fc-category').selectedOptions[0]?.textContent || data.category;
    var areaLabel = document.getElementById('fc-area').selectedOptions[0]?.textContent || data.area;
    var msg = 'FIELD CAPTURE\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      'Name: ' + data.name + '\n' +
      'Category: ' + catLabel + '\n' +
      'Area: ' + areaLabel + '\n' +
      (data.address ? 'Address: ' + data.address + '\n' : '') +
      (data.phone ? 'Phone: ' + data.phone + '\n' : '') +
      (data.notes ? 'Notes: ' + data.notes + '\n' : '') +
      '\n— Field captured via obiDesk';
    openWhatsApp(OBIDESK_WHATSAPP, msg);
  };

  function refreshQueue() {
    obiDB.getAllCaptures().then(function(captures) {
      document.getElementById('queue-count').textContent = '(' + captures.length + ')';
      var list = document.getElementById('queue-list');
      if (captures.length === 0) {
        list.innerHTML = '<p style="color:var(--color-text-ghost);font-size:12px;">No captures yet. Walk Abuja!</p>';
        return;
      }
      list.innerHTML = captures.map(function(c) {
        return '<div class="card" style="margin-bottom:var(--phi-8);padding:var(--phi-13);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<strong style="color:var(--color-text-bright);font-size:13px;">' + c.name + '</strong>' +
            '<button style="background:none;border:none;color:var(--color-text-ghost);cursor:pointer;font-size:11px;" onclick="deleteCapture(' + c.id + ')">remove</button>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--color-text-dim);">' +
            (c.category || '') + ' &middot; ' + (c.area || '') +
            (c.phone ? ' &middot; ' + c.phone : '') +
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
      // Strip photos for clean export
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

  // Online notification
  window.addEventListener('online', function() {
    obiDB.getAllCaptures().then(function(captures) {
      if (captures.length > 0) {
        showFormStatus('field-form', 'You\'re back online! ' + captures.length + ' captures ready to export.', false);
      }
    });
  });
})();
