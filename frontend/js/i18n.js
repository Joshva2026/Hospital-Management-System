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
      'nav.language': 'Language',
      'mob.dashboard': 'Dashboard',
      'mob.patients': 'Patients',
      'mob.opd': 'OPD',
      'mob.visits': 'Visits',
      'mob.appointments': 'Appointments',
      'mob.billing': 'Billing (Demo)',
      'mob.queue': 'Token Queue',
      'mob.operations': 'Operations',
      'mob.wards': 'Wards & Beds',
      'mob.admissions': 'Admissions',
      'mob.discharges': 'Discharges',
      'mob.doctors': 'Doctors',
      'mob.specialities': 'Specialities',
      'mob.reports': 'Reports',
      'mob.daily': 'Daily Reports',
      'mob.analytics': 'Analytics',
      'mob.insights': 'Insights',
      'mob.audit': 'Audit Logs',
      'mob.profile': 'My Profile',
      'mob.signout': 'Sign Out',
      'queue.title': 'Now Serving',
      'queue.updated': 'Updated',
      'queue.nowServing': 'Now serving',
      'queue.next': 'Next',
      'queue.empty': 'No patients in the queue right now.',
      'queue.retry': 'Connection problem. Retrying...',
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
      'nav.language': 'மொழி',
      'mob.dashboard': 'டாஷ்போர்டு',
      'mob.patients': 'நோயாளிகள்',
      'mob.opd': 'புறநோயாளர் பிரிவு',
      'mob.visits': 'வருகைகள்',
      'mob.appointments': 'சந்திப்புகள்',
      'mob.billing': 'கட்டணம் (டெமோ)',
      'mob.queue': 'டோக்கன் வரிசை',
      'mob.operations': 'செயல்பாடுகள்',
      'mob.wards': 'வார்டுகள் & படுக்கைகள்',
      'mob.admissions': 'அனுமதிகள்',
      'mob.discharges': 'வெளியேற்றங்கள்',
      'mob.doctors': 'மருத்துவர்கள்',
      'mob.specialities': 'சிறப்புகள்',
      'mob.reports': 'அறிக்கைகள்',
      'mob.daily': 'தினசரி அறிக்கைகள்',
      'mob.analytics': 'பகுப்பாய்வு',
      'mob.insights': 'நுண்ணறிவு',
      'mob.audit': 'தணிக்கைப் பதிவுகள்',
      'mob.profile': 'என் சுயவிவரம்',
      'mob.signout': 'வெளியேறு',
      'queue.title': 'அடுத்து அழைக்கப்படுபவர்',
      'queue.updated': 'புதுப்பிக்கப்பட்டது',
      'queue.nowServing': 'இப்போது அழைப்பு',
      'queue.next': 'அடுத்தது',
      'queue.empty': 'இப்போது வரிசையில் நோயாளிகள் யாரும் இல்லை.',
      'queue.retry': 'இணைப்பில் சிக்கல். மீண்டும் முயற்சிக்கிறது...',
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
