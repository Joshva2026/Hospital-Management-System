(function () {
  'use strict';

  angular.module('hmsApp')
    .controller('AssistantController', ['$scope', '$timeout', '$sce', 'ApiService',
      function ($scope, $timeout, $sce, ApiService) {
        var GREETING = 'Hi! Quick Desk answers hospital questions instantly, without AI. Pick a topic or type your question.';

        $scope.open = false;
        $scope.sending = false;
        $scope.input = '';
        $scope.mode = 'quick';            // 'quick' (no AI) or 'ai' (Gemini)
        $scope.suggestions = [];

        function esc(s) {
          return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function inline(s) {
          return s
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        }

        function formatText(text) {
          var out = [];
          var inList = false;
          esc(String(text || '')).split('\n').forEach(function (line) {
            var l = line.trim();
            var heading = /^#{1,6}\s+(.*)$/.exec(l);
            var bullet = /^[-*•]\s+(.*)$/.exec(l);
            var numbered = /^\d+[.)]\s+(.*)$/.exec(l);

            if (heading) {
              if (inList) { out.push('</ul>'); inList = false; }
              out.push('<div class="ai-section">' + inline(heading[1].replace(/\*\*/g, '')) + '</div>');
              return;
            }
            if (bullet || numbered) {
              if (!inList) { out.push('<ul>'); inList = true; }
              out.push('<li>' + inline((bullet || numbered)[1]) + '</li>');
              return;
            }
            if (inList) { out.push('</ul>'); inList = false; }
            if (!l || /^-{3,}$/.test(l)) return;
            out.push('<p>' + inline(l) + '</p>');
          });
          if (inList) out.push('</ul>');
          return $sce.trustAsHtml(out.join(''));
        }

        $scope.formatText = formatText;
        $scope.messages = [{ role: 'assistant', text: GREETING, html: formatText(GREETING) }];

        function scrollDown() {
          $timeout(function () {
            var el = document.getElementById('assistantBody');
            if (el) el.scrollTop = el.scrollHeight;
          }, 50);
        }

        function push(msg) {
          if (msg && msg.text && !msg.html) {
            msg.html = formatText(msg.text);
          }
          $scope.messages.push(msg);
        }

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
      }])
    .directive('bubble', ['$sce', function ($sce) {
      return {
        restrict: 'C',
        priority: -1,
        link: function (scope, element) {
          if (!scope.m) return;
          scope.$watch(function () {
            return scope.m ? (scope.m.html || scope.m.text) : null;
          }, function () {
            if (scope.m) {
              var html = scope.m.html || (scope.formatText ? scope.formatText(scope.m.text) : null);
              if (html) {
                element.html($sce.getTrustedHtml(html));
              }
            }
          });
        }
      };
    }]);
})();
