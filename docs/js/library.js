/* ═══════════════════════════════════════════════
   obiDesk Library — Canvas Background + Reveals
   Sacred geometry adapted from Letterverse.
   Nsibidi/Adinkra-inspired breathing patterns.
   ═══════════════════════════════════════════════ */

(function() {

  /* ── Canvas Background ─────────────────────── */
  var canvas = document.getElementById('bg-canvas');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;
    var t = 0;
    var running = true;
    // Reduce FPS on mobile for battery
    var isMobile = window.innerWidth < 768;
    var frameSkip = isMobile ? 3 : 1;
    var frameCount = 0;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function isDark() {
      return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    function draw() {
      if (!running) return;
      requestAnimationFrame(draw);
      frameCount++;
      if (frameCount % frameSkip !== 0) return;

      t += 0.008;
      ctx.clearRect(0, 0, w, h);

      var dark = isDark();
      var baseAlpha = dark ? 0.025 : 0.015;
      var breathe = 0.5 + 0.5 * Math.sin(t * 0.4);
      var alpha = baseAlpha + breathe * 0.015;
      var color = dark ? '201,125,29' : '158,107,27';

      // Seed of Life: central circle + 6 surrounding
      var cx = w * 0.5;
      var cy = h * 0.35;
      var r = Math.min(w, h) * 0.15;

      ctx.strokeStyle = 'rgba(' + color + ',' + alpha + ')';
      ctx.lineWidth = 0.8;

      // Central circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // 6 petals
      for (var i = 0; i < 6; i++) {
        var a = (i * Math.PI / 3) + t * 0.08;
        var px = cx + r * Math.cos(a);
        var py = cy + r * Math.sin(a);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radial glow
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
      grad.addColorStop(0, 'rgba(' + color + ',' + (alpha * 0.8) + ')');
      grad.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r * 2.5, cy - r * 2.5, r * 5, r * 5);

      // Second pattern: lower right, smaller, offset phase
      var cx2 = w * 0.82;
      var cy2 = h * 0.7;
      var r2 = r * 0.6;
      var alpha2 = alpha * 0.5;

      ctx.strokeStyle = 'rgba(' + color + ',' + alpha2 + ')';
      ctx.beginPath();
      ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
      ctx.stroke();

      for (var j = 0; j < 6; j++) {
        var a2 = (j * Math.PI / 3) + t * -0.06;
        ctx.beginPath();
        ctx.arc(cx2 + r2 * Math.cos(a2), cy2 + r2 * Math.sin(a2), r2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    resize();
    window.addEventListener('resize', resize);
    draw();

    // Pause when tab hidden
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        running = false;
      } else {
        running = true;
        draw();
      }
    });

    window.onThemeChange = function() { /* canvas reads theme each frame */ };
  }

  /* ── Section Reveal via IntersectionObserver ── */
  var revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -50px 0px', threshold: 0.1 });

    revealElements.forEach(function(el) {
      observer.observe(el);
    });
  }

  /* ── Business Card Staggered Reveal ──────────── */
  window.revealCards = function() {
    var cards = document.querySelectorAll('.biz-card:not(.revealed)');
    cards.forEach(function(card, i) {
      card.style.setProperty('--reveal-delay', (i * 0.06) + 's');
      // Trigger reveal on next frame
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          card.classList.add('revealed');
        });
      });
    });
  };

  /* ── Skeleton Cards ─────────────────────────── */
  window.showSkeletons = function(containerId, count) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var html = '';
    for (var i = 0; i < (count || 6); i++) {
      html += '<div class="skeleton-card"></div>';
    }
    container.innerHTML = html;
  };

  window.clearSkeletons = function(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var skeletons = container.querySelectorAll('.skeleton-card');
    skeletons.forEach(function(s) { s.remove(); });
  };

})();
