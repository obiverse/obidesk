/* ═══════════════════════════════════════════════
   obiReceipt — Invoice/Receipt Engine
   Fill forms. Preview live. Print. Share. Get paid.
   ═══════════════════════════════════════════════ */

(function() {

  var NIGERIAN_BANKS = [
    'Access Bank', 'Zenith Bank', 'GTBank', 'First Bank', 'UBA',
    'Fidelity Bank', 'Union Bank', 'Stanbic IBTC', 'Sterling Bank',
    'Wema Bank', 'Keystone Bank', 'Polaris Bank', 'FCMB', 'Ecobank',
    'Jaiz Bank', 'Kuda', 'Opay', 'Moniepoint', 'PalmPay', 'Carbon'
  ];

  var lineItems = [{ description: '', quantity: 1, unitPrice: 0 }];
  var currentInvoice = null;

  /* ══════════════════════════════════════════════
     RECEIPT CREATOR PAGE (receipt.html)
     ══════════════════════════════════════════════ */

  window.initReceiptPage = function() {
    renderHeader('receipts');
    renderFooter();

    populateBankDropdown();
    renderLineItems();

    // Load business profile for auto-fill
    obiDB.init().then(function() {
      return obiDB.getBusinessProfile();
    }).then(function(profile) {
      if (profile) {
        fillBusinessFields(profile);
        // Collapse business section if profile exists
        var det = document.getElementById('biz-details');
        if (det) det.open = false;
      }
    });

    // Load existing invoice or start new
    var id = getParam('id');
    var dup = getParam('dup');
    if (id) {
      obiDB.getInvoice(parseInt(id)).then(function(inv) {
        if (inv) loadInvoiceIntoForm(inv);
        else renderPreview();
      });
    } else if (dup) {
      obiDB.getInvoice(parseInt(dup)).then(function(inv) {
        if (inv) {
          delete inv.id;
          inv.invoiceNumber = null;
          inv.status = 'draft';
          loadInvoiceIntoForm(inv);
        }
        renderPreview();
      });
    } else {
      renderPreview();
    }

    // Live preview on every input
    var form = document.querySelector('.receipt-form-panel');
    if (form) {
      form.addEventListener('input', renderPreview);
      form.addEventListener('change', renderPreview);
    }

    // Mobile tabs
    var tabs = document.querySelectorAll('.receipt-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = this.getAttribute('data-tab');
        showTab(target);
      });
    });
  };

  /* ── Bank Dropdown ─────────────────────────── */
  function populateBankDropdown() {
    var sel = document.getElementById('f-bankName');
    if (!sel) return;
    NIGERIAN_BANKS.forEach(function(bank) {
      var opt = document.createElement('option');
      opt.value = bank;
      opt.textContent = bank;
      sel.appendChild(opt);
    });
  }

  /* ── Business Fields Auto-fill ─────────────── */
  function fillBusinessFields(profile) {
    var fields = {
      'f-bizName': profile.name,
      'f-bizPhone': profile.phone,
      'f-bizEmail': profile.email,
      'f-bizAddress': profile.address,
      'f-bankName': profile.bankName,
      'f-accountNumber': profile.accountNumber,
      'f-accountName': profile.accountName,
      'f-invoicePrefix': profile.invoicePrefix || 'OBI'
    };
    for (var id in fields) {
      var el = document.getElementById(id);
      if (el && fields[id]) el.value = fields[id];
    }
  }

  /* ── Load Invoice Into Form ────────────────── */
  function loadInvoiceIntoForm(inv) {
    currentInvoice = inv;
    lineItems = inv.items && inv.items.length ? inv.items : [{ description: '', quantity: 1, unitPrice: 0 }];

    var map = {
      'f-bizName': inv.businessName, 'f-bizPhone': inv.businessPhone,
      'f-bizEmail': inv.businessEmail, 'f-bizAddress': inv.businessAddress,
      'f-bankName': inv.bankName, 'f-accountNumber': inv.accountNumber,
      'f-accountName': inv.accountName,
      'f-clientName': inv.clientName, 'f-clientPhone': inv.clientPhone,
      'f-clientEmail': inv.clientEmail,
      'f-notes': inv.notes, 'f-dueDate': inv.dueDate,
      'f-discount': inv.discount || 0
    };
    for (var id in map) {
      var el = document.getElementById(id);
      if (el && map[id] !== undefined) el.value = map[id];
    }

    var vatCheck = document.getElementById('f-vat');
    if (vatCheck) vatCheck.checked = (inv.taxRate || 0) > 0;

    renderLineItems();
    renderPreview();
  }

  /* ── Line Items ────────────────────────────── */
  window.addLineItem = function() {
    lineItems.push({ description: '', quantity: 1, unitPrice: 0 });
    renderLineItems();
    renderPreview();
    // Focus the new description field
    var inputs = document.querySelectorAll('.li-desc');
    if (inputs.length) inputs[inputs.length - 1].focus();
  };

  window.removeLineItem = function(i) {
    if (lineItems.length <= 1) return;
    lineItems.splice(i, 1);
    renderLineItems();
    renderPreview();
  };

  window.updateLineItem = function(i, field, value) {
    lineItems[i][field] = field === 'description' ? value : (parseFloat(value) || 0);
    // Update total display without full re-render
    var totalEl = document.getElementById('li-total-' + i);
    if (totalEl) totalEl.textContent = formatNaira(lineItems[i].quantity * lineItems[i].unitPrice);
    renderPreview();
  };

  function renderLineItems() {
    var container = document.getElementById('line-items');
    if (!container) return;
    container.innerHTML = lineItems.map(function(item, i) {
      var total = item.quantity * item.unitPrice;
      return '<div class="line-item-row">' +
        '<input class="form-input li-desc" placeholder="Description" value="' + (item.description || '').replace(/"/g, '&quot;') + '" oninput="updateLineItem(' + i + ',\'description\',this.value)">' +
        '<input class="form-input" type="number" min="1" value="' + (item.quantity || 1) + '" oninput="updateLineItem(' + i + ',\'quantity\',this.value)">' +
        '<input class="form-input" type="number" min="0" step="100" value="' + (item.unitPrice || 0) + '" oninput="updateLineItem(' + i + ',\'unitPrice\',this.value)" placeholder="Price">' +
        '<div class="line-item-total" id="li-total-' + i + '">' + formatNaira(total) + '</div>' +
        '<button class="line-item-remove" onclick="removeLineItem(' + i + ')" title="Remove">&times;</button>' +
      '</div>';
    }).join('');
  }

  /* ── Calculations ──────────────────────────── */
  function calculateTotals() {
    var subtotal = 0;
    for (var i = 0; i < lineItems.length; i++) {
      lineItems[i].total = (lineItems[i].quantity || 0) * (lineItems[i].unitPrice || 0);
      subtotal += lineItems[i].total;
    }

    var vatCheck = document.getElementById('f-vat');
    var taxRate = (vatCheck && vatCheck.checked) ? 7.5 : 0;
    var taxAmount = subtotal * (taxRate / 100);

    var discountValue = parseFloat((document.getElementById('f-discount') || {}).value) || 0;
    var total = subtotal + taxAmount - discountValue;

    return {
      subtotal: subtotal,
      taxRate: taxRate,
      taxAmount: taxAmount,
      discount: discountValue,
      total: Math.max(0, total)
    };
  }

  /* ── Gather Form Data ──────────────────────── */
  function gatherInvoiceData(totals) {
    return {
      invoiceNumber: currentInvoice ? currentInvoice.invoiceNumber : null,
      status: currentInvoice ? currentInvoice.status : 'draft',
      businessName: (document.getElementById('f-bizName') || {}).value || '',
      businessPhone: (document.getElementById('f-bizPhone') || {}).value || '',
      businessEmail: (document.getElementById('f-bizEmail') || {}).value || '',
      businessAddress: (document.getElementById('f-bizAddress') || {}).value || '',
      bankName: (document.getElementById('f-bankName') || {}).value || '',
      accountNumber: (document.getElementById('f-accountNumber') || {}).value || '',
      accountName: (document.getElementById('f-accountName') || {}).value || '',
      clientName: (document.getElementById('f-clientName') || {}).value || '',
      clientPhone: (document.getElementById('f-clientPhone') || {}).value || '',
      clientEmail: (document.getElementById('f-clientEmail') || {}).value || '',
      items: lineItems.filter(function(li) { return li.description; }),
      subtotal: totals.subtotal,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      discount: totals.discount,
      discountType: 'flat',
      total: totals.total,
      currency: 'NGN',
      notes: (document.getElementById('f-notes') || {}).value || '',
      dueDate: (document.getElementById('f-dueDate') || {}).value || ''
    };
  }

  /* ── Live Preview ──────────────────────────── */
  function renderPreview() {
    var el = document.getElementById('invoice-preview');
    if (!el) return;
    var totals = calculateTotals();
    var data = gatherInvoiceData(totals);
    el.innerHTML = buildInvoiceHTML(data, totals);

    // Update totals summary in form
    var summaryEl = document.getElementById('totals-summary');
    if (summaryEl) {
      summaryEl.innerHTML =
        '<div class="totals-row"><span>Subtotal</span><span>' + formatNaira(totals.subtotal) + '</span></div>' +
        (totals.taxRate ? '<div class="totals-row"><span>VAT (' + totals.taxRate + '%)</span><span>' + formatNaira(totals.taxAmount) + '</span></div>' : '') +
        (totals.discount ? '<div class="totals-row"><span>Discount</span><span>-' + formatNaira(totals.discount) + '</span></div>' : '') +
        '<div class="totals-row total-final"><span>Total</span><span>' + formatNaira(totals.total) + '</span></div>';
    }
  }

  function buildInvoiceHTML(data, totals) {
    var today = new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });

    var itemsRows = (data.items || []).map(function(item) {
      return '<tr>' +
        '<td>' + (item.description || '') + '</td>' +
        '<td>' + (item.quantity || 0) + '</td>' +
        '<td>' + formatNaira(item.unitPrice || 0) + '</td>' +
        '<td>' + formatNaira(item.total || 0) + '</td>' +
      '</tr>';
    }).join('');

    return '' +
    '<div class="inv-header">' +
      '<div>' +
        '<div class="inv-biz-name">' + (data.businessName || 'Your Business') + '</div>' +
        '<div class="inv-biz-info">' +
          (data.businessAddress ? data.businessAddress + '<br>' : '') +
          (data.businessPhone ? data.businessPhone : '') +
          (data.businessEmail ? ' &middot; ' + data.businessEmail : '') +
        '</div>' +
      '</div>' +
      '<div class="inv-meta">' +
        '<div class="inv-invoice-label">Invoice</div>' +
        '<div class="inv-invoice-number">' + (data.invoiceNumber || 'NEW') + '</div>' +
        '<div class="inv-date">' + today + '</div>' +
        (data.dueDate ? '<div class="inv-date" style="color:#c97d1d;">Due: ' + data.dueDate + '</div>' : '') +
      '</div>' +
    '</div>' +

    '<div class="inv-client-section">' +
      '<div class="inv-section-label">Bill To</div>' +
      '<div class="inv-client-name">' + (data.clientName || 'Client Name') + '</div>' +
      '<div class="inv-client-info">' +
        (data.clientPhone || '') +
        (data.clientEmail ? ' &middot; ' + data.clientEmail : '') +
      '</div>' +
    '</div>' +

    '<table class="inv-table">' +
      '<thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>' +
      '<tbody>' + (itemsRows || '<tr><td colspan="4" style="color:#ccc;font-style:italic;">Add items...</td></tr>') + '</tbody>' +
    '</table>' +

    '<div class="inv-totals">' +
      '<div class="inv-totals-row"><span>Subtotal</span><span>' + formatNaira(totals.subtotal) + '</span></div>' +
      (totals.taxRate ? '<div class="inv-totals-row"><span>VAT (' + totals.taxRate + '%)</span><span>' + formatNaira(totals.taxAmount) + '</span></div>' : '') +
      (totals.discount ? '<div class="inv-totals-row"><span>Discount</span><span>-' + formatNaira(totals.discount) + '</span></div>' : '') +
      '<div class="inv-totals-row final"><span>Total</span><span class="inv-total-amount">' + formatNaira(totals.total) + '</span></div>' +
    '</div>' +

    (data.bankName ? '<div class="inv-bank">' +
      '<div class="inv-bank-title">Payment Details</div>' +
      '<div class="inv-bank-detail">' +
        '<strong>Bank:</strong> ' + data.bankName + '<br>' +
        '<strong>Account:</strong> ' + (data.accountNumber || '') + '<br>' +
        '<strong>Name:</strong> ' + (data.accountName || '') +
      '</div>' +
    '</div>' : '') +

    (data.notes ? '<div class="inv-notes">' + data.notes + '</div>' : '') +

    '<div class="inv-footer">' +
      'Generated by <a href="https://obiverse.github.io/obidesk/">obiDesk</a> \u2014 obiverse.net' +
    '</div>';
  }

  /* ── Save Invoice ──────────────────────────── */
  window.saveInvoice = function() {
    var totals = calculateTotals();
    var data = gatherInvoiceData(totals);

    if (!data.clientName) {
      showFormStatus('receipt-actions-wrap', 'Client name is required.', true);
      return;
    }
    if (!data.items.length) {
      showFormStatus('receipt-actions-wrap', 'Add at least one item.', true);
      return;
    }

    obiDB.init().then(function() {
      if (currentInvoice && currentInvoice.id) {
        // Update existing
        data.id = currentInvoice.id;
        data.invoiceNumber = currentInvoice.invoiceNumber;
        data.createdAt = currentInvoice.createdAt;
        data.updatedAt = new Date().toISOString();
        return obiDB.saveInvoice(data).then(function() {
          currentInvoice = data;
          showFormStatus('receipt-actions-wrap', 'Invoice updated!', false);
        });
      } else {
        // New invoice — generate number
        data.createdAt = new Date().toISOString();
        data.updatedAt = data.createdAt;
        return generateInvoiceNumber().then(function(num) {
          data.invoiceNumber = num;
          return obiDB.saveInvoice(data);
        }).then(function(id) {
          data.id = id;
          currentInvoice = data;
          history.replaceState(null, '', 'receipt.html?id=' + id);
          showFormStatus('receipt-actions-wrap', 'Invoice ' + data.invoiceNumber + ' saved!', false);
          renderPreview();
        });
      }
    }).then(function() {
      // Save business profile for future auto-fill
      saveCurrentProfile();
    });
  };

  function generateInvoiceNumber() {
    return obiDB.getBusinessProfile().then(function(profile) {
      profile = profile || {};
      var prefix = (document.getElementById('f-invoicePrefix') || {}).value || profile.invoicePrefix || 'OBI';
      var count = (profile.invoiceCount || 0) + 1;
      profile.invoiceCount = count;
      profile.invoicePrefix = prefix;
      return obiDB.saveBusinessProfile(profile).then(function() {
        return prefix + '-' + ('000' + count).slice(-3);
      });
    });
  }

  function saveCurrentProfile() {
    var profile = {
      name: (document.getElementById('f-bizName') || {}).value || '',
      phone: (document.getElementById('f-bizPhone') || {}).value || '',
      email: (document.getElementById('f-bizEmail') || {}).value || '',
      address: (document.getElementById('f-bizAddress') || {}).value || '',
      bankName: (document.getElementById('f-bankName') || {}).value || '',
      accountNumber: (document.getElementById('f-accountNumber') || {}).value || '',
      accountName: (document.getElementById('f-accountName') || {}).value || '',
      invoicePrefix: (document.getElementById('f-invoicePrefix') || {}).value || 'OBI'
    };
    // Preserve invoiceCount
    return obiDB.getBusinessProfile().then(function(existing) {
      if (existing && existing.invoiceCount) profile.invoiceCount = existing.invoiceCount;
      return obiDB.saveBusinessProfile(profile);
    });
  }

  /* ── Print ─────────────────────────────────── */
  window.printInvoice = function() {
    // Ensure preview is visible for print
    var preview = document.querySelector('.receipt-preview-panel');
    if (preview) preview.classList.add('tab-active');
    renderPreview();
    setTimeout(function() { window.print(); }, 100);
  };

  /* ── WhatsApp Share ────────────────────────── */
  window.shareInvoice = function() {
    var totals = calculateTotals();
    var data = gatherInvoiceData(totals);

    var msg = 'INVOICE ' + (data.invoiceNumber || 'NEW') + '\n' +
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
      'From: ' + (data.businessName || '') + '\n' +
      'To: ' + (data.clientName || '') + '\n' +
      'Amount: ' + formatNaira(data.total) + '\n';

    if (data.dueDate) msg += 'Due: ' + data.dueDate + '\n';

    if (data.bankName) {
      msg += '\nPayment Details:\n' +
        'Bank: ' + data.bankName + '\n' +
        'Account: ' + data.accountNumber + '\n' +
        'Name: ' + data.accountName + '\n';
    }

    if (data.items.length) {
      msg += '\nItems:\n';
      data.items.forEach(function(item) {
        msg += '\u2022 ' + item.description + ' x' + item.quantity + ' = ' + formatNaira(item.total) + '\n';
      });
    }

    msg += '\n\u2014 Generated by obiDesk\nhttps://obiverse.github.io/obidesk/';

    var clientPhone = (data.clientPhone || '').replace(/\D/g, '');
    if (clientPhone.startsWith('0')) clientPhone = '234' + clientPhone.slice(1);
    window.open(whatsappUrl(clientPhone, msg), '_blank');
  };

  /* ── Mobile Tabs ───────────────────────────── */
  function showTab(tab) {
    var formPanel = document.querySelector('.receipt-form-panel');
    var previewPanel = document.querySelector('.receipt-preview-panel');
    var tabs = document.querySelectorAll('.receipt-tab');

    tabs.forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-tab') === tab); });

    if (tab === 'form') {
      if (formPanel) formPanel.classList.remove('tab-hidden');
      if (previewPanel) previewPanel.classList.remove('tab-active');
    } else {
      if (formPanel) formPanel.classList.add('tab-hidden');
      if (previewPanel) previewPanel.classList.add('tab-active');
      renderPreview();
    }
  }

  /* ══════════════════════════════════════════════
     RECEIPTS LIST PAGE (receipts.html)
     ══════════════════════════════════════════════ */

  window.initReceiptsPage = function() {
    renderHeader('receipts');
    renderFooter();
    obiDB.init().then(loadDashboard);
  };

  var _allInvoices = [];
  var _statusFilter = '';

  function loadDashboard() {
    obiDB.getAllInvoices().then(function(invoices) {
      _allInvoices = invoices;

      // Dashboard stats
      var totalInvoiced = 0, totalPaid = 0, outstanding = 0;
      invoices.forEach(function(inv) {
        totalInvoiced += inv.total || 0;
        if (inv.status === 'paid') totalPaid += inv.total || 0;
        if (inv.status === 'sent' || inv.status === 'overdue') outstanding += inv.total || 0;
      });

      var dashEl = document.getElementById('dash-cards');
      if (dashEl) {
        dashEl.innerHTML =
          '<div class="dash-card"><div class="dash-value">' + formatNaira(totalInvoiced) + '</div><div class="dash-label">Total Invoiced</div></div>' +
          '<div class="dash-card"><div class="dash-value">' + formatNaira(totalPaid) + '</div><div class="dash-label">Total Paid</div></div>' +
          '<div class="dash-card"><div class="dash-value" style="color:' + (outstanding > 0 ? '#f59e0b' : 'var(--gold-bright)') + ';">' + formatNaira(outstanding) + '</div><div class="dash-label">Outstanding</div></div>' +
          '<div class="dash-card"><div class="dash-value">' + invoices.length + '</div><div class="dash-label">Invoices</div></div>';
      }

      // Hero stat
      var statEl = document.getElementById('stat-outstanding');
      if (statEl) statEl.textContent = formatNaira(outstanding);
      var countEl = document.getElementById('stat-count');
      if (countEl) countEl.textContent = invoices.length + ' invoice' + (invoices.length !== 1 ? 's' : '');

      renderInvoiceList();
    });
  }

  window.setStatusFilter = function(el) {
    var pills = document.querySelectorAll('#status-filters .toggle-pill');
    pills.forEach(function(p) { p.classList.remove('active'); });
    el.classList.add('active');
    _statusFilter = el.getAttribute('data-value');
    renderInvoiceList();
  };

  window.searchInvoices = function(query) {
    renderInvoiceList(query);
  };

  function renderInvoiceList(searchQuery) {
    var query = searchQuery || (document.getElementById('inv-search') || {}).value || '';
    query = query.toLowerCase();

    var filtered = _allInvoices.filter(function(inv) {
      if (_statusFilter && inv.status !== _statusFilter) return false;
      if (query) {
        var haystack = ((inv.invoiceNumber || '') + ' ' + (inv.clientName || '')).toLowerCase();
        if (haystack.indexOf(query) === -1) return false;
      }
      return true;
    });

    var grid = document.getElementById('invoices-grid');
    var noInvoices = document.getElementById('no-invoices');

    if (!_allInvoices.length) {
      grid.innerHTML = '';
      if (noInvoices) noInvoices.style.display = 'block';
      return;
    }

    if (noInvoices) noInvoices.style.display = filtered.length ? 'none' : 'block';

    grid.innerHTML = filtered.map(function(inv) {
      var statusClass = 'status-' + (inv.status || 'draft');
      return '<a class="biz-card" href="receipt.html?id=' + inv.id + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.25rem;">' +
          '<div class="biz-card-name" style="font-family:var(--font-code);font-size:0.88rem;">' + (inv.invoiceNumber || 'DRAFT') + '</div>' +
          '<span class="badge ' + statusClass + '">' + (inv.status || 'draft') + '</span>' +
        '</div>' +
        '<div class="biz-card-tagline">' + (inv.clientName || 'No client') + '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div class="biz-card-meta"><span class="pill">' + formatNaira(inv.total) + '</span>' +
            (inv.dueDate ? '<span class="pill">Due ' + inv.dueDate + '</span>' : '') +
          '</div>' +
          '<div style="display:flex;gap:0.3rem;">' +
            '<button class="cta-btn" onclick="event.preventDefault();event.stopPropagation();togglePaid(' + inv.id + ')" style="font-size:0.6rem;">' +
              (inv.status === 'paid' ? '\u2713 Paid' : 'Mark Paid') +
            '</button>' +
            '<button class="cta-btn" onclick="event.preventDefault();event.stopPropagation();location.href=\'receipt.html?dup=' + inv.id + '\'" style="font-size:0.6rem;">Dup</button>' +
          '</div>' +
        '</div>' +
      '</a>';
    }).join('');

    if (window.revealCards) revealCards();
  }

  window.togglePaid = function(id) {
    var inv = _allInvoices.find(function(i) { return i.id === id; });
    if (!inv) return;
    var newStatus = inv.status === 'paid' ? 'sent' : 'paid';
    obiDB.updateInvoiceStatus(id, newStatus).then(loadDashboard);
  };

})();
