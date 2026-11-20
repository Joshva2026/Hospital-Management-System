// Language support: English (en) and Tamil (ta).
// Translations cover the navigation labels only. Patient data, AI replies, and
// the landing animation text are not translated.
(function () {
  'use strict';

  var DICT = {
    en: {
      'nav.dashboard': 'Dashboard',
      'nav.patients': 'Patients',
      'nav.opd': 'OPD',
      'nav.operations': 'Operations',
      'nav.reports': 'Reports',
      'nav.insights': 'Insights',
      'nav.search': 'Search patients, doctors...',
      'nav.quickdesk': 'Quick Desk',
      'nav.language': 'Language'
    },
    ta: {
      'nav.dashboard': 'டாஷ்போர்டு',
      'nav.patients': 'நோயாளிகள்',
      'nav.opd': 'புறநோயாளர் பிரிவு',
      'nav.operations': 'செயல்பாடுகள்',
      'nav.reports': 'அறிக்கைகள்',
      'nav.insights': 'நுண்ணறிவு',
      'nav.search': 'நோயாளிகள், மருத்துவர்களைத் தேடுங்கள்...',
      'nav.quickdesk': 'விரைவு மேசை',
      'nav.language': 'மொழி'
    }
  };

  var STORAGE_KEY = 'hms_lang';

  angular.module('hmsApp').factory('LangService', [function () {
    var current = 'en';
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && DICT[saved]) current = saved;
    } catch (e) { /* storage blocked: stay on English */ }

    return {
      current: function () { return current; },
      set: function (lang) {
        if (!DICT[lang]) return;
        current = lang;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
      },
      t: function (key) {
        return (DICT[current] && DICT[current][key]) || DICT.en[key] || key;
      }
    };
  }]);

  // Usage in templates: {{ 'nav.dashboard' | tr }}
  angular.module('hmsApp').filter('tr', ['LangService', function (LangService) {
    var fn = function (key) { return LangService.t(key); };
    fn.$stateful = true; // re-evaluate when the language changes
    return fn;
  }]);

  // Usage: <lang-switch></lang-switch>
  angular.module('hmsApp').directive('langSwitch', ['LangService', function (LangService) {
    return {
      restrict: 'E',
      scope: {},
      link: function (scope) {
        scope.lang = LangService;
        scope.choose = function (code) { LangService.set(code); };
      },
      template:
        '<div class="btn-group btn-group-sm lang-switch" role="group" aria-label="{{ \'nav.language\' | tr }}">' +
          '<button type="button" class="btn" ng-class="lang.current()===\'en\' ? \'btn-primary\' : \'btn-outline-secondary\'" ng-click="choose(\'en\')">EN</button>' +
          '<button type="button" class="btn" ng-class="lang.current()===\'ta\' ? \'btn-primary\' : \'btn-outline-secondary\'" ng-click="choose(\'ta\')">தமிழ்</button>' +
        '</div>'
    };
  }]);
})();
