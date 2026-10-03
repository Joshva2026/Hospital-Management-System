(function () {
  'use strict';

  angular.module('hmsApp').controller('LandingController', [
    '$scope',
    '$timeout',
    function ($scope, $timeout) {

      // -----------------------------------------------------------------
      // Login modal (existing mechanism — untouched)
      // -----------------------------------------------------------------
      $scope.showLoginModal = false;

      $scope.openLoginModal = function () {
        $scope.showLoginModal = true;
      };

      $scope.closeLoginModal = function () {
        $scope.showLoginModal = false;
      };

      // -----------------------------------------------------------------
      // Static content (Backend Independence — no API calls on landing)
      // -----------------------------------------------------------------
      $scope.navScrolled = false;
      $scope.activeStep = 0;

      $scope.journeySteps = [
        { num: '01', label: 'Registration', desc: 'Capture demographic and clinical data instantly, generating a unique digital ID that follows the patient through every stage.' },
        { num: '02', label: 'OPD', desc: 'Doctors access unified records in real time for rapid diagnosis, prescriptions and structured consultation notes.' },
        { num: '03', label: 'Admission', desc: 'Seamless transition from outpatient to inpatient care, with the admission linked directly to the patient record.' },
        { num: '04', label: 'Ward', desc: 'Live visibility into ward occupancy and allocation, so the care team always knows where every patient is.' },
        { num: '05', label: 'Bed', desc: 'Granular, bed-level tracking keeps capacity, transfers and discharges accurate across the entire facility.' },
        { num: '06', label: 'Monitoring', desc: 'Ongoing vitals and daily progress stay visible to the authorized care team throughout the stay.' },
        { num: '07', label: 'Reports', desc: 'Daily and operational reports roll up automatically from every module into one reporting layer.' }
      ];

      $scope.featureCards = [
        { icon: 'fa-solid fa-users', title: 'Patient Management', desc: 'Comprehensive profiles, history and interaction logs centralized in one secure record.' },
        { icon: 'fa-solid fa-bed', title: 'Ward & Bed Control', desc: 'Live occupancy visibility across wards and beds, with smooth transfers and discharges.' },
        { icon: 'fa-solid fa-user-doctor', title: 'Doctor Management', desc: 'Roster scheduling, OPD assignment and specialities managed from a single place.' },
        { icon: 'fa-solid fa-chart-line', title: 'Daily Reports', desc: 'Operational and clinical reporting generated directly from live hospital data.' },
        { icon: 'fa-solid fa-file-medical', title: 'Admission Workflows', desc: 'Digitized admission and discharge flows that reduce administrative overhead.' },
        { icon: 'fa-solid fa-chart-pie', title: 'Analytics', desc: 'A connected view of hospital performance across patients, beds and visits.' }
      ];

      // -----------------------------------------------------------------
      // Scroll enhancement — progressive, non-blocking
      // -----------------------------------------------------------------
      var cleanupFns = [];
      var prefersReducedMotion = false;

      try {
        prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) { /* matchMedia unsupported — degrade gracefully */ }

      function setupNavScroll() {
        var root = document.querySelector('.hms-cinematic');
        if (!root) return;

        function onScroll() {
          $scope.navScrolled = window.scrollY > 40;
          $scope.$applyAsync();
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        cleanupFns.push(function () {
          window.removeEventListener('scroll', onScroll);
        });
      }

      function setupJourneyTracking() {
        var stepEls = document.querySelectorAll('[data-journey-step]');
        if (!stepEls.length) return;

        if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
          // Content is already fully visible by default CSS; nothing more to do.
          return;
        }

        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var idx = parseInt(entry.target.getAttribute('data-journey-step'), 10);
              if (!isNaN(idx) && idx !== $scope.activeStep) {
                $scope.activeStep = idx;
                $scope.$applyAsync();
              }
            }
          });
        }, { threshold: 0.5, rootMargin: '-20% 0px -20% 0px' });

        stepEls.forEach(function (el) { observer.observe(el); });

        cleanupFns.push(function () {
          observer.disconnect();
        });
      }

      function setupReveal() {
        var elements = document.querySelectorAll('.hms-reveal');
        if (!elements.length) return;

        if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
          elements.forEach(function (el) { el.classList.add('hms-active'); });
          return;
        }

        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('hms-active');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

        elements.forEach(function (el) { observer.observe(el); });

        cleanupFns.push(function () {
          observer.disconnect();
        });
      }

      $timeout(function () {
        setupNavScroll();
        setupJourneyTracking();
        setupReveal();
      }, 0);

      $scope.$on('$destroy', function () {
        cleanupFns.forEach(function (fn) { fn(); });
        cleanupFns = [];
      });
    },
  ]);
})();