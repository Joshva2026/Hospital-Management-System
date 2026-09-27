(function () {
  'use strict';

  angular.module('hmsApp').controller('ProfileController', [
    '$scope', 'ApiService', 'AuthService', 'ToastService',
    function ($scope, ApiService, AuthService, ToastService) {
      $scope.auth = AuthService;
      
      $scope.profileData = {
        fullName: AuthService.currentAdmin.fullName || '',
        email: AuthService.currentAdmin.email || ''
      };
      
      $scope.passwordData = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };

      $scope.profileSaving = false;
      $scope.passwordSaving = false;

      $scope.updateProfile = function () {
        if (!$scope.profileForm.$valid) return;
        $scope.profileSaving = true;
        
        ApiService.put('/auth/profile', $scope.profileData)
          .then(function (res) {
            ToastService.success(res.message);
            // Update local storage and auth service
            var currentAdmin = JSON.parse(localStorage.getItem('hms_admin') || '{}');
            currentAdmin.fullName = res.admin.full_name;
            currentAdmin.email = res.admin.email;
            localStorage.setItem('hms_admin', JSON.stringify(currentAdmin));
            AuthService.currentAdmin = currentAdmin;
          })
          .catch(function (err) {
            ToastService.error(err.message || 'Failed to update profile');
          })
          .finally(function () {
            $scope.profileSaving = false;
          });
      };

      $scope.updatePassword = function () {
        if (!$scope.passwordForm.$valid || $scope.passwordData.newPassword !== $scope.passwordData.confirmPassword) return;
        
        $scope.passwordSaving = true;
        
        var payload = {
          currentPassword: $scope.passwordData.currentPassword,
          newPassword: $scope.passwordData.newPassword
        };

        ApiService.post('/auth/change-password', payload)
          .then(function (res) {
            ToastService.success(res.message);
            $scope.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
            $scope.passwordForm.$setPristine();
            $scope.passwordForm.$setUntouched();
          })
          .catch(function (err) {
            ToastService.error(err.message || 'Failed to change password');
          })
          .finally(function () {
            $scope.passwordSaving = false;
          });
      };
    },
  ]);
})();
