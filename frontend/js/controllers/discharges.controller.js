(function () {
  'use strict';

  angular.module('hmsApp').controller('DischargesController', [
    '$scope', 'ApiService', 'ToastService', 'DateTimeService',
    function ($scope, ApiService, ToastService, DateTimeService) {
      $scope.discharges = [];
      $scope.loading = true;
      $scope.activeAdmissions = [];
      $scope.showModal = false;
      $scope.saving = false;
      $scope.form = {};
      $scope.isEdit = false;
      $scope.filters = { page: 1, limit: 20 };
      $scope.pagination = { total: 0, totalPages: 1 };

      function load() {
        $scope.loading = true;
        var params = angular.extend({}, $scope.filters, { page: $scope.pagination.page, limit: $scope.pagination.limit });
        ApiService.get('/discharges', params).then(function (res) {
          $scope.discharges = res.data;
          if (res.pagination) $scope.pagination = res.pagination;
          else if (res.page !== undefined) {
             $scope.pagination.page = res.page;
             $scope.pagination.limit = res.limit;
             $scope.pagination.total = res.total;
             $scope.pagination.totalPages = res.totalPages;
          }
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      $scope.prevPage = function () { if ($scope.filters.page > 1) { $scope.filters.page--; load(); } };
      $scope.nextPage = function () { if ($scope.filters.page < $scope.pagination.totalPages) { $scope.filters.page++; load(); } };

      function loadActiveAdmissions() {
        ApiService.get('/admissions', { status: 'ADMITTED', limit: 1000 }).then(function (res) {
          $scope.activeAdmissions = res.data;
          $scope.admissionsWarning = (res.pagination && res.pagination.total > 1000) || (res.total && res.total > 1000);
        });
      }

      $scope.openNewDischarge = function () {
        $scope.isEdit = false;
        $scope.form = { admissionId: '', dischargeType: 'Normal Discharge', finalDiagnosis: '', treatmentSummary: '', doctorAdvice: '', followUpDate: '' };
        $scope.showModal = true;
      };
      $scope.openEditDischarge = function (d) {
        $scope.isEdit = true;
        var fDate = d.follow_up_date ? DateTimeService.parseLocalDate(d.follow_up_date) : '';
        $scope.form = { dischargeId: d.discharge_id, admissionId: d.admission_id, dischargeType: d.discharge_type, finalDiagnosis: d.final_diagnosis, treatmentSummary: d.treatment_summary, doctorAdvice: d.doctor_advice, followUpDate: fDate };
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };

      $scope.submitDischarge = function (form) {
        if (!form || !form.$valid) {
          ToastService.error('Please complete all required fields.');
          return;
        }
        if ($scope.saving) return;
        if (!$scope.form.admissionId) {
          ToastService.error('Please select an admission before continuing.');
          return;
        }
        $scope.saving = true;
        
        var payload = angular.copy($scope.form);
        if (payload.followUpDate) {
          payload.followUpDate = DateTimeService.formatLocalDate(payload.followUpDate);
        }

        var call = $scope.isEdit
          ? ApiService.put('/discharges/' + $scope.form.dischargeId, payload)
          : ApiService.post('/discharges', payload);

        call.then(function () {
          ToastService.success($scope.isEdit ? 'Discharge summary updated.' : 'Patient discharged successfully. Bed released.');
          $scope.showModal = false; load(); if (!$scope.isEdit) loadActiveAdmissions();
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.saving = false; });
      };

      load(); loadActiveAdmissions();
    },
  ]);
})();
