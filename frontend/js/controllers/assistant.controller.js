(function () {
  'use strict';

  angular.module('hmsApp').controller('AssistantController', ['$scope', '$timeout', 'ApiService',
    function ($scope, $timeout, ApiService) {
      var GREETING = 'Hi! Quick Desk answers hospital questions instantly, without AI. Pick a topic or type your question.';

      $scope.open = false;
      $scope.sending = false;
      $scope.input = '';
      $scope.mode = 'quick';            // 'quick' (no AI) or 'ai' (Gemini)
      $scope.suggestions = [];
      $scope.messages = [{ role: 'assistant', text: GREETING }];

      function scrollDown() {
        $timeout(function () {
          var el = document.getElementById('assistantBody');
          if (el) el.scrollTop = el.scrollHeight;
        }, 50);
      }

      function push(msg) { $scope.messages.push(msg); }

      function loadMenu() {
        ApiService.get('/quick-desk/menu').then(function (res) {
          $scope.$applyAsync(function () { $scope.suggestions = res.data || []; });
        });
      }

      $scope.toggle = function () {
        $scope.open = !$scope.open;
        if ($scope.open) {
          if (!$scope.suggestions.length) loadMenu();
          scrollDown();
        }
      };

      $scope.setMode = function (m) { $scope.mode = m; };

      function askQuick(text) {
        return ApiService.post('/quick-desk/ask', { message: text }).then(function (res) {
          return { role: 'assistant', text: res.reply };
        });
      }

      function askAI(text, history) {
        return ApiService.post('/ai/chat', { message: text, history: history }).then(function (res) {
          return { role: 'assistant', text: res.reply };
        });
      }

      function send(text) {
        text = (text || '').trim();
        if (!text || $scope.sending) return;

        var history = $scope.messages.slice(1).slice(-10).map(function (m) {
          return { role: m.role, text: m.text };
        });

        $scope.$applyAsync(function () {
          push({ role: 'user', text: text });
          $scope.input = '';
          $scope.sending = true;
        });
        scrollDown();

        var job = $scope.mode === 'ai'
          ? askAI(text, history).catch(function (err) {
              // AI unavailable: tell the user and answer the same question with Quick Desk.
              $scope.$applyAsync(function () {
                push({ role: 'assistant', text: ((err && err.message) || 'AI is unavailable.') + ' Showing a Quick Desk answer instead.', error: true });
              });
              return askQuick(text);
            })
          : askQuick(text);

        job.then(function (msg) {
            $scope.$applyAsync(function () { push(msg); });
          })
          .catch(function (err) {
            $scope.$applyAsync(function () {
              push({ role: 'assistant', text: (err && err.message) || 'Something went wrong. Please try again.', error: true });
            });
          })
          .finally(function () {
            $scope.$applyAsync(function () {
              $scope.sending = false;
              scrollDown();
            });
          });
      }

      $scope.send = function () { send($scope.input); };
      $scope.pick = function (s) { send(s.text); };
    }]);
})();
