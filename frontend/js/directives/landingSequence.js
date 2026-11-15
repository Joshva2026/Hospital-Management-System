(function () {
  'use strict';

  angular.module('hmsApp').directive('landingSequence', ['$window', function ($window) {
    return {
      restrict: 'A',
      link: function (scope, element) {
        var imageElement = element[0];
        var section = imageElement.closest('.hms-cinematic-section');
        if (!section) return;

        var totalFrames = 192;
        var frames = [];
        var loaded = [];
        for (var i = 0; i < totalFrames; i++) { frames.push(null); loaded.push(false); }

        var targetFrameIndex = 0;
        var lastRenderedIndex = -1;
        var rafId = null;

        // Initialize frame 0 from the element if already loaded
        if (imageElement.complete && imageElement.naturalWidth > 0) {
          loaded[0] = true;
          frames[0] = imageElement;
          lastRenderedIndex = 0;
        } else {
          imageElement.onload = function () {
            loaded[0] = true;
            if (!frames[0]) frames[0] = imageElement;
            lastRenderedIndex = 0;
          };
        }

        function loadFrame(index) {
          if (frames[index]) return;
          var img = new Image();
          var frameStr = (index + 1).toString().padStart(3, '0');
          img.src = 'assets/landing/hospital-sequence/frame-' + frameStr + '.jpg';
          frames[index] = img;
          img.onload = function () {
            loaded[index] = true;
            if (index === 0) setFrame(0);
            if (Math.abs(targetFrameIndex - index) <= 2) {
              setFrame(targetFrameIndex);
            }
          };
        }

        // Always load frame-001 first
        loadFrame(0);
        for (var i = 1; i < 20; i++) loadFrame(i);
        setTimeout(function () {
          for (var i = 20; i < totalFrames; i++) loadFrame(i);
        }, 150);

        function setFrame(index) {
          index = Math.max(0, Math.min(totalFrames - 1, index));
          if (loaded[index]) {
            if (lastRenderedIndex !== index) {
              imageElement.src = frames[index].src;
              lastRenderedIndex = index;
            }
            return;
          }

          // Fallback to nearest loaded frame so the screen is never blank or empty
          for (var d = 1; d < totalFrames; d++) {
            if (index - d >= 0 && loaded[index - d]) {
              var fallbackPrev = index - d;
              if (lastRenderedIndex !== fallbackPrev) {
                imageElement.src = frames[fallbackPrev].src;
                lastRenderedIndex = fallbackPrev;
              }
              return;
            }
            if (index + d < totalFrames && loaded[index + d]) {
              var fallbackNext = index + d;
              if (lastRenderedIndex !== fallbackNext) {
                imageElement.src = frames[fallbackNext].src;
                lastRenderedIndex = fallbackNext;
              }
              return;
            }
          }

          if (loaded[0] && lastRenderedIndex !== 0) {
            imageElement.src = frames[0].src;
            lastRenderedIndex = 0;
          }
        }

        function updateStoryStage(index) {
          var newStep = -1;
          if (index >= 164) newStep = 6;
          else if (index >= 136) newStep = 5;
          else if (index >= 108) newStep = 4;
          else if (index >= 76) newStep = 3;
          else if (index >= 52) newStep = 2;
          else if (index >= 24) newStep = 1;
          else if (index >= 4) newStep = 0;

          if (scope.activeStep !== newStep) {
            scope.$evalAsync(function () { scope.activeStep = newStep; });
          }
        }

        function animateFrame() {
          setFrame(targetFrameIndex);
          updateStoryStage(targetFrameIndex);
          rafId = null;
        }

        function updateScroll() {
          var rect = section.getBoundingClientRect();
          var scrollDistance = section.offsetHeight - window.innerHeight;
          var current = -rect.top;
          var progress = Math.max(0, Math.min(1, current / scrollDistance));
          targetFrameIndex = Math.round(progress * 191);
          if (!rafId) rafId = window.requestAnimationFrame(animateFrame);
        }

        var scrollHandler = function () { updateScroll(); };
        window.addEventListener('scroll', scrollHandler, { passive: true });
        updateScroll();

        scope.$on('$destroy', function () {
          window.removeEventListener('scroll', scrollHandler);
          if (rafId) window.cancelAnimationFrame(rafId);
        });
      }
    };
  }]);
})();
