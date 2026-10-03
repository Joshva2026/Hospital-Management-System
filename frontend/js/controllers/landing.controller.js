(function () {
  'use strict';

  angular.module('hmsApp').controller('LandingController', [
    '$scope',
    '$timeout',
    function ($scope, $timeout) {

      /* ============================================================
         LOGIN MODAL — EXISTING FLOW PRESERVED
      ============================================================ */

      $scope.showLoginModal = false;

      $scope.openLoginModal = function () {
        $scope.showLoginModal = true;
      };

      $scope.closeLoginModal = function () {
        $scope.showLoginModal = false;
      };


      /* ============================================================
         LANDING PAGE DATA
      ============================================================ */

      $scope.navScrolled = false;

      // Registration is always the first stage.
      $scope.activeStep = -1;


      $scope.journeySteps = [
        {
          num: '01',
          label: 'PATIENT REGISTRATION',
          desc: 'Register and manage patient information from a centralized hospital record.'
        },
        {
          num: '02',
          label: 'OPD & VISITS',
          desc: 'Manage outpatient visits, doctors, specialities, complaints and treatment records.'
        },
        {
          num: '03',
          label: 'ADMISSION',
          desc: 'Seamless transition from outpatient to inpatient care, with the admission linked directly to the patient record.'
        },
        {
          num: '04',
          label: 'WARD MANAGEMENT',
          desc: 'Live visibility into ward occupancy and allocation, so the care team always knows where every patient is.'
        },
        {
          num: '05',
          label: 'BED ALLOCATION',
          desc: 'Granular, bed-level tracking keeps capacity, transfers and discharges accurate across the entire facility.'
        },
        {
          num: '06',
          label: 'DAILY MONITORING',
          desc: 'Ongoing vitals and daily progress stay visible to the authorized care team throughout the stay.'
        },
        {
          num: '07',
          label: 'REPORTS & DISCHARGE',
          desc: 'Daily and operational reports roll up automatically from every module into one reporting layer for administration and discharge.'
        }
      ];


      $scope.featureCards = [

        {
          icon: 'fa-solid fa-users',
          title: 'Patient Management',
          desc: 'Comprehensive profiles, history and interaction logs centralized in one secure record.'
        },

        {
          icon: 'fa-solid fa-bed',
          title: 'Ward & Bed Control',
          desc: 'Live occupancy visibility across wards and beds, with smooth transfers and discharges.'
        },

        {
          icon: 'fa-solid fa-user-doctor',
          title: 'Doctor Management',
          desc: 'Roster scheduling, OPD assignment and specialities managed from a single place.'
        },

        {
          icon: 'fa-solid fa-chart-line',
          title: 'Daily Reports',
          desc: 'Operational and clinical reporting generated directly from live hospital data.'
        },

        {
          icon: 'fa-solid fa-file-medical',
          title: 'Admission Workflows',
          desc: 'Digitized admission and discharge flows that reduce administrative overhead.'
        },

        {
          icon: 'fa-solid fa-chart-pie',
          title: 'Analytics',
          desc: 'A connected view of hospital performance across patients, beds and visits.'
        }

      ];


      /* ============================================================
         DOM / STATE
      ============================================================ */

      var MOBILE_BREAKPOINT = 992;

      var cleanupFns = [];

      var rootEl = null;

      var heroVisualEl = null;

      var journeyDeviceEl = null;

      var stepEls = [];

      var isMobile =
        window.innerWidth < MOBILE_BREAKPOINT;

      var ticking = false;

      var lastKnownScrollY = 0;

      var prefersReducedMotion = false;


      /* ============================================================
         REDUCED MOTION
      ============================================================ */

      try {

        prefersReducedMotion =
          window.matchMedia &&
          window.matchMedia(
            '(prefers-reduced-motion: reduce)'
          ).matches;

      } catch (e) {

        prefersReducedMotion = false;

      }


      /* ============================================================
         EVENT LISTENER HELPER
      ============================================================ */

      function addListener(
        target,
        type,
        handler,
        options
      ) {

        target.addEventListener(
          type,
          handler,
          options || false
        );


        cleanupFns.push(function () {

          target.removeEventListener(
            type,
            handler,
            options || false
          );

        });

      }


      /* ============================================================
         NAVIGATION
      ============================================================ */

      function updateNav() {

        var shouldBeScrolled =
          lastKnownScrollY > 40;


        if (
          shouldBeScrolled !==
          $scope.navScrolled
        ) {

          $scope.navScrolled =
            shouldBeScrolled;

          $scope.$applyAsync();

        }

      }


      /* ============================================================
         HERO PARALLAX
      ============================================================ */

      function updateHero() {

        if (
          !heroVisualEl ||
          isMobile ||
          prefersReducedMotion
        ) {

          return;

        }


        var offset =
          Math.min(
            lastKnownScrollY * 0.08,
            60
          );


        heroVisualEl.style.transform =
          'translate3d(0,' +
          offset +
          'px,0)';

      }


      /* ============================================================
         JOURNEY STAGE CHANGE
         
         IMPORTANT:

         public-home.html uses:

         ng-switch="activeStep"

         and:

         ng-switch-when="0"
         ng-switch-when="1"
         ...
         ng-switch-when="6"

         Therefore ONLY ONE hospital UI stage exists
         inside the device at any moment.

         Old stage:
              destroyed

         New stage:
              inserted

         This prevents stacking/overlapping.
      ============================================================ */

      function setActiveStep(index) {

        if (
          !$scope.journeySteps ||
          !$scope.journeySteps.length
        ) {

          return;

        }


        /* Keep index between 0 and 6. */

        index =
          Math.max(
            0,
            Math.min(
              index,
              $scope.journeySteps.length - 1
            )
          );


        /* Nothing to change. */

        if (
          index ===
          $scope.activeStep
        ) {

          return;

        }


        /*
         * Angular ng-switch changes the
         * actual hospital screen here.
         */
        $scope.activeStep = index;


        /*
         * Restart device transition.
         */
        $scope.$applyAsync(function () {

          if (!journeyDeviceEl) {

            return;

          }


          journeyDeviceEl.classList.remove(
            'hms-stage-changing'
          );


          /*
           * Force browser reflow so the
           * animation can restart.
           */
          void journeyDeviceEl.offsetWidth;


          journeyDeviceEl.classList.add(
            'hms-stage-changing'
          );

        });

      }


      /* ============================================================
         FIND CURRENT JOURNEY STAGE
         
         The LEFT SIDE contains:

         01 Registration
         02 OPD
         03 Admission
         04 Ward
         05 Bed
         06 Monitoring
         07 Reports

         Each item has real vertical space.

         When the item reaches the viewport
         center, the RIGHT SIDE device changes
         to the matching screen.
      ============================================================ */

      function calculateJourneyStep() {

        /*
         * On mobile the journey becomes
         * normal vertical content.
         */
        if (
          isMobile ||
          !stepEls.length
        ) {

          return;

        }


        var viewportMiddle =
          window.innerHeight * 0.5;


        var closestIndex =
          $scope.activeStep;


        var closestDistance =
          Infinity;


        for (
          var i = 0;
          i < stepEls.length;
          i++
        ) {

          var rect =
            stepEls[i].getBoundingClientRect();


          /*
           * Calculate the center of the
           * current left-side journey item.
           */
          var center =
            rect.top +
            (rect.height * 0.5);


          var distance =
            Math.abs(
              center -
              viewportMiddle
            );


          /*
           * Only visible journey items
           * participate in the calculation.
           */
          var visible =
            rect.bottom > 0 &&
            rect.top < window.innerHeight;


          if (
            visible &&
            distance < closestDistance
          ) {

            closestDistance =
              distance;

            closestIndex =
              i;

          }

        }


        /*
         * Change right-side hospital UI
         * only when the active stage changes.
         */
        if (
          closestIndex !==
          $scope.activeStep
        ) {

          setActiveStep(
            closestIndex
          );

        }

      }


      /* ============================================================
         REVEAL ELEMENTS
         
         Content remains visible even if
         JavaScript/observer timing fails.
      ============================================================ */

      function activateReveals() {

        if (!rootEl) {

          return;

        }


        var revealEls =
          rootEl.querySelectorAll(
            '.hms-reveal'
          );


        for (
          var i = 0;
          i < revealEls.length;
          i++
        ) {

          revealEls[i].classList.add(
            'hms-active'
          );

        }

      }


      /* ============================================================
         REFRESH LEFT JOURNEY ELEMENTS
      ============================================================ */

      function refreshStepElements() {

        if (!rootEl) {

          return;

        }


        stepEls =
          Array.prototype.slice.call(
            rootEl.querySelectorAll(
              '[data-journey-step]'
            )
          );

      }


      /* ============================================================
         SCROLL FRAME
      ============================================================ */

      function onScrollTick() {

        lastKnownScrollY =
          window.scrollY ||
          window.pageYOffset ||
          0;


        updateNav();

        updateHero();


        /*
         * Disable old scroll observer because we are using 
         * the new canvas-driven sequence now.
         *
         if (
           !prefersReducedMotion
         ) {
           calculateJourneyStep();
         }
         */


        ticking = false;

      }


      /* ============================================================
         SCROLL EVENT
      ============================================================ */

      function onScroll() {

        if (ticking) {

          return;

        }


        window.requestAnimationFrame(
          onScrollTick
        );


        ticking = true;

      }


      /* ============================================================
         RESIZE
      ============================================================ */

      function onResize() {

        var nextMobile =
          window.innerWidth <
          MOBILE_BREAKPOINT;


        /*
         * Detect desktop/mobile transition.
         */
        if (
          nextMobile !==
          isMobile
        ) {

          isMobile =
            nextMobile;


          /*
           * Remove desktop parallax
           * when entering mobile mode.
           */
          if (
            isMobile &&
            heroVisualEl
          ) {

            heroVisualEl.style.transform =
              '';

          }

        }


        /*
         * Re-read all 7 left-side journey
         * elements after responsive layout.
         */
        refreshStepElements();


        /*
         * Recalculate current stage.
         */
        onScrollTick();

      }


      /* ============================================================
         INITIALIZE LANDING PAGE
      ============================================================ */

      $timeout(function () {

        /*
         * Find landing page root.
         */
        rootEl =
          document.querySelector(
            '.hms-cinematic'
          );


        /*
         * Landing page may not exist if
         * another Angular route is active.
         */
        if (!rootEl) {

          return;

        }


        /*
         * Hero visual.
         */
        heroVisualEl =
          rootEl.querySelector(
            '.hms-hero__visual'
          );


        /*
         * Single right-side hospital device.
         */
        journeyDeviceEl =
          rootEl.querySelector(
            '.hms-journey__device'
          );


        /*
         * Find ALL seven left-side
         * journey stages.
         */
        refreshStepElements();


        /*
         * Always start at Registration.
         */
        $scope.activeStep = 0;


        /*
         * Make landing content immediately visible.
         */
        activateReveals();


        /*
         * Scroll listener.
         */
        addListener(
          window,
          'scroll',
          onScroll,
          {
            passive: true
          }
        );


        /*
         * Responsive listener.
         */
        addListener(
          window,
          'resize',
          onResize,
          {
            passive: true
          }
        );


        /*
         * Initial state.
         */
        onScrollTick();


      }, 50, false);


      /* ============================================================
         CLEANUP
      ============================================================ */

      $scope.$on(
        '$destroy',
        function () {

          for (
            var i = 0;
            i < cleanupFns.length;
            i++
          ) {

            cleanupFns[i]();

          }


          cleanupFns = [];


          rootEl = null;

          heroVisualEl = null;

          journeyDeviceEl = null;

          stepEls = [];

        }
      );

    }
  ]);

})();