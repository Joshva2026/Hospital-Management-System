(function () {
  'use strict';

  angular.module('hmsApp').controller('DischargesController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.discharges = [];
      $scope.loading = true;
      $scope.activeAdmissions = [];
      $scope.showModal = false;
      $scope.saving = false;
      $scope.form = {};

      function load() {
        $scope.loading = true;
        ApiService.get('/discharges').then(function (res) {
          $scope.discharges = res.data;
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      function loadActiveAdmissions() {
        ApiService.get('/admissions', { status: 'ADMITTED', limit: 100 }).then(function (res) {
          $scope.activeAdmissions = res.data;
        });
      }

      $scope.openNewDischarge = function () {
        $scope.form = { admissionId: '', dischargeType: 'Normal Discharge', finalDiagnosis: '', treatmentSummary: '', doctorAdvice: '', followUpDate: '' };
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };

      $scope.submitDischarge = function (form) {
        if (form && !form.$valid) {
          ToastService.error('Please complete all required fields.');
          return;
        }
        if ($scope.saving) return;
        if (!$scope.form.admissionId) {
          ToastService.error('Please select an admission before continuing.');
          return;
        }
        $scope.saving = true;
        ApiService.post('/discharges', $scope.form).then(function () {
          ToastService.success('Patient discharged successfully. Bed released.');
          $scope.showModal = false; load(); loadActiveAdmissions();
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.saving = false; });
      };

      load(); loadActiveAdmissions();
    },
  ]);
})();
