(function () {
  'use strict';

  angular.module('hmsApp').controller('ProfileController', [
    '$scope', '$location', 'ApiService', 'AuthService', 'ToastService',
    function ($scope, $location, ApiService, AuthService, ToastService) {
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

      $scope.updateProfile = function(form) {
        if (!form || !form.$valid) return;
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
            $location.path('/profile');
          })
          .catch(function (err) {
            ToastService.error(err.message || 'Failed to update profile');
          })
          .finally(function () {
            $scope.profileSaving = false;
          });
      };

      $scope.updatePassword = function(form) {
        if (!form || !form.$valid || $scope.passwordData.newPassword !== $scope.passwordData.confirmPassword) return;
        
        $scope.passwordSaving = true;
        
        var payload = {
          currentPassword: $scope.passwordData.currentPassword,
          newPassword: $scope.passwordData.newPassword
        };

        ApiService.post('/auth/change-password', payload)
          .then(function (res) {
            ToastService.success(res.message);
            $scope.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
            if ($scope.passwordForm) {
              $scope.passwordForm.$setPristine();
              $scope.passwordForm.$setUntouched();
            }
            $location.path('/profile');
          })
          .catch(function (err) {
            ToastService.error(err.message || 'Failed to change password');
          })
          .finally(function () {
            $scope.passwordSaving = false;
          });
      };
      
      $scope.goBack = function() {
        $location.path('/profile');
      };
      
      $scope.goToEditProfile = function() {
        $location.path('/profile/edit');
      };
      
      $scope.goToChangePassword = function() {
        $location.path('/profile/change-password');
      };
    },
  ]);
})();
