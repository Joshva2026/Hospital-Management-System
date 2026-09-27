(function () {
  'use strict';

  angular.module('hmsApp').factory('DateTimeService', function () {
    return {
      formatLocalDate: function (value) {
        if (!value) return null;
        if (typeof value === 'string') {
          if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
          var parsed = new Date(value);
          if (isNaN(parsed.getTime())) return null;
          value = parsed;
        }
        if (value instanceof Date && !isNaN(value.getTime())) {
          return value.getFullYear() + '-' +
            String(value.getMonth() + 1).padStart(2, '0') + '-' +
            String(value.getDate()).padStart(2, '0');
        }
        return null;
      },
      formatLocalTime: function (value) {
        if (!value) return null;
        if (typeof value === 'string') {
          if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.substring(0, 5) + ':00';
          var parsed = new Date(value);
          if (isNaN(parsed.getTime())) return null;
          value = parsed;
        }
        if (value instanceof Date && !isNaN(value.getTime())) {
          return String(value.getHours()).padStart(2, '0') + ':' +
                 String(value.getMinutes()).padStart(2, '0') + ':00';
        }
        return null;
      },
      parseLocalDate: function (dateStr) {
        if (!dateStr) return null;
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d;
      },
      parseLocalTime: function (timeStr) {
        if (!timeStr) return null;
        var parts = timeStr.split(':');
        var d = new Date();
        d.setHours(parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, 0, 0);
        return d;
      }
    };
  });
})();
