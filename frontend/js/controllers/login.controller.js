(function () {
  'use strict';

  angular.module('hmsApp').controller('LoginController', [
    '$scope', '$location', 'AuthService', 'ToastService',
    function ($scope, $location, AuthService, ToastService) {
      $scope.credentials = { email: '', password: '' };
      $scope.loading = false;
      $scope.errorMessage = null;

      $scope.submit = function () {
        if (!$scope.loginForm.$valid) return;
        $scope.loading = true;
        $scope.errorMessage = null;

        AuthService.login($scope.credentials.email, $scope.credentials.password)
          .then(function () {
            window.location.reload(); // simplest reliable way to re-render the authenticated shell
          })
          .catch(function (err) {
            $scope.errorMessage = err.message || 'Login failed.';
          })
          .finally(function () {
            $scope.loading = false;
          });
      };
    },
  ]);
})();
