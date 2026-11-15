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

      $rootScope.$on('$routeChangeSuccess', function (event, current) {
        $scope.pageTitle = (current && current.title) || 'Dashboard';
        // Auto-close mobile nav on mobile after navigation
        $scope.sidebarOpen = false;
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
