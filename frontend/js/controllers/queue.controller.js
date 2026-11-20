(function () {
  'use strict';

  angular.module('hmsApp').controller('QueueController', [
    '$scope', 'ApiService', 'ToastService',
    function ($scope, ApiService, ToastService) {
      function isoToday(d) {
        d = d || new Date();
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      }

      $scope.dateObj = new Date();
      $scope.dateStr = function () { return isoToday($scope.dateObj); };
      $scope.doctors = [];
      $scope.tokens = [];
      $scope.loading = true;
      $scope.busy = false;
      $scope.newDoctorId = '';
      $scope.displayUrl = '#!/queue-display';

      function load() {
        $scope.loading = true;
        ApiService.get('/queue', { date: $scope.dateStr() }).then(function (res) {
          $scope.doctors = res.doctors || [];
          $scope.tokens = res.data || [];
          if (!$scope.newDoctorId && $scope.doctors.length) {
            $scope.newDoctorId = $scope.doctors[0].doctor_id;
          }
        }).catch(function (err) {
          ToastService.error(err.message || 'Could not load the queue.');
        }).finally(function () {
          $scope.loading = false;
        });
      }

      $scope.tokensFor = function (doctorId) {
        return $scope.tokens.filter(function (t) { return t.doctor_id === doctorId; });
      };

      $scope.waitingCount = function (doctorId) {
        return $scope.tokensFor(doctorId).filter(function (t) { return t.status === 'WAITING'; }).length;
      };

      $scope.issue = function () {
        if (!$scope.newDoctorId) { ToastService.error('Select a doctor first.'); return; }
        $scope.busy = true;
        ApiService.post('/queue/tokens', { doctorId: $scope.newDoctorId, date: $scope.dateStr() }).then(function (res) {
          ToastService.success('Token ' + res.data.token_no + ' issued.');
          load();
        }).catch(function (err) {
          ToastService.error(err.message || 'Could not issue token.');
        }).finally(function () { $scope.busy = false; });
      };

      $scope.callNext = function (doctorId) {
        $scope.busy = true;
        ApiService.post('/queue/call-next', { doctorId: doctorId, date: $scope.dateStr() }).then(function (res) {
          if (res.data) ToastService.success('Now calling token ' + res.data.token_no + '.');
          else ToastService.success(res.message || 'No patients are waiting.');
          load();
        }).catch(function (err) {
          ToastService.error(err.message || 'Could not call next patient.');
        }).finally(function () { $scope.busy = false; });
      };

      $scope.markDone = function (t) {
        ApiService.post('/queue/tokens/' + t.token_id + '/done', {}).then(function () {
          ToastService.success('Token ' + t.token_no + ' marked done.');
          load();
        }).catch(function (err) {
          ToastService.error(err.message || 'Could not update token.');
        });
      };

      $scope.reload = load;
      load();
    },
  ]);
})();
