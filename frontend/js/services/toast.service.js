(function () {
  'use strict';

  angular.module('hmsApp').factory('ToastService', ['$rootScope', '$timeout', function ($rootScope, $timeout) {
    $rootScope.toast = { message: null, type: 'success' };

    function show(message, type) {
      $rootScope.toast = { message: message, type: type || 'success' };
      $timeout(function () {
        if ($rootScope.toast.message === message) $rootScope.toast.message = null;
      }, 4000);
    }

    return {
      success: function (msg) { show(msg, 'success'); },
      error: function (msg) { show(msg, 'error'); },
      info: function (msg) { show(msg, 'info'); },
    };
  }]);
})();
