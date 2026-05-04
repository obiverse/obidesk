/* obiDesk — Directory Browser */

(function() {
  renderHeader('browse');
  renderFooter();

  var _categories, _areas, _businesses, _businessesJson;
  var _wasmSearch = null;
  var filterCat = getParam('cat') || '';
  var filterArea = getParam('area') || '';
  var filterQ = getParam('q') || '';

  // Try to load WASM search (progressive enhancement)
  function initWasmSearch(json) {
    try {
      import('./pkg/desk-search/desk_search.js').then(function(mod) {
        return mod.default().then(function() {
          _wasmSearch = new mod.DeskSearch(json);
          console.log('[obiDesk] WASM search loaded (' + _wasmSearch.count() + ' businesses)');
        });
      }).catch(function() {
        console.log('[obiDesk] WASM unavailable, using JS search');
      });
    } catch(e) {
      // import() not supported or module not found
    }
  }

  Promise.all([
    loadJSON('data/categories.json'),
    loadJSON('data/areas.json'),
    fetch('data/businesses.json').then(function(r) { return r.text(); })
  ]).then(function(data) {
    _categories = data[0];
    _areas = data[1];
    _businessesJson = data[2];
    _businesses = JSON.parse(_businessesJson);
    initWasmSearch(_businessesJson);
    populateFilters();
    applyFilters();
    bindEvents();
  });

  function populateFilters() {
    var catSel = document.getElementById('filter-cat');
    _categories.forEach(function(cat) {
      var opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.emoji + ' ' + cat.name;
      catSel.appendChild(opt);
    });
    catSel.value = filterCat;

    var areaSel = document.getElementById('filter-area');
    _areas.forEach(function(area) {
      var opt = document.createElement('option');
      opt.value = area.id;
      opt.textContent = area.name;
      areaSel.appendChild(opt);
    });
    areaSel.value = filterArea;

    document.getElementById('search-input').value = filterQ;
  }

  function applyFilters() {
    filterCat = document.getElementById('filter-cat').value;
    filterArea = document.getElementById('filter-area').value;
    filterQ = document.getElementById('search-input').value.trim();

    var results;

    if (_wasmSearch) {
      // WASM fuzzy search: returns [{slug, score}, ...]
      var wasmResults = JSON.parse(_wasmSearch.search(filterQ, filterCat, filterArea, 50));
      var slugSet = {};
      wasmResults.forEach(function(r) { slugSet[r.slug] = true; });
      results = _businesses.filter(function(b) { return slugSet[b.slug]; });
      // Preserve WASM ordering
      results.sort(function(a, b) {
        var ia = wasmResults.findIndex(function(r) { return r.slug === a.slug; });
        var ib = wasmResults.findIndex(function(r) { return r.slug === b.slug; });
        return ia - ib;
      });
    } else {
      // JS fallback: simple includes matching
      var q = filterQ.toLowerCase();
      results = _businesses.filter(function(biz) {
        if (filterCat && biz.categoryIds.indexOf(filterCat) === -1) return false;
        if (filterArea && biz.areaId !== filterArea) return false;
        if (q) {
          var haystack = [
            biz.name, biz.tagline, biz.description,
            biz.services.join(' '), biz.tags.join(' ')
          ].join(' ').toLowerCase();
          if (haystack.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    // Update URL
    var params = new URLSearchParams();
    if (filterCat) params.set('cat', filterCat);
    if (filterArea) params.set('area', filterArea);
    if (filterQ) params.set('q', filterQ);
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));

    // Update title
    var title = 'All Businesses';
    if (filterCat) title = categoryName(_categories, filterCat);
    if (filterArea) title = areaName(_areas, filterArea) + (filterCat ? ' — ' + categoryName(_categories, filterCat) : '');
    if (filterQ) title = 'Search: ' + filterQ;
    document.getElementById('browse-title').textContent = title;
    document.getElementById('result-count').textContent = results.length + ' found';

    // Render
    var grid = document.getElementById('results');
    var noResults = document.getElementById('no-results');
    if (results.length === 0) {
      grid.innerHTML = '';
      noResults.style.display = 'block';
    } else {
      noResults.style.display = 'none';
      grid.innerHTML = results.map(function(b) {
        return renderBusinessCard(b, _categories, _areas);
      }).join('');
      // Trigger staggered reveal
      if (window.revealCards) revealCards();
    }
  }

  function bindEvents() {
    document.getElementById('filter-cat').addEventListener('change', applyFilters);
    document.getElementById('filter-area').addEventListener('change', applyFilters);

    var searchInput = document.getElementById('search-input');
    var debounce;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounce);
      debounce = setTimeout(applyFilters, 200);
    });
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { clearTimeout(debounce); applyFilters(); }
    });
  }

  window.clearFilters = function() {
    document.getElementById('filter-cat').value = '';
    document.getElementById('filter-area').value = '';
    document.getElementById('search-input').value = '';
    filterCat = ''; filterArea = ''; filterQ = '';
    applyFilters();
  };
})();
