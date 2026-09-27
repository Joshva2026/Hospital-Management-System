(function () {
  'use strict';

  angular.module('hmsApp').controller('AdmissionsController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.admissions = [];
      $scope.loading = true;
      $scope.pagination = { page: 1, limit: 10, total: 0, totalPages: 0 };
      $scope.filters = { status: '' };
      $scope.doctors = []; $scope.specialities = []; $scope.wards = []; $scope.availableBeds = [];
      $scope.patients = []; $scope.patientSearch = '';
      $scope.showModal = false;
      $scope.saving = false;
      $scope.step = 1;
      $scope.successData = null;
      $scope.form = {};

      function load() {
        $scope.loading = true;
        var params = angular.extend({}, $scope.filters, { page: $scope.pagination.page, limit: $scope.pagination.limit });
        ApiService.get('/admissions', params).then(function (res) {
          $scope.admissions = res.data; $scope.pagination = res.pagination;
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      function loadLookups() {
        ApiService.get('/doctors', { status: 'ACTIVE' }).then(function (res) { $scope.doctors = res.data; });
        ApiService.get('/specialities').then(function (res) { $scope.specialities = res.data; });
        ApiService.get('/wards').then(function (res) { $scope.wards = res.data; });
      }

      $scope.applyFilters = function () { $scope.pagination.page = 1; load(); };
      $scope.goToPage = function (p) { if (p < 1 || p > $scope.pagination.totalPages) return; $scope.pagination.page = p; load(); };

      $scope.searchObj = { patientQuery: '' };
      $scope.searchPatients = function () {
        if (!$scope.searchObj.patientQuery || $scope.searchObj.patientQuery.length < 2) { $scope.patients = []; return; }
        ApiService.get('/patients', { search: $scope.searchObj.patientQuery, limit: 8 }).then(function (res) { $scope.patients = res.data; });
      };
      $scope.selectPatient = function (p) { 
        $scope.form.patientId = p.patient_id; 
        $scope.selectedPatient = p;
        $scope.searchObj.patientQuery = ''; 
        $scope.patients = []; 
      };

      $scope.onWardChange = function () {
        $scope.form.bedId = '';
        $scope.availableBeds = [];
        if (!$scope.form.wardId) return;
        ApiService.get('/beds/available', { wardId: $scope.form.wardId }).then(function (res) {
          $scope.availableBeds = res.data;
        });
      };

      $scope.openNewAdmission = function () {
        $scope.form = { patientId: '', doctorId: '', specialityId: '', wardId: '', bedId: '', admissionReason: '', initialCondition: '' };
        $scope.searchObj = { patientQuery: '' };
        $scope.selectedPatient = null;
        $scope.patients = []; $scope.availableBeds = [];
        $scope.step = 1;
        $scope.successData = null;
        $scope.showModal = true;
      };
      
      $scope.nextStep = function() { 
        if ($scope.step === 1 && !$scope.form.patientId) {
          ToastService.error('Please select a patient to continue.');
          return;
        }
        if ($scope.step === 2 && !$scope.form.specialityId) {
          ToastService.error('Please select a speciality to continue.');
          return;
        }
        if ($scope.step === 3 && !$scope.form.doctorId) {
          ToastService.error('Please select a doctor to continue.');
          return;
        }
        if ($scope.step === 4 && !$scope.form.wardId) {
          ToastService.error('Please select a ward to continue.');
          return;
        }
        if ($scope.step === 5 && !$scope.form.bedId) {
          ToastService.error('Please select an available bed to continue.');
          return;
        }
        if ($scope.step === 7 && !$scope.form.admissionReason) {
          ToastService.error('Please provide an admission reason to continue.');
          return;
        }
        if ($scope.step < 10) $scope.step++; 
      };
      $scope.prevStep = function() { if ($scope.step > 1) $scope.step--; };
      
      $scope.closeModal = function () { 
        $scope.showModal = false; 
        if ($scope.successData) load();
      };

      $scope.submitAdmission = function (form) {
        if (!form || !form.$valid || $scope.saving) return;
        $scope.saving = true;
        ApiService.post('/admissions', $scope.form).then(function (res) {
          // Instead of closing immediately, show success screen.
          // Find ward details for display
          var ward = $scope.wards.find(function(w) { return w.ward_id === $scope.form.wardId; });
          var bed = $scope.availableBeds.find(function(b) { return b.bed_id === $scope.form.bedId; });
          
          $scope.successData = {
            admission_id: res.data.admission_id,
            ward_name: ward ? ward.ward_name : 'Ward',
            bed_number: bed ? bed.bed_number : res.data.bed_id
          };
          
          ToastService.success('Patient admitted successfully to bed ' + res.data.bed_id + '.');
        }).catch(function (err) { 
          if (err.error === 'PATIENT_ALREADY_ADMITTED') {
            ToastService.error('Admission not created. This patient is already admitted.');
            $scope.showModal = false;
            load();
          } else {
            ToastService.error(err.message || 'An error occurred.'); 
          }
        })
          .finally(function () { $scope.saving = false; });
      };

      load(); loadLookups();
    },
  ]);
})();
