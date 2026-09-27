(function () {
  'use strict';

  angular.module('hmsApp').controller('WardsBedsController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      $scope.wards = [];
      $scope.beds = [];
      $scope.loading = true;
      $scope.selectedWardId = '';
      $scope.showWardModal = false;
      $scope.showBedModal = false;
      $scope.saving = false;
      $scope.wardForm = {};
      $scope.bedForm = {};

      function loadWards() {
        $scope.loading = true;
        ApiService.get('/wards').then(function (res) {
          $scope.wards = res.data;
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.loading = false; });
      }

      function loadBeds() {
        ApiService.get('/beds', { wardId: $scope.selectedWardId }).then(function (res) {
          $scope.beds = res.data;
        }).catch(function (err) { ToastService.error(err.message); });
      }

      $scope.selectWard = function (wardId) { $scope.selectedWardId = wardId; loadBeds(); };
      $scope.clearWardFilter = function () { $scope.selectedWardId = ''; loadBeds(); };

      $scope.openNewWard = function () {
        $scope.wardForm = { wardName: '', wardType: 'GENERAL', floor: '' };
        $scope.showWardModal = true;
      };
      $scope.closeWardModal = function () { $scope.showWardModal = false; };
      $scope.submitWard = function () {
        if (!$scope.wardFormEl.$valid || $scope.saving) return;
        $scope.saving = true;
        ApiService.post('/wards', $scope.wardForm).then(function () {
          ToastService.success('Ward created.'); $scope.showWardModal = false; loadWards();
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.saving = false; });
      };

      $scope.openNewBed = function () {
        $scope.bedForm = { wardId: $scope.selectedWardId || ($scope.wards[0] && $scope.wards[0].ward_id), bedNumber: '', bedType: 'General' };
        $scope.showBedModal = true;
      };
      $scope.closeBedModal = function () { $scope.showBedModal = false; };
      $scope.submitBed = function () {
        if (!$scope.bedFormEl.$valid || $scope.saving) return;
        $scope.saving = true;
        ApiService.post('/beds', $scope.bedForm).then(function () {
          ToastService.success('Bed added.'); $scope.showBedModal = false; loadWards(); loadBeds();
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.saving = false; });
      };

      $scope.setBedMaintenance = function (bed) {
        ApiService.patch('/beds/' + bed.bed_id + '/status', { status: 'MAINTENANCE' }).then(function () {
          ToastService.success('Bed set to maintenance.'); loadBeds(); loadWards();
        }).catch(function (err) { ToastService.error(err.message); });
      };
      $scope.setBedAvailable = function (bed) {
        ApiService.patch('/beds/' + bed.bed_id + '/status', { status: 'AVAILABLE' }).then(function () {
          ToastService.success('Bed marked available.'); loadBeds(); loadWards();
        }).catch(function (err) { ToastService.error(err.message); });
      };

      loadWards(); loadBeds();
    },
  ]);
})();
