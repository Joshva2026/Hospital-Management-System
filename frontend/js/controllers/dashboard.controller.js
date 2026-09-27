(function () {
  'use strict';

  angular.module('hmsApp').controller('DashboardController', [
    '$scope', '$timeout', 'ApiService', 'ToastService',
    function ($scope, $timeout, ApiService, ToastService) {
      $scope.summary = null;
      $scope.loading = true;

      var charts = {};

      function destroyCharts() {
        Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].destroy(); });
      }

      function loadSummary() {
        return ApiService.get('/dashboard/summary').then(function (res) {
          $scope.summary = res.data;
        });
      }

      function renderLineChart(id, labels, datasets) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'line',
          data: { labels: labels, datasets: datasets },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: datasets.length > 1 } } },
        });
      }

      function renderBarChart(id, labels, datasets, horizontal) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'bar',
          data: { labels: labels, datasets: datasets },
          options: {
            indexAxis: horizontal ? 'y' : 'x',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: datasets.length > 1 } },
            scales: { x: { stacked: !!horizontal }, y: { stacked: !!horizontal } },
          },
        });
      }

      function renderPieChart(id, labels, data) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'doughnut',
          data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#0d7c78', '#6fd6cf', '#b9770e', '#c0392b', '#2980b9', '#8e44ad', '#16a085', '#d35400'] }] },
          options: { responsive: true, maintainAspectRatio: false },
        });
      }

      function loadCharts() {
        return Promise.all([
          ApiService.get('/dashboard/charts/daily-trend', { days: 14 }),
          ApiService.get('/dashboard/charts/admissions-vs-discharges', { days: 14 }),
          ApiService.get('/dashboard/charts/patient-type-distribution'),
          ApiService.get('/dashboard/charts/speciality-distribution'),
          ApiService.get('/dashboard/charts/bed-occupancy'),
        ]).then(function (results) {
          var trend = results[0].data;
          var admDis = results[1].data;
          var typeDist = results[2].data;
          var specDist = results[3].data;
          var bedOcc = results[4].data;

          $timeout(function () {
            destroyCharts();

            charts.trend = renderLineChart('chartDailyTrend',
              trend.map(function (d) { return d.date.slice(5); }),
              [
                { label: 'Registrations', data: trend.map(function (d) { return d.registrations; }), borderColor: '#0d7c78', backgroundColor: 'rgba(13,124,120,0.1)', tension: 0.3, fill: true },
                { label: 'OPD Visits', data: trend.map(function (d) { return d.opd_visits; }), borderColor: '#b9770e', backgroundColor: 'rgba(185,119,14,0.1)', tension: 0.3, fill: true },
              ]);

            charts.admDis = renderBarChart('chartAdmDis',
              admDis.map(function (d) { return d.date.slice(5); }),
              [
                { label: 'Admissions', data: admDis.map(function (d) { return d.admissions; }), backgroundColor: '#0d7c78' },
                { label: 'Discharges', data: admDis.map(function (d) { return d.discharges; }), backgroundColor: '#c0392b' },
              ]);

            charts.typeDist = renderPieChart('chartTypeDist',
              typeDist.map(function (d) { return d.patient_type; }),
              typeDist.map(function (d) { return d.count; }));

            charts.specDist = renderBarChart('chartSpecDist',
              specDist.slice(0, 8).map(function (d) { return d.speciality_name; }),
              [{ label: 'Visits', data: specDist.slice(0, 8).map(function (d) { return d.visit_count; }), backgroundColor: '#0d7c78' }],
              true);

            charts.bedOcc = renderBarChart('chartBedOcc',
              bedOcc.map(function (d) { return d.ward_name; }),
              [
                { label: 'Occupied', data: bedOcc.map(function (d) { return d.occupied; }), backgroundColor: '#c0392b' },
                { label: 'Available', data: bedOcc.map(function (d) { return d.available; }), backgroundColor: '#1e8449' },
                { label: 'Maintenance', data: bedOcc.map(function (d) { return d.maintenance; }), backgroundColor: '#b9770e' },
              ], true);
          }, 0);
        });
      }

      Promise.all([loadSummary(), loadCharts()])
        .catch(function (err) { ToastService.error(err.message || 'Failed to load dashboard.'); })
        .then(function () { $scope.loading = false; $scope.$applyAsync(); });

      $scope.$on('$destroy', destroyCharts);
    },
  ]);
})();
