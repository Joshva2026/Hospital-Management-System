(function () {
  'use strict';

  angular.module('hmsApp').controller('VisitsController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.visits = [];
      $scope.loading = true;
      $scope.pagination = { page: 1, limit: 10, total: 0, totalPages: 0 };
      $scope.filters = { date: '', doctorId: '', status: '' };
      $scope.doctors = [];
      $scope.patients = [];
      $scope.specialities = [];
      $scope.showModal = false;
      $scope.saving = false;
      $scope.form = {};
      $scope.patientSearch = '';

      function load() {
        $scope.loading = true;
        var params = angular.extend({}, $scope.filters, { page: $scope.pagination.page, limit: $scope.pagination.limit });
        ApiService.get('/visits', params).then(function (res) {
          $scope.visits = res.data; $scope.pagination = res.pagination;
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      function loadLookups() {
        ApiService.get('/doctors', { status: 'ACTIVE' }).then(function (res) { $scope.doctors = res.data; });
        ApiService.get('/specialities').then(function (res) { $scope.specialities = res.data; });
      }

      $scope.applyFilters = function () { $scope.pagination.page = 1; load(); };
      $scope.goToPage = function (p) { if (p < 1 || p > $scope.pagination.totalPages) return; $scope.pagination.page = p; load(); };

      $scope.searchPatients = function () {
        if (!$scope.patientSearch || $scope.patientSearch.length < 2) { $scope.patients = []; return; }
        ApiService.get('/patients', { search: $scope.patientSearch, limit: 8 }).then(function (res) {
          $scope.patients = res.data;
        });
      };

      $scope.openNewVisit = function () {
        $scope.form = { patientId: '', doctorId: '', specialityId: '', visitDate: new Date().toISOString().slice(0, 10),
          visitTime: new Date().toTimeString().slice(0, 5), visitType: 'OPD', complaint: '', diagnosis: '', treatment: '', notes: '' };
        $scope.patientSearch = ''; $scope.patients = [];
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };
      $scope.selectPatient = function (p) { $scope.form.patientId = p.patient_id; $scope.patientSearch = p.patient_id + ' - ' + p.full_name; $scope.patients = []; };

      $scope.submitVisit = function () {
        if (!$scope.visitForm.$valid || $scope.saving) return;
        $scope.saving = true;
        ApiService.post('/visits', $scope.form).then(function () {
          ToastService.success('Visit created successfully.');
          $scope.showModal = false; load();
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.saving = false; });
      };

      $scope.markStatus = function (v, status) {
        ApiService.put('/visits/' + v.visit_id, { status: status }).then(function () {
          ToastService.success('Visit updated.'); load();
        }).catch(function (err) { ToastService.error(err.message); });
      };

      load(); loadLookups();
    },
  ]);
})();
