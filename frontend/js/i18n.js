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
      // Dashboard
      'dash.welcome': 'Welcome back',
      'dash.doctor': 'Doctor',
      'dash.registerPatient': 'Register Patient',
      'dash.newOpd': 'New OPD Visit',
      'dash.admit': 'Admit Patient',
      'dash.overview': 'Hospital overview',
      'dash.overviewHint': 'Counts for the selected period. Figures update as visits, admissions and discharges are recorded.',
      'dash.period': 'Period',
      'dash.today': 'Today',
      'dash.days7': '7 days',
      'dash.days14': '14 days',
      'dash.days30': '30 days',
      'dash.vsYesterday': 'vs yesterday',
      'dash.kpi.totalPatients': 'Total Patients',
      'dash.kpi.opdToday': "Today's OPD Visits",
      'dash.kpi.admitted': 'Currently Admitted',
      'dash.kpi.emergency': 'Emergency Cases',
      'dash.kpi.admissionsToday': "Today's Admissions",
      'dash.kpi.dischargesToday': "Today's Discharges",
      'dash.kpi.availableBeds': 'Available Beds',
      'dash.kpi.occupiedBeds': 'Occupied Beds',
      'dash.cap.inpatients': 'Inpatients in wards now',
      'dash.cap.emergency': 'Emergency patients now',
      'dash.cap.free': 'Free across all wards',
      'dash.cap.inUse': 'In use across all wards',
      'dash.section.trends': 'Trends',
      'dash.section.beds': 'Bed occupancy',
      'dash.section.flow': 'Flow and mix',
      'dash.empty.visits': 'No visits or registrations in this period',
      'dash.empty.beds': 'No bed occupancy data yet',
      'dash.empty.flow': 'No admissions or discharges in this period',
      'dash.empty.patients': 'No patients registered yet',
      'dash.empty.specs': 'No speciality visits in this period',
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
      // Dashboard
      'dash.welcome': 'மீண்டும் வருக',
      'dash.doctor': 'மருத்துவர்',
      'dash.registerPatient': 'நோயாளியைப் பதிவு செய்',
      'dash.newOpd': 'புதிய OPD வருகை',
      'dash.admit': 'நோயாளியை அனுமதி',
      'dash.overview': 'மருத்துவமனை சுருக்கம்',
      'dash.overviewHint': 'தேர்ந்தெடுத்த காலத்திற்கான எண்ணிக்கைகள். வருகை, அனுமதி, வெளியேற்றம் பதிவாகும்போது தரவு புதுப்பிக்கப்படும்.',
      'dash.period': 'காலம்',
      'dash.today': 'இன்று',
      'dash.days7': '7 நாட்கள்',
      'dash.days14': '14 நாட்கள்',
      'dash.days30': '30 நாட்கள்',
      'dash.vsYesterday': 'நேற்றுடன் ஒப்பிடும்போது',
      'dash.kpi.totalPatients': 'மொத்த நோயாளிகள்',
      'dash.kpi.opdToday': 'இன்றைய OPD வருகைகள்',
      'dash.kpi.admitted': 'தற்போது அனுமதிக்கப்பட்டவர்கள்',
      'dash.kpi.emergency': 'அவசர நிலை நோயாளிகள்',
      'dash.kpi.admissionsToday': 'இன்றைய அனுமதிகள்',
      'dash.kpi.dischargesToday': 'இன்றைய வெளியேற்றங்கள்',
      'dash.kpi.availableBeds': 'காலியான படுக்கைகள்',
      'dash.kpi.occupiedBeds': 'நிரம்பிய படுக்கைகள்',
      'dash.cap.inpatients': 'இப்போது வார்டுகளில் உள்ள உள்நோயாளிகள்',
      'dash.cap.emergency': 'இப்போது அவசர நிலையில் உள்ள நோயாளிகள்',
      'dash.cap.free': 'எல்லா வார்டுகளிலும் காலியானவை',
      'dash.cap.inUse': 'எல்லா வார்டுகளிலும் பயன்பாட்டில் உள்ளவை',
      'dash.section.trends': 'போக்குகள்',
      'dash.section.beds': 'படுக்கை பயன்பாடு',
      'dash.section.flow': 'ஓட்டமும் வகைகளும்',
      'dash.empty.visits': 'இந்தக் காலத்தில் வருகைகளோ பதிவுகளோ இல்லை',
      'dash.empty.beds': 'படுக்கை பயன்பாட்டுத் தரவு இன்னும் இல்லை',
      'dash.empty.flow': 'இந்தக் காலத்தில் அனுமதிகளோ வெளியேற்றங்களோ இல்லை',
      'dash.empty.patients': 'இன்னும் நோயாளிகள் பதிவு செய்யப்படவில்லை',
      'dash.empty.specs': 'இந்தக் காலத்தில் சிறப்புப் பிரிவு வருகைகள் இல்லை',
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
