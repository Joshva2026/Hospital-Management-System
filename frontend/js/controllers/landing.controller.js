(function () {
  'use strict';

  angular.module('hmsApp').controller('LandingController', [
    '$scope',
    '$timeout',
    function ($scope, $timeout) {

      // =========================================================
      // PUBLIC LANDING ONLY
      // No backend/API dependency.
      // Existing LoginController / authenticated HMS untouched.
      // =========================================================

      $scope.showLoginModal = false;
      $scope.journeyIndex = 0;

      // ---------------------------------------------------------
      // Login modal
      // ---------------------------------------------------------

      $scope.openLoginModal = function () {
        $scope.showLoginModal = true;
      };

      $scope.closeLoginModal = function () {
        $scope.showLoginModal = false;
      };

      // ---------------------------------------------------------
      // Internal cleanup
      // ---------------------------------------------------------

      var cleanupFunctions = [];
      var destroyed = false;

      function addCleanup(fn) {
        cleanupFunctions.push(fn);
      }

      // ---------------------------------------------------------
      // Scroll-driven cinematic behavior
      // ---------------------------------------------------------

      function handleScroll() {
        if (destroyed) return;

        var page = document.querySelector('.hms-cinematic');

        if (!page) return;

        // -------------------------------------------------------
        // Navigation state
        // -------------------------------------------------------

        var hero = page.querySelector('.hms-hero');
        var nav = page.querySelector('.hms-nav');

        if (hero && nav) {
          var heroBottom =
            hero.getBoundingClientRect().bottom;

          if (heroBottom < 100) {
            nav.classList.add('is-scrolled');
          } else {
            nav.classList.remove('is-scrolled');
          }
        }

        // -------------------------------------------------------
        // Patient journey progress
        // -------------------------------------------------------

        var journey =
          page.querySelector('.hms-journey');

        if (!journey) return;

        var rect =
          journey.getBoundingClientRect();

        var totalScrollable =
          Math.max(
            1,
            journey.offsetHeight -
            window.innerHeight
          );

        var progress =
          (-rect.top) /
          totalScrollable;

        progress =
          Math.max(
            0,
            Math.min(1, progress)
          );

        // 7 journey stages
        var stage =
          Math.min(
            6,
            Math.floor(progress * 7)
          );

        if ($scope.journeyIndex !== stage) {
          $scope.$evalAsync(function () {
            $scope.journeyIndex = stage;
          });
        }

        // -------------------------------------------------------
        // Timeline progress
        // -------------------------------------------------------

        var progressBar =
          page.querySelector(
            '.hms-journey-progress'
          );

        if (progressBar) {
          progressBar.style.height =
            (progress * 100) + '%';
        }

        // -------------------------------------------------------
        // Main journey visual movement
        // -------------------------------------------------------

        var visual =
          page.querySelector(
            '.hms-journey-visual'
          );

        if (visual) {
          var movement =
            (progress - 0.5) * -18;

          visual.style.transform =
            'translate3d(0,' +
            movement +
            'px,0)';
        }

        // -------------------------------------------------------
        // Optional cinematic progress variable
        // Useful for CSS animations.
        // -------------------------------------------------------

        page.style.setProperty(
          '--hms-scroll-progress',
          progress.toFixed(4)
        );
      }

      // ---------------------------------------------------------
      // Reveal animations
      // ---------------------------------------------------------

      function setupRevealAnimations() {

        var page =
          document.querySelector(
            '.hms-cinematic'
          );

        if (!page) return;

        var elements =
          page.querySelectorAll(
            '[data-reveal]'
          );

        // -------------------------------------------------------
        // Fallback for older browsers
        // -------------------------------------------------------

        if (!('IntersectionObserver' in window)) {

          Array.prototype.forEach.call(
            elements,
            function (element) {
              element.classList.add(
                'is-visible'
              );
            }
          );

          return;
        }

        var observer =
          new IntersectionObserver(
            function (entries) {

              entries.forEach(
                function (entry) {

                  if (
                    entry.isIntersecting
                  ) {
                    entry.target.classList.add(
                      'is-visible'
                    );
                  }

                }
              );

            },
            {
              threshold: 0.12,
              rootMargin: '0px 0px -8% 0px'
            }
          );

        Array.prototype.forEach.call(
          elements,
          function (element) {
            observer.observe(element);
          }
        );

        addCleanup(function () {
          observer.disconnect();
        });
      }

      // ---------------------------------------------------------
      // Mouse / pointer depth effect
      // Lightweight and optional.
      // ---------------------------------------------------------

      function setupPointerMotion() {

        var page =
          document.querySelector(
            '.hms-cinematic'
          );

        if (!page) return;

        var hero =
          page.querySelector(
            '.hms-hero'
          );

        if (!hero) return;

        function handlePointerMove(event) {

          if (
            window.matchMedia(
              '(prefers-reduced-motion: reduce)'
            ).matches
          ) {
            return;
          }

          var rect =
            hero.getBoundingClientRect();

          var x =
            (event.clientX - rect.left) /
            rect.width;

          var y =
            (event.clientY - rect.top) /
            rect.height;

          var moveX =
            (x - 0.5) * 10;

          var moveY =
            (y - 0.5) * 8;

          hero.style.setProperty(
            '--hero-mouse-x',
            moveX.toFixed(2) + 'px'
          );

          hero.style.setProperty(
            '--hero-mouse-y',
            moveY.toFixed(2) + 'px'
          );
        }

        hero.addEventListener(
          'pointermove',
          handlePointerMove,
          { passive: true }
        );

        addCleanup(function () {
          hero.removeEventListener(
            'pointermove',
            handlePointerMove
          );
        });
      }

      // ---------------------------------------------------------
      // Initialisation
      // ---------------------------------------------------------

      function initializeLanding() {

        if (destroyed) return;

        setupRevealAnimations();
        setupPointerMotion();

        // Initial state
        handleScroll();

        // Make sure default content is visible
        var page =
          document.querySelector(
            '.hms-cinematic'
          );

        if (page) {
          page.classList.add(
            'hms-landing-ready'
          );
        }
      }

      // ---------------------------------------------------------
      // Event listeners
      // ---------------------------------------------------------

      window.addEventListener(
        'scroll',
        handleScroll,
        { passive: true }
      );

      window.addEventListener(
        'resize',
        handleScroll
      );

      addCleanup(function () {

        window.removeEventListener(
          'scroll',
          handleScroll
        );

        window.removeEventListener(
          'resize',
          handleScroll
        );

      });

      // Angular ng-view inserts the template
      // asynchronously, so initialize after render.
      $timeout(
        initializeLanding,
        100,
        false
      );

      // ---------------------------------------------------------
      // Destroy cleanup
      // ---------------------------------------------------------

      $scope.$on(
        '$destroy',
        function () {

          destroyed = true;

          cleanupFunctions.forEach(
            function (cleanup) {

              try {
                cleanup();
              } catch (error) {
                // Landing cleanup should never
                // affect the authenticated app.
              }

            }
          );

          cleanupFunctions = [];
        }
      );

    }
  ]);

})();