(function () {
  'use strict';

  angular.module('hmsApp').controller('PatientsController', [
    '$scope', '$location', 'ApiService', 'ToastService',
    function ($scope, $location, ApiService, ToastService) {
      $scope.patients = [];
      $scope.loading = true;
      $scope.pagination = { page: 1, limit: 10, total: 0, totalPages: 0 };
      $scope.filters = { search: '', status: '', patientType: '', gender: '', sortBy: 'registration_date', sortDir: 'desc' };

      function load() {
        $scope.loading = true;
        var params = angular.extend({}, $scope.filters, { page: $scope.pagination.page, limit: $scope.pagination.limit });
        ApiService.get('/patients', params).then(function (res) {
          $scope.patients = res.data;
          $scope.pagination = res.pagination;
        }).catch(function (err) {
          ToastService.error(err.message);
        }).finally(function () { $scope.loading = false; });
      }

      $scope.applyFilters = function () { $scope.pagination.page = 1; load(); };
      $scope.sortBy = function (col) {
        if ($scope.filters.sortBy === col) {
          $scope.filters.sortDir = $scope.filters.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          $scope.filters.sortBy = col; $scope.filters.sortDir = 'asc';
        }
        load();
      };
      $scope.goToPage = function (p) {
        if (p < 1 || p > $scope.pagination.totalPages) return;
        $scope.pagination.page = p; load();
      };

      $scope.viewPatient = function (id) { $location.path('/patients/' + id); };
      $scope.editPatient = function (id) { $location.path('/patients/' + id + '/edit'); };
      $scope.registerNew = function () { $location.path('/patients/register'); };

      $scope.deletePatient = function (id) {
        if (!confirm('Delete patient ' + id + '?')) return;
        ApiService.delete('/patients/' + id).then(function (res) {
          ToastService.success(res.message);
          load();
        }).catch(function (err) {
          if (err.message && err.message.includes('historical clinical records')) {
            if (confirm(err.message + '\n\nDo you want to Deactivate the patient instead?')) {
              $scope.deactivatePatient(id, 'INACTIVE');
            }
          } else {
            ToastService.error(err.message);
          }
        });
      };

      $scope.deactivatePatient = function (id, status) {
        ApiService.patch('/patients/' + id + '/status', { status: status }).then(function (res) {
          ToastService.success(res.message);
          load();
        }).catch(function (err) { ToastService.error(err.message); });
      };

      $scope.showDuplicates = false;
      $scope.duplicateGroups = [];
      $scope.findDuplicates = function () {
        $scope.showDuplicates = true;
        ApiService.get('/patients/duplicates/list').then(function(res) {
          $scope.duplicateGroups = res.duplicates || [];
        }).catch(function(err) { ToastService.error(err.message); });
      };
      
      $scope.closeDuplicates = function() {
        $scope.showDuplicates = false;
      };

      load();
    },
  ]);

  // ==========================================================================
  // Register / Edit Patient
  // ==========================================================================
  angular.module('hmsApp').controller('PatientFormController', [
    '$scope', '$location', '$routeParams', 'ApiService', 'ToastService', 'DateTimeService',
    function ($scope, $location, $routeParams, ApiService, ToastService, DateTimeService) {
      $scope.isEdit = !!$routeParams.id;
      $scope.saving = false;
      $scope.step = 1;
      $scope.successData = null;
      $scope.patient = {
        fullName: '', mobile: '', gender: '', dateOfBirth: '', address: '',
        bloodGroup: '', emergencyContact: '', problem: '', reasonForVisit: '', patientType: 'OPD',
      };
      $scope.generatedId = null;
      $scope.duplicateWarning = null;

      $scope.$watch('patient', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          $scope.duplicateWarning = null;
        }
      }, true);

      $scope.nextStep = function() {
        if ($scope.step === 1) {
          if (!$scope.patient.fullName || !$scope.patient.gender || !$scope.patient.patientType) {
            ToastService.error('Please fill required personal information.');
            return;
          }
        } else if ($scope.step === 2) {
          if (!$scope.patient.mobile) {
            ToastService.error('Please fill required contact information.');
            return;
          }
        }
        $scope.step++;
      };

      $scope.prevStep = function() {
        if ($scope.step > 1) $scope.step--;
      };

      if ($scope.isEdit) {
        ApiService.get('/patients/' + $routeParams.id).then(function (res) {
          var p = res.data.patient;
          $scope.generatedId = p.patient_id;
          $scope.patient = {
            fullName: p.full_name, mobile: p.mobile, gender: p.gender,
            dateOfBirth: p.date_of_birth ? DateTimeService.parseLocalDate(p.date_of_birth) : '',
            address: p.address, bloodGroup: p.blood_group, emergencyContact: p.emergency_contact,
            problem: p.problem, reasonForVisit: p.reason_for_visit,
            patientType: (p.patient_type === 'OPD' || p.patient_type === 'EMERGENCY') ? p.patient_type : 'OPD',
          };
        }).catch(function (err) { ToastService.error(err.message); });
      }

      $scope.submitPatient = function (form) {
        console.log("Submit called. Form valid:", form ? form.$valid : 'no form', "Form error:", form ? form.$error : 'no form');
        if (!form || !form.$valid) {
          ToastService.error('Please ensure all required fields are correctly filled.');
          return;
        }
        if ($scope.saving) return;
        $scope.saving = true;
        $scope.duplicateWarning = null;

        var payload = angular.copy($scope.patient);
        if (payload.dateOfBirth) payload.dateOfBirth = DateTimeService.formatLocalDate(payload.dateOfBirth);

        var call = $scope.isEdit
          ? ApiService.put('/patients/' + $routeParams.id, payload)
          : ApiService.post('/patients', payload);

        call.then(function (res) {
          if ($scope.isEdit) {
            ToastService.success('Patient updated successfully.');
            $location.path('/patients/' + res.data.patient_id);
          } else {
            $scope.successData = res.data;
          }
        }).catch(function (err) {
          if (err.isDuplicate) {
            $scope.duplicateWarning = err.duplicate;
          } else {
            ToastService.error(err.message || 'An error occurred.');
          }
        }).finally(function () { $scope.saving = false; });
      };

      $scope.viewDuplicate = function() {
        if ($scope.duplicateWarning) {
          window.open('#!/patients/' + $scope.duplicateWarning.patient_id, '_blank');
        }
      };



      $scope.viewNewPatient = function() {
        if ($scope.successData) {
          $location.path('/patients/' + $scope.successData.patient_id);
        }
      };

      $scope.cancel = function () { $location.path('/patients'); };
    },
  ]);

  // ==========================================================================
  // Patient Profile - full history/timeline
  // ==========================================================================
  angular.module('hmsApp').controller('PatientProfileController', [
    '$scope', '$routeParams', '$location', 'ApiService', 'ToastService',
    function ($scope, $routeParams, $location, ApiService, ToastService) {
      $scope.loading = true;
      $scope.data = null;
      $scope.activeTab = 'overview';

      ApiService.get('/patients/' + $routeParams.id).then(function (res) {
        $scope.data = res.data;
        
        // Build unified timeline
        var tl = [];
        tl.push({ date: new Date($scope.data.patient.registration_date), type: 'REGISTRATION', title: 'Patient Registered', desc: 'Registered as ' + $scope.data.patient.patient_type });
        $scope.data.visits.forEach(function(v) { tl.push({ date: new Date(v.visit_date), type: 'VISIT', title: 'OPD Visit', desc: v.complaint || 'No complaint specified', doctor: v.doctor_name }); });
        $scope.data.admissions.forEach(function(a) { tl.push({ date: new Date(a.admission_date), type: 'ADMISSION', title: 'Admitted', desc: 'Ward: ' + a.ward_name + ' / Bed: ' + a.bed_number, doctor: a.doctor_name }); });
        $scope.data.dailyReports.forEach(function(r) { tl.push({ date: new Date(r.report_date), type: 'REPORT', title: 'Daily Report', desc: r.patient_condition + ' / Temp: ' + r.temperature }); });
        $scope.data.discharges.forEach(function(d) { tl.push({ date: new Date(d.discharge_date), type: 'DISCHARGE', title: 'Discharged', desc: d.discharge_type }); });
        
        // Sort descending
        tl.sort(function(a, b) { return b.date - a.date; });
        $scope.timeline = tl;
        
      }).catch(function (err) {
        ToastService.error(err.message);
      }).finally(function () { $scope.loading = false; });

      $scope.setTab = function (t) { $scope.activeTab = t; };
      $scope.editPatient = function () { $location.path('/patients/' + $routeParams.id + '/edit'); };
      $scope.back = function () { $location.path('/patients'); };
    },
  ]);
})();
