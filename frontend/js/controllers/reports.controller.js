(function () {
  'use strict';

  angular.module('hmsApp').controller('ReportsController', [
    '$scope', 'ApiService', 'ToastService', 'DateTimeService',
    function ($scope, ApiService, ToastService, DateTimeService) {
      $scope.reports = [];
      $scope.loading = true;
      $scope.activeAdmissions = [];
      $scope.showModal = false;
      $scope.saving = false;
      $scope.form = {};
      $scope.isEdit = false;
      $scope.filters = { admissionId: '', page: 1, limit: 25 };
      $scope.pagination = { total: 0, totalPages: 1 };

      function load() {
        $scope.loading = true;
        ApiService.get('/reports', $scope.filters).then(function (res) {
          $scope.reports = res.data;
          $scope.pagination = { total: res.total, totalPages: res.totalPages, page: res.page };
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      function loadActiveAdmissions() {
        // use larger limit for admissions dropdown to show all active
        ApiService.get('/admissions', { status: 'ADMITTED', limit: 1000 }).then(function (res) {
          $scope.activeAdmissions = res.data;
          $scope.admissionsWarning = (res.pagination && res.pagination.total > 1000) || (res.total && res.total > 1000);
        });
      }

      $scope.applyFilters = function () { $scope.filters.page = 1; load(); };
      $scope.prevPage = function () { if ($scope.filters.page > 1) { $scope.filters.page--; load(); } };
      $scope.nextPage = function () { if ($scope.filters.page < $scope.pagination.totalPages) { $scope.filters.page++; load(); } };

      $scope.openNewReport = function () {
        $scope.isEdit = false;
        $scope.form = {
          admissionId: '',
          reportDate: DateTimeService.formatLocalDate(new Date()), // string "YYYY-MM-DD"
          temperature: '', bloodPressure: '', pulseRate: '', spo2: '',
          patientCondition: 'Stable', symptoms: '', treatmentGiven: '', doctorNotes: '', nextPlan: ''
        };
        $scope.showModal = true;
      };
      $scope.openEditReport = function (r) {
        $scope.isEdit = true;
        $scope.form = {
          reportId: r.report_id,
          admissionId: r.admission_id,
          reportDate: DateTimeService.formatLocalDate(r.report_date), // string for type=date
          temperature: r.temperature,
          bloodPressure: r.blood_pressure,
          pulseRate: r.pulse_rate,
          spo2: r.spo2,
          patientCondition: r.patient_condition || 'Stable',
          symptoms: r.symptoms,
          treatmentGiven: r.treatment_given,
          doctorNotes: r.doctor_notes,
          nextPlan: r.next_plan
        };
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };

      $scope.submitReport = function (form) {
        if (!form || !form.$valid || $scope.saving) return;
        $scope.saving = true;
        
        var payload = angular.copy($scope.form);
        if (payload.temperature !== '' && payload.temperature != null) payload.temperature = Number(payload.temperature);
        if (payload.pulseRate !== '' && payload.pulseRate != null) payload.pulseRate = Number(payload.pulseRate);
        if (payload.spo2 !== '' && payload.spo2 != null) payload.spo2 = Number(payload.spo2);
        if (payload.reportDate && typeof payload.reportDate !== 'string') {
          payload.reportDate = DateTimeService.formatLocalDate(payload.reportDate);
        } else if (!payload.reportDate) {
          payload.reportDate = DateTimeService.formatLocalDate(new Date());
        }

        var call = $scope.isEdit
          ? ApiService.put('/reports/' + $scope.form.reportId, payload)
          : ApiService.post('/reports', payload);

        call.then(function (res) {
          ToastService.success($scope.isEdit ? 'Daily report updated.' : 'Daily report added (Day ' + res.data.day_number + ').');
          $scope.showModal = false; load();
        }).catch(function (err) {
          ToastService.error(err.message); // duplicate-report-for-same-day errors surface here
        }).finally(function () { $scope.saving = false; });
      };

      load(); loadActiveAdmissions();
    },
  ]);
})();
