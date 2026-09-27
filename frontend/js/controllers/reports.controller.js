(function () {
  'use strict';

  angular.module('hmsApp').controller('ReportsController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.reports = [];
      $scope.loading = true;
      $scope.activeAdmissions = [];
      $scope.showModal = false;
      $scope.saving = false;
      $scope.form = {};
      $scope.filters = { admissionId: '' };

      function load() {
        $scope.loading = true;
        ApiService.get('/reports', $scope.filters).then(function (res) {
          $scope.reports = res.data;
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      function loadActiveAdmissions() {
        ApiService.get('/admissions', { status: 'ADMITTED', limit: 100 }).then(function (res) {
          $scope.activeAdmissions = res.data;
        });
      }

      $scope.applyFilters = function () { load(); };

      $scope.openNewReport = function () {
        $scope.form = { admissionId: '', reportDate: new Date().toISOString().slice(0, 10), temperature: '',
          bloodPressure: '', pulseRate: '', spo2: '', patientCondition: 'Stable', symptoms: '', treatmentGiven: '', doctorNotes: '', nextPlan: '' };
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };

      $scope.submitReport = function () {
        if (!$scope.reportForm.$valid || $scope.saving) return;
        $scope.saving = true;
        ApiService.post('/reports', $scope.form).then(function (res) {
          ToastService.success('Daily report added (Day ' + res.data.day_number + ').');
          $scope.showModal = false; load();
        }).catch(function (err) {
          ToastService.error(err.message); // duplicate-report-for-same-day errors surface here
        }).finally(function () { $scope.saving = false; });
      };

      load(); loadActiveAdmissions();
    },
  ]);
})();
