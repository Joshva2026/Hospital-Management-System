(function () {
  'use strict';

  angular.module('hmsApp').controller('WardsBedsController', [
    '$scope', '$q', 'ApiService', 'ToastService',
    function ($scope, $q, ApiService, ToastService) {
      $scope.wards = [];
      $scope.beds = [];
      $scope.loading = true;
      $scope.selectedWardId = '';
      $scope.showWardModal = false;
      $scope.showBedModal = false;
      $scope.saving = false;
      $scope.isWardEdit = false;
      $scope.isBedEdit = false;

      function mapBedsToWards() {
        var bedMap = {};
        ($scope.beds || []).forEach(function (b) {
          if (!bedMap[b.ward_id]) bedMap[b.ward_id] = [];
          bedMap[b.ward_id].push(b);
        });
        ($scope.wards || []).forEach(function (w) {
          w.beds = bedMap[w.ward_id] || [];
        });
      }

      function loadData() {
        $scope.loading = true;
        var bedParams = $scope.selectedWardId ? { wardId: $scope.selectedWardId } : {};
        $q.all([
          ApiService.get('/wards'),
          ApiService.get('/beds', bedParams)
        ]).then(function (results) {
          $scope.wards = results[0].data || [];
          $scope.beds = results[1].data || [];
          mapBedsToWards();
        }).catch(function (err) {
          ToastService.error(err.message || 'Failed to load wards and beds.');
        }).finally(function () {
          $scope.loading = false;
        });
      }

      $scope.selectWard = function (wardId) {
        $scope.selectedWardId = wardId;
        loadData();
      };

      $scope.clearWardFilter = function () {
        $scope.selectedWardId = '';
        loadData();
      };

      $scope.openNewWard = function () {
        $scope.isWardEdit = false;
        $scope.wardForm = { wardName: '', wardType: 'GENERAL', floor: '' };
        $scope.showWardModal = true;
      };

      $scope.openEditWard = function (w) {
        $scope.isWardEdit = true;
        $scope.wardForm = { wardId: w.ward_id, wardName: w.ward_name, wardType: w.ward_type, floor: w.floor || '' };
        $scope.showWardModal = true;
      };

      $scope.closeWardModal = function () {
        $scope.showWardModal = false;
      };

      $scope.submitWard = function (form) {
        if (!form || !form.$valid || $scope.saving) return;
        $scope.saving = true;
        var call = $scope.isWardEdit 
          ? ApiService.put('/wards/' + $scope.wardForm.wardId, $scope.wardForm) 
          : ApiService.post('/wards', $scope.wardForm);
        
        call.then(function () {
          ToastService.success($scope.isWardEdit ? 'Ward updated.' : 'Ward created.'); 
          $scope.showWardModal = false;
          loadData();
        }).catch(function (err) {
          ToastService.error(err.message);
        }).finally(function () {
          $scope.saving = false;
        });
      };

      $scope.openNewBed = function (wardId) {
        $scope.isBedEdit = false;
        $scope.bedForm = {
          wardId: wardId || $scope.selectedWardId || ($scope.wards[0] && $scope.wards[0].ward_id),
          bedNumber: '',
          bedType: 'General'
        };
        $scope.showBedModal = true;
      };

      $scope.openEditBed = function (b) {
        $scope.isBedEdit = true;
        $scope.bedForm = {
          bedId: b.bed_id,
          wardId: b.ward_id,
          bedNumber: b.bed_number,
          bedType: b.bed_type || 'General',
          status: b.status
        };
        $scope.showBedModal = true;
      };

      $scope.closeBedModal = function () {
        $scope.showBedModal = false;
      };

      $scope.submitBed = function (form) {
        if (!form || !form.$valid || $scope.saving) return;
        $scope.saving = true;
        var call = $scope.isBedEdit
          ? ApiService.put('/beds/' + $scope.bedForm.bedId, $scope.bedForm)
          : ApiService.post('/beds', $scope.bedForm);
        call.then(function () {
          ToastService.success($scope.isBedEdit ? 'Bed updated.' : 'Bed added.'); 
          $scope.showBedModal = false;
          loadData();
        }).catch(function (err) {
          ToastService.error(err.message);
        }).finally(function () {
          $scope.saving = false;
        });
      };

      $scope.setBedMaintenance = function (bed, $event) {
        if ($event) $event.stopPropagation();
        ApiService.patch('/beds/' + bed.bed_id + '/status', { status: 'MAINTENANCE' }).then(function () {
          ToastService.success('Bed set to maintenance.');
          loadData();
        }).catch(function (err) {
          ToastService.error(err.message);
        });
      };

      $scope.setBedAvailable = function (bed, $event) {
        if ($event) $event.stopPropagation();
        ApiService.patch('/beds/' + bed.bed_id + '/status', { status: 'AVAILABLE' }).then(function () {
          ToastService.success('Bed marked available.');
          loadData();
        }).catch(function (err) {
          ToastService.error(err.message);
        });
      };

      loadData();
    },
  ]);
})();
