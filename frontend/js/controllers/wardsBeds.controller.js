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
                  $scope.isWardEdit = false;
      $scope.isBedEdit = false;

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
        $scope.isWardEdit = false;
        $scope.wardForm = { wardName: '', wardType: 'GENERAL', floor: '' };
        $scope.showWardModal = true;
      };
      $scope.openEditWard = function(w) {
        $scope.isWardEdit = true;
        $scope.wardForm = { wardId: w.ward_id, wardName: w.ward_name, wardType: w.ward_type, floor: w.floor || '' };
        $scope.showWardModal = true;
      };
      $scope.closeWardModal = function () { $scope.showWardModal = false; };
      $scope.submitWard = function (form) {
        if (!form || !form.$valid || $scope.saving) return;
        $scope.saving = true;
        var call = $scope.isWardEdit 
          ? ApiService.put('/wards/' + $scope.wardForm.wardId, $scope.wardForm) 
          : ApiService.post('/wards', $scope.wardForm);
        
        call.then(function () {
          ToastService.success($scope.isWardEdit ? 'Ward updated.' : 'Ward created.'); 
          $scope.showWardModal = false; loadWards();
        }).catch(function (err) { ToastService.error(err.message); })
          .finally(function () { $scope.saving = false; });
      };

      $scope.openNewBed = function () {
        $scope.isBedEdit = false;
        $scope.bedForm = { wardId: $scope.selectedWardId || ($scope.wards[0] && $scope.wards[0].ward_id), bedNumber: '', bedType: 'General' };
        $scope.showBedModal = true;
      };
      $scope.openEditBed = function (b) {
        $scope.isBedEdit = true;
        $scope.bedForm = { bedId: b.bed_id, wardId: b.ward_id, bedNumber: b.bed_number, bedType: b.bed_type || 'General', status: b.status };
        $scope.showBedModal = true;
      };
      $scope.closeBedModal = function () { $scope.showBedModal = false; };
      $scope.submitBed = function (form) {
        if (!form || !form.$valid || $scope.saving) return;
        $scope.saving = true;
        var call = $scope.isBedEdit
          ? ApiService.put('/beds/' + $scope.bedForm.bedId, $scope.bedForm)
          : ApiService.post('/beds', $scope.bedForm);
        call.then(function () {
          ToastService.success($scope.isBedEdit ? 'Bed updated.' : 'Bed added.'); 
          $scope.showBedModal = false; loadWards(); loadBeds();
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
