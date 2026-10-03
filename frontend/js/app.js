(function () {
  'use strict';

  var app = angular.module('hmsApp', ['ngRoute']);

  // ---------------------------------------------------------------------
  // GLOBAL CONFIG - change API_BASE_URL to your deployed backend URL.
  // ---------------------------------------------------------------------
  app.constant('API_BASE_URL', 'https://hospital-management-system-meko.onrender.com/api');

  app.config(['$routeProvider', '$locationProvider', function ($routeProvider) {
    $routeProvider
      .when('/', { templateUrl: 'partials/public-home.html?v=2', controller: 'LandingController', title: 'Welcome' })
      .when('/dashboard', { templateUrl: 'partials/dashboard.html', controller: 'DashboardController', title: 'Dashboard' })
      .when('/patients', { templateUrl: 'partials/patients.html', controller: 'PatientsController', title: 'Patients' })
      .when('/patients/register', { templateUrl: 'partials/patient-form.html', controller: 'PatientFormController', title: 'Register Patient' })
      .when('/patients/:id/edit', { templateUrl: 'partials/patient-form.html', controller: 'PatientFormController', title: 'Edit Patient' })
      .when('/patients/:id', { templateUrl: 'partials/patient-profile.html', controller: 'PatientProfileController', title: 'Patient Profile' })
      .when('/visits', { templateUrl: 'partials/visits.html', controller: 'VisitsController', title: 'OPD / Visits' })
      .when('/admissions', { templateUrl: 'partials/admissions.html', controller: 'AdmissionsController', title: 'Admissions' })
      .when('/reports', { templateUrl: 'partials/reports.html', controller: 'ReportsController', title: 'Daily Reports' })
      .when('/appointments', { templateUrl: 'partials/appointments.html', controller: 'AppointmentsController', title: 'Appointments' })
      .when('/doctors', { templateUrl: 'partials/doctors.html', controller: 'DoctorsController', title: 'Doctors' })
      .when('/specialities', { templateUrl: 'partials/specialities.html', controller: 'SpecialitiesController', title: 'Specialities' })
      .when('/wards-beds', { templateUrl: 'partials/wards-beds.html', controller: 'WardsBedsController', title: 'Wards & Beds' })
      .when('/discharges', { templateUrl: 'partials/discharges.html', controller: 'DischargesController', title: 'Discharges' })
      .when('/analytics', { templateUrl: 'partials/analytics.html', controller: 'AnalyticsController', title: 'Analytics' })
      .when('/audit-logs', { templateUrl: 'partials/audit-logs.html', controller: 'AuditLogsController', title: 'Audit Logs' })
      .when('/profile', { templateUrl: 'partials/profile.html', controller: 'ProfileController', title: 'Admin Profile' })
      .when('/profile/edit', { templateUrl: 'partials/profile-edit.html', controller: 'ProfileController', title: 'Edit Profile' })
      .when('/profile/change-password', { templateUrl: 'partials/profile-change-password.html', controller: 'ProfileController', title: 'Change Password' })
      .otherwise({ redirectTo: '/' });
  }]);

  app.run(['$rootScope', '$location', 'AuthService', function ($rootScope, $location, AuthService) {
    $rootScope.$on('$routeChangeStart', function (event, next, current) {
      var isAuth = AuthService.isAuthenticated();
      var path = $location.path();

      if (isAuth && (path === '/' || path === '/login')) {
        $location.path('/dashboard');
      }

      if (!isAuth && path !== '/' && path !== '/login') {
        $location.path('/');
      }
    });
  }]);

  // Attach JWT token to every outgoing request automatically.
  app.factory('authInterceptor', ['$q', '$injector', function ($q, $injector) {
    return {
      request: function (config) {
        var token = localStorage.getItem('hms_token');
        if (token) config.headers.Authorization = 'Bearer ' + token;
        return config;
      },
      responseError: function (rejection) {
        if (rejection.status === 401) {
          var wasLoggedIn = !!localStorage.getItem('hms_token');
          localStorage.removeItem('hms_token');
          localStorage.removeItem('hms_admin');
          var $location = $injector.get('$location');
          if ($location.path() !== '/') {
            $location.path('/');
          }
          if (wasLoggedIn) {
            window.location.reload();
          }
        }
        return $q.reject(rejection);
      },
    };
  }]);

  app.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.interceptors.push('authInterceptor');
  }]);

  app.directive('bodyScrollLock', function() {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        document.body.style.overflow = 'hidden';
        scope.$on('$destroy', function() {
          document.body.style.overflow = '';
        });
      }
    };
  });
})();
