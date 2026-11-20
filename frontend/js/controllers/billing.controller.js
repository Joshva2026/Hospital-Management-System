(function () {
  'use strict';

  angular.module('hmsApp').controller('BillingController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.invoices = [];
      $scope.loading = true;
      $scope.saving = false;
      $scope.form = { visitId: '' };
      $scope.selected = null;
      $scope.demoNote = 'DEMO ONLY - sample billing. Not a real bill. No payment is taken.';

      function load() {
        $scope.loading = true;
        ApiService.get('/billing').then(function (res) {
          $scope.invoices = res.data || [];
          if (res.note) $scope.demoNote = res.note;
        }).catch(function (err) {
          ToastService.error(err.message || 'Could not load demo invoices.');
        }).finally(function () {
          $scope.loading = false;
        });
      }

      $scope.createDemo = function () {
        var visitId = ($scope.form.visitId || '').trim();
        if (!visitId) {
          ToastService.error('Enter a visit ID, for example VIS-00001.');
          return;
        }
        $scope.saving = true;
        ApiService.post('/billing/demo', { visitId: visitId }).then(function (res) {
          ToastService.success('Demo invoice ' + res.data.invoice_id + ' created.');
          $scope.form.visitId = '';
          load();
        }).catch(function (err) {
          ToastService.error(err.message || 'Could not create demo invoice.');
        }).finally(function () {
          $scope.saving = false;
        });
      };

      $scope.view = function (inv) {
        ApiService.get('/billing/' + encodeURIComponent(inv.invoice_id)).then(function (res) {
          $scope.selected = res.data;
        }).catch(function (err) {
          ToastService.error(err.message || 'Could not open invoice.');
        });
      };

      $scope.close = function () {
        $scope.selected = null;
      };

      load();
    },
  ]);
})();
