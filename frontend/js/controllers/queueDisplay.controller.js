(function () {
  'use strict';

  // Public waiting-room screen. Shows token numbers and doctor names only.
  angular.module('hmsApp').controller('QueueDisplayController', [
    '$scope', '$interval', 'ApiService',
    function ($scope, $interval, ApiService) {
      $scope.rows = [];
      $scope.error = null;
      $scope.updatedAt = null;

      function load() {
        ApiService.get('/public/queue').then(function (res) {
          $scope.rows = res.data || [];
          $scope.updatedAt = new Date();
          $scope.error = null;
        }).catch(function () {
          $scope.error = 'queue.retry';
        });
      }

      load();
      var timer = $interval(load, 10000);
      $scope.$on('$destroy', function () { $interval.cancel(timer); });
    },
  ]);
})();
