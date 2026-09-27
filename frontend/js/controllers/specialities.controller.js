(function () {
  'use strict';

  angular.module('hmsApp').controller('SpecialitiesController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.specialities = [];
      $scope.loading = true;
      $scope.showModal = false;
      $scope.saving = false;
      $scope.isEdit = false;
      $scope.form = {};
      $scope.showInactive = false;

      function load() {
        $scope.loading = true;
        ApiService.get('/specialities', { includeInactive: $scope.showInactive ? 'true' : 'false' }).then(function (res) {
          $scope.specialities = res.data;
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      $scope.toggleShowInactive = function () { load(); };

      $scope.openNew = function () {
        $scope.isEdit = false;
        $scope.form = { specialityName: '', departmentDescription: '' };
        $scope.showModal = true;
      };
      $scope.openEdit = function (s) {
        $scope.isEdit = true;
        $scope.form = { specialityId: s.speciality_id, specialityName: s.speciality_name, departmentDescription: s.department_description };
        $scope.showModal = true;
      };
      $scope.closeModal = function () { $scope.showModal = false; };

      $scope.submit = function () {
        if (!$scope.specForm.$valid || $scope.saving) return;
        $scope.saving = true;
        var call = $scope.isEdit
          ? ApiService.put('/specialities/' + $scope.form.specialityId, $scope.form)
          : ApiService.post('/specialities', $scope.form);
        call.then(function () {
          ToastService.success($scope.isEdit ? 'Speciality updated.' : 'Speciality created.');
          $scope.showModal = false; load();
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.saving = false; });
      };

      $scope.deactivate = function (s) {
        // Specialities referenced by existing records are never hard-deleted, only deactivated.
        ApiService.patch('/specialities/' + s.speciality_id + '/deactivate').then(function () {
          ToastService.success('Speciality deactivated.'); load();
        }).catch(function (err) { ToastService.error(err.message); });
      };
      $scope.activate = function (s) {
        ApiService.patch('/specialities/' + s.speciality_id + '/activate').then(function () {
          ToastService.success('Speciality reactivated.'); load();
        }).catch(function (err) { ToastService.error(err.message); });
      };

      load();
    },
  ]);
})();
