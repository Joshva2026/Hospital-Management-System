(function () {
  'use strict';

  angular.module('hmsApp').factory('ApiService', ['$http', 'API_BASE_URL', function ($http, API_BASE_URL) {

    function handle(promise) {
      return promise
        .then(function (res) { return res.data; })
        .catch(function (err) {
          if (err.data) return Promise.reject(err.data);
          var message = 'Something went wrong. Please try again.';
          return Promise.reject({ message: message });
        });
    }

    return {
      get: function (path, params) {
        return handle($http.get(API_BASE_URL + path, { params: params || {} }));
      },
      post: function (path, body) {
        return handle($http.post(API_BASE_URL + path, body || {}));
      },
      put: function (path, body) {
        return handle($http.put(API_BASE_URL + path, body || {}));
      },
      patch: function (path, body) {
        return handle($http.patch(API_BASE_URL + path, body || {}));
      },
      delete: function (path) {
        return handle($http.delete(API_BASE_URL + path));
      },
    };
  }]);
})();
