(function () {
  'use strict';

  /**
   * Scroll-scrubbed frame sequence on a <canvas>.
   * Phones get smaller frames and a smaller memory window.
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
        var isSmall = $window.innerWidth < 768;
        var FRAME_PATH = isSmall
          ? 'assets/landing/hospital-sequence-mobile/frame-'
          : 'assets/landing/hospital-sequence/frame-';
        var WINDOW = isSmall ? 8 : 12;   // frames kept in memory around the current position
        var reduceMotion = false;
        try {
          reduceMotion = $window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) { reduceMotion = false; }

        var frames = new Array(TOTAL);   // Image objects, or null when released
        var ready = new Array(TOTAL);    // true once decoded
        var target = 0;
        var current = 0;
        var lastCenter = -1;
        var drawnIndex = -1;
        var rafId = null;
        var inView = true;
        var destroyed = false;
        var stage = null;

        function src(i) {
          return FRAME_PATH + String(i + 1).padStart(3, '0') + '.jpg';
        }

        function loadFrame(i) {
          if (i < 0 || i >= TOTAL || frames[i]) return;
          var img = new Image();
          frames[i] = img;
          img.onload = function () {
            if (frames[i] === img) {
              ready[i] = true;
              requestDraw();
            }
          };
          img.onerror = function () {
            if (frames[i] === img) { frames[i] = null; ready[i] = false; }
          };
          img.src = src(i);
        }

        // Keep only frames near the current position. Release the rest so memory stays low.
        function updateWindow(center) {
          if (center === lastCenter) return;
          lastCenter = center;

          for (var i = 0; i < TOTAL; i++) {
            if (Math.abs(i - center) > WINDOW && frames[i]) {
              frames[i] = null;
              ready[i] = false;
            }
          }
          // Load the nearest frames first.
          for (var d = 0; d <= WINDOW; d++) {
            loadFrame(center - d);
            loadFrame(center + d);
          }
        }

        function drawCover(img) {
          var cw = canvas.width, ch = canvas.height;
          var iw = img.naturalWidth, ih = img.naturalHeight;
          var s = Math.max(cw / iw, ch / ih);
          var dw = iw * s, dh = ih * s;
          ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
        }

        function resize() {
          var dpr = Math.min($window.devicePixelRatio || 1, 2);
          canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
          canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
          drawnIndex = -1;
          requestDraw();
        }

        // Nearest decoded frame to the wanted index, or -1 if none is ready yet.
        function bestAvailable(i) {
          if (ready[i]) return i;
          for (var d = 1; d <= WINDOW + 1; d++) {
            if (i - d >= 0 && ready[i - d]) return i - d;
            if (i + d < TOTAL && ready[i + d]) return i + d;
          }
          return -1;
        }

        function draw() {
          var idx = bestAvailable(Math.round(current));
          if (idx === -1) return;                 // keep the last picture on screen
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
            current = target;
          } else {
            current += (target - current) * 0.18;
            if (Math.abs(target - current) < 0.05) current = target;
          }

          var c = Math.round(current);
          updateWindow(c);
          draw();
          updateStage(c);

          if (inView && Math.abs(target - current) >= 0.05) requestDraw();
        }

        function requestDraw() {
          if (!rafId && !destroyed) rafId = $window.requestAnimationFrame(tick);
        }

        var observer = null;
        if ($window.IntersectionObserver) {
          observer = new IntersectionObserver(function (entries) {
            inView = entries[0].isIntersecting;
            if (inView) requestDraw();
          });
          observer.observe(section);
        }

        function onScroll() { requestDraw(); }
        function onResize() { resize(); }

        $window.addEventListener('scroll', onScroll, { passive: true });
        $window.addEventListener('resize', onResize, { passive: true });
        $window.addEventListener('orientationchange', onResize, { passive: true });

        resize();
        scope.$evalAsync(function () { scope.activeStep = -1; });
        requestDraw();

        scope.$on('$destroy', function () {
          destroyed = true;
          $window.removeEventListener('scroll', onScroll);
          $window.removeEventListener('resize', onResize);
          $window.removeEventListener('orientationchange', onResize);
          if (observer) observer.disconnect();
          if (rafId) $window.cancelAnimationFrame(rafId);
          frames = [];
          ready = [];
        });
      }
    };
  }]);
})();
