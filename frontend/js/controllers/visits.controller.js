(function () {
  'use strict';

  angular.module('hmsApp').controller('VisitsController', [
    '$scope', 'ApiService', 'ToastService', 'DateTimeService', '$timeout',
    function ($scope, ApiService, ToastService, DateTimeService, $timeout) {
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
      $scope.selectedPatient = null;
      $scope.hasSearched = false;
      var searchTimeout = null;

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
        $scope.hasSearched = false;
        var searchTerm = $scope.patientSearch ? $scope.patientSearch.trim() : '';
        if (searchTerm.length < 2) { 
          $scope.patients = []; 
          return; 
        }
        if (searchTimeout) $timeout.cancel(searchTimeout);
        searchTimeout = $timeout(function() {
          ApiService.get('/patients', { search: searchTerm, limit: 8 }).then(function (res) {
            $scope.patients = res.data;
            $scope.hasSearched = true;
          });
        }, 300);
      };

      $scope.openNewVisit = function () {
        var defaultTime = new Date();
        defaultTime.setHours(9, 0, 0, 0);

        $scope.form = {
          patientId:    '',
          doctorId:     '',
          specialityId: '',
          visitDate:    new Date(),
          visitTime:    defaultTime,
          visitType:    'OPD',
          complaint: '', diagnosis: '', treatment: '', notes: ''
        };
        $scope.patientSearch = ''; 
        $scope.patients = []; 
        $scope.selectedPatient = null;
        $scope.hasSearched = false;
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };
      
      $scope.selectPatient = function (p) { 
        $scope.form.patientId = p.patient_id; 
        $scope.selectedPatient = p;
        $scope.patientSearch = ''; 
        $scope.patients = []; 
        $scope.hasSearched = false;
      };

      $scope.clearPatient = function () {
        $scope.form.patientId = '';
        $scope.selectedPatient = null;
        $scope.patientSearch = '';
        $scope.patients = [];
        $scope.hasSearched = false;
      };

      $scope.submitVisit = function (form) {
        if (!form || !form.$valid || $scope.saving || !$scope.form.patientId) return;
        $scope.saving = true;
        
        var payload = angular.copy($scope.form);
        
        if (payload.visitDate && typeof payload.visitDate !== 'string') {
          payload.visitDate = DateTimeService.formatLocalDate(payload.visitDate);
        }
        
        if (payload.visitTime) {
          if (angular.isDate(payload.visitTime)) {
            var h = payload.visitTime.getHours().toString().padStart(2, '0');
            var m = payload.visitTime.getMinutes().toString().padStart(2, '0');
            payload.visitTime = h + ':' + m + ':00';
          } else if (typeof payload.visitTime === 'string') {
            var t = payload.visitTime;
            payload.visitTime = t.length === 5 ? t + ':00' : t.substring(0, 8);
          }
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
