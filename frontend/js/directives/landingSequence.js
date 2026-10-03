(function () {
  'use strict';

  angular.module('hmsApp').directive('landingSequence', ['$window', function ($window) {
    return {
      restrict: 'A',
      link: function (scope, element) {
        console.log('[LandingSequence] initialized');

        var imageElement = element[0];
        var section = imageElement.closest('.hms-cinematic-section');
        
        if (!section) {
          console.error('[LandingSequence] FAILED to find .hms-cinematic-section');
          return;
        }

        var totalFrames = 192;
        var frames = [];
        var loaded = [];
        
        for (var i = 0; i < totalFrames; i++) {
          frames.push(null);
          loaded.push(false);
        }
        
        function loadFrame(index, cb) {
          if (frames[index]) {
            if (cb) cb();
            return;
          }
          
          var img = new Image();
          var frameStr = (index + 1).toString().padStart(3, '0');
          img.src = 'assets/landing/hospital-sequence/frame-' + frameStr + '.jpg';
          frames[index] = img;
          
          img.onload = function() {
            loaded[index] = true;
            if (index === 0) {
              setFrame(0);
            }
            if (cb) cb();
          };
          
          img.onerror = function() {
            console.error('[LandingSequence] FAILED to load frame index', index, img.src);
          };
        }
        
        // Immediately preload first 20 frames
        for (var i = 0; i < 20; i++) {
          loadFrame(i);
        }
        
        // Progressively preload the rest to not block the main thread
        setTimeout(function() {
          for (var i = 20; i < totalFrames; i++) {
            loadFrame(i);
          }
        }, 150);

        var targetFrameIndex = 0;
        var lastRenderedIndex = -1;
        var rafId = null;

        function setFrame(index) {
          index = Math.max(0, Math.min(totalFrames - 1, index));
          
          // Safety: only update the visible img src if the preloaded image is ready.
          // Otherwise, we keep the last successfully rendered image to prevent a blank/blue screen.
          if (loaded[index]) {
            if (lastRenderedIndex !== index) {
              imageElement.src = frames[index].src; // Direct source switch, using preloaded URL
              lastRenderedIndex = index;
            }
          }
        }

        function updateStoryStage(index) {
          var newStep = -1; // Hero (kept for the first few frames)
          if (index >= 164) newStep = 6;
          else if (index >= 136) newStep = 5;
          else if (index >= 108) newStep = 4;
          else if (index >= 76) newStep = 3;
          else if (index >= 52) newStep = 2;
          else if (index >= 24) newStep = 1;
          else if (index >= 4) newStep = 0;
          
          if (scope.activeStep !== newStep) {
            scope.$evalAsync(function() {
              scope.activeStep = newStep;
            });
          }
        }

        function animateFrame() {
          setFrame(targetFrameIndex);
          updateStoryStage(targetFrameIndex);
          rafId = null; // We are NOT interpolating. Once painted, we clear rafId until next scroll event.
        }
        
        function updateScroll() {
          var rect = section.getBoundingClientRect();
          var scrollDistance = section.offsetHeight - window.innerHeight;
          var current = -rect.top;
          
          var progress = Math.max(0, Math.min(1, current / scrollDistance));
          targetFrameIndex = Math.round(progress * 191);
          
          if (!rafId) {
            rafId = window.requestAnimationFrame(animateFrame);
          }
        }
        
        var scrollHandler = function() {
          updateScroll();
        };
        
        window.addEventListener('scroll', scrollHandler, {passive: true});
        
        // Initial setup
        updateScroll();
        
        scope.$on('$destroy', function() {
          window.removeEventListener('scroll', scrollHandler);
          if (rafId) {
            window.cancelAnimationFrame(rafId);
          }
        });
      }
    };
  }]);

})();
