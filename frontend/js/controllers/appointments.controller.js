(function () {
  'use strict';

  angular.module('hmsApp').controller('AppointmentsController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.appointments = [];
      $scope.loading = true;
      $scope.pagination = { page: 1, limit: 10, total: 0, totalPages: 0 };
      $scope.filters = { date: '', doctorId: '', status: '' };
      $scope.doctors = []; $scope.specialities = []; $scope.patients = []; $scope.patientSearch = '';
      $scope.showModal = false;
      $scope.saving = false;
      $scope.form = {};

      function load() {
        $scope.loading = true;
        var params = angular.extend({}, $scope.filters, { page: $scope.pagination.page, limit: $scope.pagination.limit });
        ApiService.get('/appointments', params).then(function (res) {
          $scope.appointments = res.data; $scope.pagination = res.pagination;
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
        ApiService.get('/patients', { search: $scope.patientSearch, limit: 8 }).then(function (res) { $scope.patients = res.data; });
      };
      $scope.selectPatient = function (p) { $scope.form.patientId = p.patient_id; $scope.patientSearch = p.patient_id + ' - ' + p.full_name; $scope.patients = []; };

      $scope.openNewAppointment = function () {
        $scope.form = { patientId: '', doctorId: '', specialityId: '', appointmentDate: new Date().toISOString().slice(0, 10),
          appointmentTime: '', appointmentType: 'CONSULTATION', reason: '' };
        $scope.patientSearch = ''; $scope.patients = [];
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };

      $scope.submitAppointment = function () {
        if (!$scope.apptForm.$valid || $scope.saving) return;
        $scope.saving = true;
        ApiService.post('/appointments', $scope.form).then(function () {
          ToastService.success('Appointment scheduled successfully.');
          $scope.showModal = false; load();
        }).catch(function (err) {
          ToastService.error(err.message); // doctor/time conflict errors surface here
        }).finally(function () { $scope.saving = false; });
      };

      $scope.updateStatus = function (ap, status) {
        ApiService.patch('/appointments/' + ap.appointment_id + '/status', { status: status }).then(function () {
          ToastService.success('Appointment marked ' + status + '.'); load();
        }).catch(function (err) { ToastService.error(err.message); });
      };

      load(); loadLookups();
    },
  ]);
})();
