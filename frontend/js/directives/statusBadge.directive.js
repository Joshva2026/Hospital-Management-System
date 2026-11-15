(function () {
  'use strict';

  var app = angular.module('hmsApp');

  function getBadgeClass(status) {
    if (!status) return 'badge bg-secondary text-white';
    var s = String(status).toUpperCase();
    switch (s) {
      case 'ACTIVE':
      case 'AVAILABLE':
      case 'COMPLETED':
        return 'badge bg-success text-white';
      case 'ADMITTED':
      case 'OCCUPIED':
      case 'IN_PROGRESS':
        return 'badge bg-danger text-white';
      case 'DISCHARGED':
      case 'SCHEDULED':
      case 'FINALIZED':
        return 'badge bg-info text-dark';
      case 'MAINTENANCE':
      case 'NO_SHOW':
        return 'badge bg-warning text-dark';
      case 'CANCELLED':
      case 'INACTIVE':
      default:
        return 'badge bg-secondary text-white';
    }
  }

  // Filter: {{ status | statusBadgeClass }}
  app.filter('statusBadgeClass', function () {
    return function (status) {
      return getBadgeClass(status);
    };
  });

  // Directive: <status-badge status="status"></status-badge> OR <span status-badge="status"></span>
  app.directive('statusBadge', function () {
    return {
      restrict: 'EA',
      scope: {
        status: '=?'
      },
      template: '<span ng-class="badgeClass">{{statusText}}</span>',
      link: function (scope, element, attrs) {
        function update() {
          var val = scope.status !== undefined ? scope.status : (attrs.status || attrs.statusBadge || element.text().trim());
          scope.statusText = val;
          scope.badgeClass = getBadgeClass(val);
        }

        scope.$watch('status', update);
        if (attrs.statusBadge) {
          scope.$parent.$watch(attrs.statusBadge, function (v) {
            scope.status = v;
            update();
          });
        }
        update();
      }
    };
  });
})();

