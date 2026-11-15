(function () {
  'use strict';

  angular.module('hmsApp').controller('RootController', [
    '$rootScope', '$scope', '$location', 'AuthService',
    function ($rootScope, $scope, $location, AuthService) {
      $scope.auth = AuthService;
      $scope.sidebarOpen = false;

      // Theme management (C1)
      function getInitialTheme() {
        try {
          var saved = localStorage.getItem('hms_theme');
          if (saved === 'dark' || saved === 'light') return saved;
        } catch (e) {
          // ignore localStorage error
        }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return 'dark';
        }
        return 'light';
      }

      $scope.theme = getInitialTheme();
      document.documentElement.setAttribute('data-bs-theme', $scope.theme);

      $scope.setTheme = function (theme) {
        $scope.theme = theme;
        document.documentElement.setAttribute('data-bs-theme', theme);
        try {
          localStorage.setItem('hms_theme', theme);
        } catch (e) {
          // ignore localStorage error
        }
      };

      $scope.toggleTheme = function () {
        var next = $scope.theme === 'dark' ? 'light' : 'dark';
        $scope.setTheme(next);
      };

      // Listen for system theme change if no explicit choice is stored
      if (window.matchMedia) {
        try {
          var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          var handler = function (e) {
            try {
              if (!localStorage.getItem('hms_theme')) {
                $scope.$applyAsync(function () {
                  $scope.setTheme(e.matches ? 'dark' : 'light');
                });
              }
            } catch (err) {}
          };
          if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler);
          } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handler);
          }
        } catch (e) {}
      }

      $scope.activeDropdown = null;

      $scope.toggleDropdown = function (name, $event) {
        if ($event) $event.stopPropagation();
        $scope.activeDropdown = ($scope.activeDropdown === name) ? null : name;
      };

      $scope.closeDropdowns = function () {
        $scope.activeDropdown = null;
      };

      $scope.onDropdownKey = function ($event, name) {
        if ($event.key === 'Enter' || $event.key === ' ') {
          $event.preventDefault();
          $scope.toggleDropdown(name, $event);
        } else if ($event.key === 'Escape') {
          $scope.closeDropdowns();
        }
      };

      // Close dropdowns & mobile menu on Escape
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && ($scope.activeDropdown || $scope.sidebarOpen)) {
          $scope.$applyAsync(function () {
            $scope.activeDropdown = null;
            $scope.sidebarOpen = false;
          });
        }
      });

      $scope.mobileGroups = { opd: false, ops: false, reports: false, insights: false };

      $scope.toggleMobileGroup = function (name) {
        $scope.mobileGroups[name] = !$scope.mobileGroups[name];
      };

      $scope.isMobileGroupOpen = function (name) {
        return !!$scope.mobileGroups[name];
      };

      $rootScope.$on('$routeChangeSuccess', function (event, current) {
        $scope.pageTitle = (current && current.title) || 'Dashboard';
        // Auto-close mobile nav & dropdowns on navigation
        $scope.sidebarOpen = false;
        $scope.activeDropdown = null;
      });

      $scope.isActive = function (path) {
        return $location.path().indexOf(path) === 0;
      };

      $scope.logout = function () {
        AuthService.logout().then(function () {
          $location.path('/');
          window.location.reload();
        });
      };

      $scope.toggleSidebar = function () {
        $scope.sidebarOpen = !$scope.sidebarOpen;
      };
      
      $scope.closeSidebar = function () {
        $scope.sidebarOpen = false;
      };
    },
  ]);

  // ==========================================================================
  // TopBarController (Global Search & Topbar functionality)
  // ==========================================================================
  angular.module('hmsApp').controller('TopBarController', [
    '$rootScope', '$scope', '$location', '$timeout', '$element', '$document', 'ApiService',
    function ($rootScope, $scope, $location, $timeout, $element, $document, ApiService) {
      $scope.query = '';
      $scope.results = [];
      $scope.loading = false;
      $scope.isOpen = false;
      $scope.hasSearched = false;

      var searchTimer = null;
      var activeQuery = '';

      function performSearch(q) {
        activeQuery = q;
        $scope.loading = true;
        $scope.isOpen = true;

        ApiService.get('/patients', { search: q, limit: 8 })
          .then(function (res) {
            if (activeQuery === q) {
              $scope.results = (res && res.data) ? res.data.slice(0, 8) : [];
              $scope.hasSearched = true;
            }
          })
          .catch(function () {
            if (activeQuery === q) {
              $scope.results = [];
              $scope.hasSearched = true;
            }
          })
          .finally(function () {
            if (activeQuery === q) {
              $scope.loading = false;
            }
          });
      }

      $scope.onQueryChange = function () {
        if (searchTimer) {
          $timeout.cancel(searchTimer);
          searchTimer = null;
        }

        var q = ($scope.query || '').trim();
        if (q.length < 2) {
          $scope.isOpen = false;
          $scope.results = [];
          $scope.loading = false;
          $scope.hasSearched = false;
          activeQuery = '';
          return;
        }

        $scope.loading = true;
        $scope.isOpen = true;

        searchTimer = $timeout(function () {
          performSearch(q);
        }, 300);
      };

      $scope.onFocus = function () {
        var q = ($scope.query || '').trim();
        if (q.length >= 2 && ($scope.hasSearched || $scope.loading || ($scope.results && $scope.results.length > 0))) {
          $scope.isOpen = true;
        }
      };

      $scope.close = function () {
        $scope.isOpen = false;
      };

      $scope.selectPatient = function (p) {
        $scope.close();
      };

      $scope.onKeydown = function ($event) {
        if ($event.key === 'Escape') {
          $scope.close();
        } else if ($event.key === 'Enter') {
          $event.preventDefault();
          if (searchTimer) {
            $timeout.cancel(searchTimer);
            searchTimer = null;
          }
          var q = ($scope.query || '').trim();
          if ($scope.results && $scope.results.length > 0) {
            var first = $scope.results[0];
            $scope.close();
            $location.path('/patients/' + first.patient_id);
          } else if (q.length > 0) {
            $scope.loading = true;
            $scope.isOpen = true;
            ApiService.get('/patients', { search: q, limit: 8 })
              .then(function (res) {
                var data = (res && res.data) ? res.data : [];
                $scope.close();
                if (data.length > 0) {
                  $location.path('/patients/' + data[0].patient_id);
                } else {
                  $location.path('/patients').search('search', q);
                }
              })
              .catch(function () {
                $scope.close();
                $location.path('/patients').search('search', q);
              });
          }
        }
      };

      // Click outside to close
      function onDocClick(e) {
        if ($scope.isOpen && $element && $element[0] && !$element[0].contains(e.target)) {
          $scope.$applyAsync(function () {
            $scope.close();
          });
        }
      }

      function onDocKeydown(e) {
        if (e.key === 'Escape' && $scope.isOpen) {
          $scope.$applyAsync(function () {
            $scope.close();
          });
        }
      }

      $document[0].addEventListener('click', onDocClick);
      $document[0].addEventListener('keydown', onDocKeydown);

      var unbindRoute = $rootScope.$on('$routeChangeSuccess', function () {
        $scope.close();
      });

      $scope.$on('$destroy', function () {
        if (searchTimer) $timeout.cancel(searchTimer);
        $document[0].removeEventListener('click', onDocClick);
        $document[0].removeEventListener('keydown', onDocKeydown);
        unbindRoute();
      });
    },
  ]);
})();
