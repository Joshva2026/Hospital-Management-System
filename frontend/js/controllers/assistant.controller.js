(function () {
  'use strict';

  angular.module('hmsApp').controller('AssistantController', ['$scope', '$timeout', 'ApiService',
    function ($scope, $timeout, ApiService) {
      var GREETING = 'Hi! I can look up patients, beds, doctors, appointments and dashboard numbers. What would you like to know?';

      $scope.open = false;
      $scope.sending = false;
      $scope.input = '';
      $scope.messages = [{ role: 'assistant', text: GREETING }];

      function scrollDown() {
        $timeout(function () {
          var el = document.getElementById('assistantBody');
          if (el) el.scrollTop = el.scrollHeight;
        }, 50);
      }

      $scope.toggle = function () {
        $scope.open = !$scope.open;
        if ($scope.open) scrollDown();
      };

      $scope.send = function () {
        var text = ($scope.input || '').trim();
        if (!text || $scope.sending) return;

        // History excludes the greeting and the message being sent now.
        var history = $scope.messages.slice(1).slice(-10).map(function (m) {
          return { role: m.role, text: m.text };
        });

        $scope.messages.push({ role: 'user', text: text });
        $scope.input = '';
        $scope.sending = true;
        scrollDown();

        ApiService.post('/ai/chat', { message: text, history: history })
          .then(function (res) {
            $scope.$applyAsync(function () {
              $scope.messages.push({ role: 'assistant', text: res.reply });
            });
          })
          .catch(function (err) {
            $scope.$applyAsync(function () {
              $scope.messages.push({
                role: 'assistant',
                text: (err && err.message) || 'Something went wrong. Please try again.',
                error: true,
              });
            });
          })
          .finally(function () {
            $scope.$applyAsync(function () {
              $scope.sending = false;
              scrollDown();
            });
          });
      };
    }]);
})();

