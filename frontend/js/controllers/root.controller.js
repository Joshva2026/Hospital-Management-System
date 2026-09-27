(function () {
  'use strict';

  angular.module('hmsApp').controller('RootController', [
    '$rootScope', '$scope', '$location', 'AuthService',
    function ($rootScope, $scope, $location, AuthService) {
      $scope.auth = AuthService;

      $rootScope.$on('$routeChangeSuccess', function (event, current) {
        $scope.pageTitle = (current && current.title) || 'Dashboard';
        // Auto-close sidebar on mobile after navigation
        document.getElementById('sidebar') && document.getElementById('sidebar').classList.remove('open');
        var bd = document.getElementById('sidebarBackdrop');
        if (bd) bd.classList.remove('show');
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
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebarBackdrop') && document.getElementById('sidebarBackdrop').classList.toggle('show');
      };
      
      $scope.closeSidebar = function() {
        document.getElementById('sidebar').classList.remove('open');
        var bd = document.getElementById('sidebarBackdrop');
        if (bd) bd.classList.remove('show');
      };
    },
  ]);
})();
