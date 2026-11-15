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
})();
