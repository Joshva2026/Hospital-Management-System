(function () {
  'use strict';

  angular.module('hmsApp').controller('AuditLogsController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.logs = [];
      $scope.loading = true;
      $scope.pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
      $scope.filters = { action: '', entityType: '' };

      function load() {
        $scope.loading = true;
        var params = angular.extend({}, $scope.filters, { page: $scope.pagination.page, limit: $scope.pagination.limit });
        ApiService.get('/audit-logs', params).then(function (res) {
          $scope.logs = res.data; $scope.pagination = res.pagination;
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      $scope.applyFilters = function () { $scope.pagination.page = 1; load(); };
      $scope.goToPage = function (p) { if (p < 1 || p > $scope.pagination.totalPages) return; $scope.pagination.page = p; load(); };

      load();
    },
  ]);
})();
