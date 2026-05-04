/* obiDesk — PWA Engine
   Install prompt, offline awareness, SW update detection */

(function() {
  'use strict';

  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  var STORE_KEY = 'obidesk_pwa';

  function getStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch { return {}; }
  }

  function setStore(patch) {
    var s = getStore();
    Object.assign(s, patch);
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  // Inject styles
  var style = document.createElement('style');
  style.textContent =
    '.pwa-banner{position:fixed;bottom:0;left:0;right:0;z-index:9999;transform:translateY(100%);transition:transform .5s cubic-bezier(.16,1,.3,1);pointer-events:none}' +
    '.pwa-banner.visible{transform:translateY(0);pointer-events:auto}' +
    '.pwa-banner-inner{max-width:480px;margin:0 auto 1rem;padding:1.2rem 1.4rem;background:var(--color-void-medium,#0f1f38);border:1px solid var(--color-void-border,#1e3a5c);border-radius:14px;box-shadow:0 -4px 30px rgba(0,0,0,.4);font-family:var(--font-body);}' +
    '.pwa-banner-title{font-family:var(--font-display);font-size:1rem;font-weight:600;color:var(--color-fire-gold,#c97d1d);margin-bottom:.3rem}' +
    '.pwa-banner-text{font-size:.85rem;color:var(--color-text-dim,#8a7d6a);line-height:1.5;margin-bottom:.8rem}' +
    '.pwa-banner-actions{display:flex;gap:.6rem}' +
    '.pwa-btn{flex:1;padding:.6rem 1rem;border-radius:8px;cursor:pointer;font-family:var(--font-display);font-size:.9rem;font-weight:600;text-align:center;transition:all .2s}' +
    '.pwa-btn-primary{background:rgba(201,125,29,.12);border:1px solid rgba(201,125,29,.3);color:var(--color-fire-gold,#c97d1d)}' +
    '.pwa-btn-primary:hover{background:rgba(201,125,29,.2)}' +
    '.pwa-btn-dismiss{background:none;border:1px solid rgba(255,255,255,.06);color:var(--color-text-dim,#8a7d6a)}' +
    '.pwa-toast{position:fixed;top:1rem;left:50%;transform:translateX(-50%) translateY(-120%);z-index:9998;padding:.5rem 1rem;background:var(--color-void-medium,#0f1f38);border:1px solid var(--color-void-border,#1e3a5c);border-radius:8px;font-family:var(--font-mono);font-size:.7rem;color:var(--color-text-dim,#8a7d6a);transition:transform .4s cubic-bezier(.16,1,.3,1);white-space:nowrap;cursor:pointer}' +
    '.pwa-toast.visible{transform:translateX(-50%) translateY(0)}' +
    '.pwa-toast.update-toast{border-color:rgba(201,125,29,.3);color:var(--color-fire-gold,#c97d1d)}';
  document.head.appendChild(style);

  // Toast
  var toastTimer;
  function showToast(msg, opts) {
    opts = opts || {};
    var old = document.querySelector('.pwa-toast');
    if (old) old.remove();
    clearTimeout(toastTimer);
    var t = document.createElement('div');
    t.className = 'pwa-toast' + (opts.className ? ' ' + opts.className : '');
    t.textContent = msg;
    if (opts.onClick) t.addEventListener('click', opts.onClick);
    document.body.appendChild(t);
    requestAnimationFrame(function() { requestAnimationFrame(function() { t.classList.add('visible'); }); });
    var duration = opts.duration || 3000;
    if (duration > 0) {
      toastTimer = setTimeout(function() {
        t.classList.remove('visible');
        setTimeout(function() { t.remove(); }, 400);
      }, duration);
    }
  }

  // Service Worker
  var swRegistration = null;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(function(reg) {
        swRegistration = reg;
        setInterval(function() { reg.update(); }, 5 * 60 * 1000);

        reg.addEventListener('updatefound', function() {
          var newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', function() {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      })
      .catch(function() {});

    navigator.serviceWorker.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'UPDATE_AVAILABLE') {
        showUpdateToast();
      }
    });

    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }

  function showUpdateToast() {
    showToast('New content available \u2014 tap to refresh', {
      className: 'update-toast',
      duration: 0,
      onClick: function() {
        if (swRegistration && swRegistration.waiting) {
          swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      }
    });
  }

  // Install prompt (Chrome/Edge)
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function() {
    setStore({ installed: true });
    hideBanner();
    showToast('Installed \u2014 browse Abuja offline');
  });

  // Standalone welcome
  if (isStandalone) {
    var s = getStore();
    if (!s.welcomed) {
      setStore({ welcomed: true });
      showToast('obiDesk \u2014 browsing offline');
    }
    return;
  }

  // iOS/Safari banner after engagement
  if (isIOS && isSafari) {
    var s2 = getStore();
    if (!s2.dismissedAt || (Date.now() - s2.dismissedAt) > 7 * 86400000) {
      setTimeout(showInstallBanner, 15000);
    }
  }

  // Online/Offline
  window.addEventListener('online', function() { showToast('Back online'); });
  window.addEventListener('offline', function() { showToast('Browsing offline'); });

  // Install Banner
  var bannerEl = null;

  function showInstallBanner() {
    if (bannerEl) return;
    var s = getStore();
    if (s.installed || (s.dismissedAt && (Date.now() - s.dismissedAt) < 7 * 86400000)) return;

    bannerEl = document.createElement('div');
    bannerEl.className = 'pwa-banner';

    var action = deferredPrompt ? 'Install App' : (isIOS && isSafari) ? 'Add to Home Screen' : 'Bookmark to Install';

    bannerEl.innerHTML =
      '<div class="pwa-banner-inner">' +
        '<div class="pwa-banner-title">Browse Abuja businesses offline</div>' +
        '<div class="pwa-banner-text">Install obiDesk. Find businesses even without network.</div>' +
        '<div class="pwa-banner-actions">' +
          '<button class="pwa-btn pwa-btn-primary" id="pwa-install">' + action + '</button>' +
          '<button class="pwa-btn pwa-btn-dismiss" id="pwa-dismiss">Later</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bannerEl);
    requestAnimationFrame(function() { requestAnimationFrame(function() { bannerEl.classList.add('visible'); }); });

    document.getElementById('pwa-install').onclick = function() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function() { deferredPrompt = null; hideBanner(); });
      } else if (isIOS && isSafari) {
        showToast('Tap Share \u2192 Add to Home Screen');
        hideBanner();
      } else {
        hideBanner();
      }
    };

    document.getElementById('pwa-dismiss').onclick = function() {
      setStore({ dismissedAt: Date.now() });
      hideBanner();
    };
  }

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove('visible');
    setTimeout(function() { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 500);
  }
})();
