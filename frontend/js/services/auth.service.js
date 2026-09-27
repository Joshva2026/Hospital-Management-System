(function () {
  'use strict';

  angular.module('hmsApp').factory('AuthService', ['ApiService', function (ApiService) {
    var service = {
      currentAdmin: JSON.parse(localStorage.getItem('hms_admin') || 'null'),
    };

    service.isAuthenticated = function () {
      return !!localStorage.getItem('hms_token');
    };

    service.login = function (email, password) {
      return ApiService.post('/auth/login', { email: email, password: password }).then(function (res) {
        localStorage.setItem('hms_token', res.token);
        localStorage.setItem('hms_admin', JSON.stringify(res.admin));
        service.currentAdmin = res.admin;
        return res;
      });
    };

    service.logout = function () {
      return ApiService.post('/auth/logout').finally(function () {
        localStorage.removeItem('hms_token');
        localStorage.removeItem('hms_admin');
        service.currentAdmin = null;
      });
    };

    return service;
  }]);
})();
