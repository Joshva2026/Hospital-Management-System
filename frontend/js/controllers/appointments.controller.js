(function () {
  'use strict';

  angular.module('hmsApp').controller('AppointmentsController', [
    '$scope', 'ApiService', 'ToastService', 'DateTimeService', '$timeout',
    function ($scope, ApiService, ToastService, DateTimeService, $timeout) {

      $scope.appointments   = [];
      $scope.loading        = true;
      $scope.saving         = false;
      $scope.showModal      = false;
      $scope.formSubmitAttempted = false;
      $scope.pagination     = { page: 1, limit: 10, total: 0, totalPages: 0 };
      $scope.filters        = { date: '', doctorId: '', status: '' };
      $scope.doctors        = [];
      $scope.specialities   = [];
      $scope.patients       = [];
      $scope.search         = { query: '' };
      $scope.selectedPatient = null;
      $scope.hasSearched    = false;
      $scope.patientSearching = false;
      $scope.form           = {};
      
      var searchTimeout = null;
      var searchReqToken = 0;

      // ── Load list ────────────────────────────────────────────────────────────
      function load() {
        $scope.loading = true;
        var params = angular.extend({}, $scope.filters, {
          page:  $scope.pagination.page,
          limit: $scope.pagination.limit
        });
        ApiService.get('/appointments', params)
          .then(function (res) {
            $scope.appointments = res.data;
            $scope.pagination   = res.pagination;
          })
          .catch(function (err) { ToastService.error(err.message || 'Failed to load appointments.'); })
          .finally(function () { $scope.loading = false; });
      }

      // ── Load dropdown data ────────────────────────────────────────────────────
      function loadLookups() {
        ApiService.get('/doctors', { status: 'ACTIVE' })
          .then(function (res) { $scope.doctors = res.data; });
        ApiService.get('/specialities')
          .then(function (res) { $scope.specialities = res.data; });
      }

      // ── Filter / pagination ───────────────────────────────────────────────────
      $scope.applyFilters = function () { $scope.pagination.page = 1; load(); };
      $scope.goToPage = function (p) {
        if (p < 1 || p > $scope.pagination.totalPages) return;
        $scope.pagination.page = p;
        load();
      };

      // ── Patient autocomplete ──────────────────────────────────────────────────
      $scope.searchPatients = function () {
        var searchTerm = $scope.search.query ? $scope.search.query.trim() : '';

        if (searchTimeout) $timeout.cancel(searchTimeout);

        if (searchTerm.length < 2) {
          $scope.patients = [];
          $scope.hasSearched = false;
          $scope.patientSearching = false;
          return;
        }

        searchTimeout = $timeout(function() {
          $scope.patientSearching = true;
          $scope.hasSearched = false;
          $scope.patients = [];
          
          searchReqToken++;
          var currentReq = searchReqToken;

          ApiService.get('/patients', { search: searchTerm, limit: 8 })
            .then(function (res) {
              if (currentReq === searchReqToken) {
                $scope.patients = res.data || [];
                $scope.hasSearched = true;
              }
            })
            .catch(function (err) {
              if (currentReq === searchReqToken) {
                $scope.patients = [];
                $scope.hasSearched = true;
                ToastService.error(err.message || 'Search failed');
              }
            })
            .finally(function() {
              if (currentReq === searchReqToken) {
                $scope.patientSearching = false;
              }
            });
        }, 300);
      };

      $scope.selectPatient = function (p) {
        $scope.form.patientId  = p.patient_id;
        $scope.selectedPatient = p;
        $scope.search          = { query: '' };
        $scope.patients        = [];
        $scope.hasSearched     = false;
        $scope.patientSearching = false;
      };

      $scope.clearPatient = function () {
        $scope.form.patientId = '';
        $scope.selectedPatient = null;
        $scope.search = { query: '' };
        $scope.patients = [];
        $scope.hasSearched = false;
        $scope.patientSearching = false;
      };

      // ── Open modal ────────────────────────────────────────────────────────────
      $scope.openNewAppointment = function () {
        /*
         * CRITICAL: HTML type="date" and type="time" inputs MUST receive plain string values.
         * Passing a JavaScript Date object causes AngularJS ngModel:numfmt errors,
         * the field renders blank, and the form stays $invalid forever.
         * Use DateTimeService.formatLocalDate() which returns "YYYY-MM-DD".
         */
        $scope.form = {
          patientId:       '',
          doctorId:        '',
          specialityId:    '',
          appointmentDate: DateTimeService.formatLocalDate(new Date()),  // "YYYY-MM-DD"
          appointmentTime: '09:00',                                       // "HH:mm"
          appointmentType: 'CONSULTATION',
          reason:          ''
        };
        $scope.search              = { query: '' };
        $scope.patients            = [];
        $scope.selectedPatient     = null;
        $scope.hasSearched         = false;
        $scope.patientSearching    = false;
        $scope.formSubmitAttempted = false;
        $scope.showModal           = true;
      };

      $scope.closeModal = function () {
        $scope.showModal           = false;
        $scope.formSubmitAttempted = false;
      };

      // ── Submit ────────────────────────────────────────────────────────────────
      /*
       * IMPORTANT: The form lives inside ng-if="showModal" which creates a CHILD scope.
       * AngularJS registers the FormController as <form name="apptForm"> on that child scope,
       * NOT on $scope (the parent). So $scope.apptForm is ALWAYS undefined in the controller.
       *
       * The HTML passes the form reference explicitly:
       *   ng-submit="submitAppointment(apptForm)"
       * This works because the expression is evaluated IN the child scope where apptForm
       * DOES exist, and then passed as a function argument to the controller method.
       *
       * The submit button uses ng-disabled="saving" only.
       * It does NOT use ng-disabled="apptForm.$invalid" because that would evaluate
       * in the parent scope and always be undefined/truthy — permanently disabling the button.
       */
      $scope.submitAppointment = function (form) {
        $scope.formSubmitAttempted = true;

        // Guard: form reference must exist (it's passed from the child scope)
        if (!form) {
          ToastService.error('Form error — please refresh and try again.');
          return;
        }

        // Guard: AngularJS field validation
        if (!form.$valid) {
          form.$setSubmitted();   // trigger validation messages on all fields
          ToastService.error('Please fill in all required fields.');
          return;
        }


        // Guard: prevent double-submit
        if ($scope.saving) return;

        $scope.saving = true;

        /*
         * type="date" input gives "YYYY-MM-DD" string.
         * type="time" input gives "HH:mm" string.
         * PostgreSQL TIME column expects "HH:mm:ss".
         */
        var rawTime   = $scope.form.appointmentTime || '09:00';
        var timeForDb = rawTime.length === 5 ? rawTime + ':00' : rawTime.substring(0, 8);

        var payload = {
          patientId:       $scope.form.patientId,          // "PAT-2026-XXXXXX"
          doctorId:        $scope.form.doctorId,           // "DOC-XXXX"
          specialityId:    $scope.form.specialityId,       // "SPEC-XXX"
          appointmentDate: $scope.form.appointmentDate,    // "YYYY-MM-DD"
          appointmentTime: timeForDb,                      // "HH:mm:ss"
          appointmentType: $scope.form.appointmentType || 'CONSULTATION',
          reason:          $scope.form.reason || null
        };

        ApiService.post('/appointments', payload)
          .then(function () {
            ToastService.success('Appointment scheduled successfully.');
            $scope.showModal           = false;
            $scope.formSubmitAttempted = false;
            load();   // reload list from server — proves DB persistence
          })
          .catch(function (err) {
            /*
             * Keep modal open so the user can fix the issue and retry.
             * Show the actual backend error message (conflict, validation, etc.)
             */
            var msg = (err && err.message) ? err.message : 'Failed to schedule appointment. Please try again.';
            ToastService.error(msg);
          })
          .finally(function () { $scope.saving = false; });
      };

      // ── Status update ─────────────────────────────────────────────────────────
      $scope.updateStatus = function (ap, status) {
        ApiService.patch('/appointments/' + ap.appointment_id + '/status', { status: status })
          .then(function () {
            ToastService.success('Appointment marked ' + status + '.');
            load();
          })
          .catch(function (err) { ToastService.error(err.message); });
      };

      // ── Bootstrap ────────────────────────────────────────────────────────────
      load();
      loadLookups();
    }
  ]);
})();
