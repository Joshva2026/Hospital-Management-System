(function () {
  'use strict';

  angular.module('hmsApp').controller('RootController', [
    '$rootScope', '$scope', '$location', 'AuthService',
    function ($rootScope, $scope, $location, AuthService) {
      $scope.auth = AuthService;
      $scope.sidebarOpen = false;

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
      
      $scope.closeSidebar = function() {
        $scope.sidebarOpen = false;
      };
    },
  ]);
})();
