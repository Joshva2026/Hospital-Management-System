(function () {
  'use strict';

  /**
   * Scroll-scrubbed frame sequence drawn on a <canvas>.
   * Usage: <canvas landing-sequence class="hms-cinematic__image"></canvas>
   * Must sit inside a .hms-cinematic-section (the scroll track).
   */
  angular.module('hmsApp').directive('landingSequence', ['$window', function ($window) {
    return {
      restrict: 'A',
      link: function (scope, element) {
        var canvas = element[0];
        var section = canvas.closest('.hms-cinematic-section');
        if (!section || !canvas.getContext) return;

        var ctx = canvas.getContext('2d');
        var TOTAL = 192;
        var FRAME_PATH = 'assets/landing/hospital-sequence/frame-';
        var reduceMotion = false;
        try {
          reduceMotion = $window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) { reduceMotion = false; }

        var frames = new Array(TOTAL);   // HTMLImageElement or null
        var ready = new Array(TOTAL);    // true once decoded
        var target = 0;                  // frame wanted by scroll position
        var current = 0;                 // frame currently drawn (eased)
        var drawnIndex = -1;
        var rafId = null;
        var inView = true;
        var destroyed = false;
        var stage = null;

        // Frame path, zero-padded to 3 digits (frame-001.jpg ... frame-192.jpg).
        function src(i) {
          return FRAME_PATH + String(i + 1).padStart(3, '0') + '.jpg';
        }

        function loadFrame(i) {
          if (i < 0 || i >= TOTAL || frames[i]) return;
          var img = new Image();
          frames[i] = img;
          img.onload = function () {
            ready[i] = true;
            if (i === Math.round(current)) requestDraw();
          };
          img.onerror = function () { frames[i] = null; };
          img.src = src(i);
        }

        // Priority loading: a sparse set first, then the rest in small batches,
        // so the first paint is fast and the main thread is not blocked.
        function preload() {
          var order = [0];
          for (var i = 8; i < TOTAL; i += 8) order.push(i);
          order.forEach(loadFrame);

          var rest = [];
          for (var j = 0; j < TOTAL; j++) if (!frames[j]) rest.push(j);
          var pos = 0;
          (function batch() {
            if (destroyed) return;
            for (var k = 0; k < 6 && pos < rest.length; k++, pos++) loadFrame(rest[pos]);
            if (pos < rest.length) setTimeout(batch, 120);
          })();
        }

        // Draw an image with "object-fit: cover" behavior.
        function drawCover(img) {
          var cw = canvas.width, ch = canvas.height;
          var iw = img.naturalWidth, ih = img.naturalHeight;
          var s = Math.max(cw / iw, ch / ih);
          var dw = iw * s, dh = ih * s;
          ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
        }

        function resize() {
          var dpr = Math.min($window.devicePixelRatio || 1, 2);
          var w = canvas.clientWidth, h = canvas.clientHeight;
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          drawnIndex = -1; // force a redraw at the new size
          requestDraw();
        }

        // Find the nearest decoded frame if the exact one is not ready yet.
        function bestAvailable(i) {
          if (ready[i]) return i;
          for (var d = 1; d < TOTAL; d++) {
            if (ready[i - d]) return i - d;
            if (ready[i + d]) return i + d;
          }
          return -1;
        }

        function draw() {
          var idx = bestAvailable(Math.round(current));
          if (idx === -1) return;
          if (idx === drawnIndex && !reduceMotion) return;
          drawnIndex = idx;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawCover(frames[idx]);
        }

        function updateStage(index) {
          var s = -1;
          if (index >= 164) s = 6;
          else if (index >= 136) s = 5;
          else if (index >= 108) s = 4;
          else if (index >= 76) s = 3;
          else if (index >= 52) s = 2;
          else if (index >= 24) s = 1;
          else if (index >= 4) s = 0;
          if (s !== stage) {
            stage = s;
            scope.$evalAsync(function () { scope.activeStep = s; });
          }
        }

        function readProgress() {
          var rect = section.getBoundingClientRect();
          var range = section.offsetHeight - $window.innerHeight;
          if (range <= 0) return 0;
          return Math.max(0, Math.min(1, -rect.top / range));
        }

        function tick() {
          rafId = null;
          if (destroyed) return;

          target = Math.round(readProgress() * (TOTAL - 1));
          if (reduceMotion) {
            current = target;               // no easing for reduced motion
          } else {
            current += (target - current) * 0.18; // smooth catch-up
            if (Math.abs(target - current) < 0.05) current = target;
          }

          draw();
          updateStage(Math.round(current));

          // Keep animating only while the value is still moving and the section is visible.
          if (inView && Math.abs(target - current) >= 0.05) requestDraw();
        }

        function requestDraw() {
          if (!rafId && !destroyed) rafId = $window.requestAnimationFrame(tick);
        }

        // Only run the loop while the section is on screen.
        var observer = null;
        if ($window.IntersectionObserver) {
          observer = new IntersectionObserver(function (entries) {
            inView = entries[0].isIntersecting;
            if (inView) requestDraw();
          });
          observer.observe(section);
        }

        function onScroll() { requestDraw(); }
        function onResize() { resize(); requestDraw(); }

        $window.addEventListener('scroll', onScroll, { passive: true });
        $window.addEventListener('resize', onResize, { passive: true });

        preload();
        resize();
        // Start at the Hero stage.
        scope.$evalAsync(function () { scope.activeStep = -1; });
        requestDraw();

        scope.$on('$destroy', function () {
          destroyed = true;
          $window.removeEventListener('scroll', onScroll);
          $window.removeEventListener('resize', onResize);
          if (observer) observer.disconnect();
          if (rafId) $window.cancelAnimationFrame(rafId);
          frames = []; // release image references
        });
      }
    };
  }]);
})();
