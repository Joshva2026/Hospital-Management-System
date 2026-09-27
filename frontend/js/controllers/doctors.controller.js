(function () {
  'use strict';

  angular.module('hmsApp').controller('DoctorsController', [
    '$scope', 'ApiService', 'ToastService', 'DateTimeService',
    function ($scope, ApiService, ToastService, DateTimeService) {
      $scope.doctors = [];
      $scope.loading = true;
      $scope.specialities = [];
      $scope.filters = { specialityId: '', status: '', search: '' };
      $scope.showModal = false;
      $scope.saving = false;
      $scope.isEdit = false;
      $scope.form = {};

      function load() {
        $scope.loading = true;
        ApiService.get('/doctors', $scope.filters).then(function (res) {
          $scope.doctors = res.data;
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }
      function loadSpecialities() {
        ApiService.get('/specialities').then(function (res) { $scope.specialities = res.data; });
      }

      $scope.applyFilters = function () { load(); };

      $scope.openNewDoctor = function () {
        $scope.isEdit = false;
        $scope.form = { doctorName: '', specialityId: '', qualification: '', experienceYears: '', mobile: '',
          email: '', consultationFee: '', availableDays: '', availableFrom: null, availableTo: null };
        $scope.showModal = true;
      };
      $scope.openEditDoctor = function (d) {
        $scope.isEdit = true;
        $scope.form = {
          doctorId: d.doctor_id, doctorName: d.doctor_name, specialityId: d.speciality_id, qualification: d.qualification,
          experienceYears: d.experience_years == null ? '' : Number(d.experience_years), mobile: d.mobile, email: d.email, consultationFee: d.consultation_fee == null ? '' : Number(d.consultation_fee),
          availableDays: d.available_days, availableFrom: DateTimeService.parseLocalTime(d.available_from), availableTo: DateTimeService.parseLocalTime(d.available_to), status: d.status,
        };
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };

      $scope.submitDoctor = function (form) {
        if (!form || !form.$valid || $scope.saving) return;
        $scope.saving = true;
        var payload = angular.copy($scope.form);
        if (payload.availableFrom) payload.availableFrom = DateTimeService.formatLocalTime(payload.availableFrom);
        if (payload.availableTo) payload.availableTo = DateTimeService.formatLocalTime(payload.availableTo);

        var call = $scope.isEdit
          ? ApiService.put('/doctors/' + payload.doctorId, payload)
          : ApiService.post('/doctors', payload);
        call.then(function () {
          ToastService.success($scope.isEdit ? 'Doctor updated.' : 'Doctor added.');
          $scope.showModal = false; load();
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.saving = false; });
      };

      $scope.toggleStatus = function (d) {
        var next = d.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        ApiService.patch('/doctors/' + d.doctor_id + '/status', { status: next }).then(function () {
          ToastService.success('Doctor status updated.'); load();
        }).catch(function (err) { ToastService.error(err.message); });
      };

      load(); loadSpecialities();
    },
  ]);
})();
