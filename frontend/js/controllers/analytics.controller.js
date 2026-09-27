(function () {
  'use strict';

  angular.module('hmsApp').controller('AnalyticsController', [
    '$scope', '$timeout', '$q', 'ApiService', 'ToastService',
    function ($scope, $timeout, $q, ApiService, ToastService) {
      $scope.loading = true;
      $scope.doctorWorkload = [];
      var charts = {};

      function destroyCharts() { Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].destroy(); }); }

      function renderBar(id, labels, datasets, horizontal) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'bar',
          data: { labels: labels, datasets: datasets },
          options: { indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: datasets.length > 1 } } },
        });
      }
      function renderPie(id, labels, data) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'doughnut',
          data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#0d7c78', '#6fd6cf', '#b9770e', '#c0392b', '#2980b9', '#8e44ad'] }] },
          options: { responsive: true, maintainAspectRatio: false },
        });
      }
      function renderLine(id, labels, data, label) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'line',
          data: { labels: labels, datasets: [{ label: label, data: data, borderColor: '#0d7c78', backgroundColor: 'rgba(13,124,120,0.1)', tension: 0.3, fill: true }] },
          options: { responsive: true, maintainAspectRatio: false },
        });
      }

      $q.all([
        ApiService.get('/analytics/doctor-workload'),
        ApiService.get('/analytics/appointment-status'),
        ApiService.get('/analytics/registrations-trend', { months: 6 }),
        ApiService.get('/analytics/discharge-types'),
      ]).then(function (results) {
        $scope.doctorWorkload = results[0].data;
        var apptStatus = results[1].data;
        var regTrend = results[2].data;
        var dischargeTypes = results[3].data;

        $scope.loading = false;

        $timeout(function () {
          destroyCharts();
          charts.workload = renderBar('chartWorkload',
            $scope.doctorWorkload.slice(0, 10).map(function (d) { return d.doctor_name; }),
            [{ label: 'Visits', data: $scope.doctorWorkload.slice(0, 10).map(function (d) { return d.total_visits; }), backgroundColor: '#0d7c78' }],
            true);
          charts.apptStatus = renderPie('chartApptStatus', apptStatus.map(function (a) { return a.status; }), apptStatus.map(function (a) { return a.count; }));
          charts.regTrend = renderLine('chartRegTrend', regTrend.map(function (r) { return r.month; }), regTrend.map(function (r) { return r.registrations; }), 'Registrations');
          charts.dischargeTypes = renderPie('chartDischargeTypes', dischargeTypes.map(function (d) { return d.discharge_type; }), dischargeTypes.map(function (d) { return d.count; }));
        }, 50);
      }).catch(function (err) { ToastService.error(err.message); $scope.loading = false; });

      $scope.$on('$destroy', destroyCharts);
    },
  ]);
})();
