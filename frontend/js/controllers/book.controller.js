(function () {
  'use strict';

  angular.module('hmsApp').controller('BookController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      var today = new Date();
      function isoDate(d) {
        var m = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return d.getFullYear() + '-' + m + '-' + day;
      }

      $scope.minDate = isoDate(today);
      function toIso(v) {
        if (v instanceof Date && !isNaN(v)) return isoDate(v);
        return typeof v === 'string' ? v : '';
      }
      $scope.doctors = [];
      $scope.loadingDoctors = true;
      $scope.submitting = false;
      $scope.result = null;
      $scope.form = {
        fullName: '', mobile: '', gender: '', doctorId: '',
        appointmentDate: '', appointmentTime: ''
      };

      // OPD hours from the hospital: 10:00 AM to 3:00 PM
      $scope.slots = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30'];

      ApiService.get('/public/doctors').then(function (res) {
        $scope.doctors = res.data || [];
      }).catch(function (err) {
        ToastService.error(err.message || 'Could not load doctors.');
      }).finally(function () {
        $scope.loadingDoctors = false;
      });

      $scope.submit = function (formCtrl) {
        if (formCtrl && formCtrl.$invalid) {
          ToastService.error('Please fill in all the fields correctly.');
          return;
        }
        var payload = angular.copy($scope.form);
        payload.appointmentDate = toIso($scope.form.appointmentDate);
        if (!payload.appointmentDate) {
          ToastService.error('Please choose a date.');
          return;
        }
        $scope.submitting = true;
        ApiService.post('/public/appointments', payload).then(function (res) {
          $scope.result = res.data;
          $scope.form = { fullName: '', mobile: '', gender: '', doctorId: '', appointmentDate: '', appointmentTime: '' };
          if (formCtrl) formCtrl.$setPristine();
        }).catch(function (err) {
          ToastService.error(err.message || 'Could not book. Please try again.');
        }).finally(function () {
          $scope.submitting = false;
        });
      };

      // Summary card helpers
      $scope.doctorName = function () {
        var id = $scope.form.doctorId;
        for (var i = 0; i < $scope.doctors.length; i++) {
          if ($scope.doctors[i].doctor_id === id) return $scope.doctors[i].doctor_name;
        }
        return '';
      };
      $scope.doctorSpeciality = function () {
        var id = $scope.form.doctorId;
        for (var i = 0; i < $scope.doctors.length; i++) {
          if ($scope.doctors[i].doctor_id === id) return $scope.doctors[i].speciality_name || '';
        }
        return '';
      };

      $scope.bookAnother = function () {
        $scope.result = null;
      };
    },
  ]);
})();
