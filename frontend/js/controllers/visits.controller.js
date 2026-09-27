(function () {
  'use strict';

  angular.module('hmsApp').controller('VisitsController', [
    '$scope', 'ApiService', 'ToastService', 'DateTimeService',
    function ($scope, ApiService, ToastService, DateTimeService) {
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
        if (params.date) params.date = DateTimeService.formatLocalDate(params.date);
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
        $scope.form = {
          patientId:    '',
          doctorId:     '',
          specialityId: '',
          visitDate:    DateTimeService.formatLocalDate(new Date()), // string "YYYY-MM-DD"
          visitTime:    '09:00',                                     // string "HH:mm"
          visitType:    'OPD',
          complaint: '', diagnosis: '', treatment: '', notes: ''
        };
        $scope.patientSearch = ''; $scope.patients = [];
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };
      $scope.selectPatient = function (p) { $scope.form.patientId = p.patient_id; $scope.patientSearch = p.patient_id + ' - ' + p.full_name; $scope.patients = []; };

      $scope.submitVisit = function (form) {
        if (!form || !form.$valid || $scope.saving || !$scope.form.patientId) return;
        $scope.saving = true;
        
        var payload = angular.copy($scope.form);
        // type="date" gives "YYYY-MM-DD" string directly; type="time" gives "HH:mm" — normalize to HH:mm:ss
        if (payload.visitDate && typeof payload.visitDate !== 'string') {
          payload.visitDate = DateTimeService.formatLocalDate(payload.visitDate);
        }
        if (payload.visitTime) {
          var t = payload.visitTime;
          payload.visitTime = t.length === 5 ? t + ':00' : t.substring(0, 8);
        }

        ApiService.post('/visits', payload).then(function () {
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
