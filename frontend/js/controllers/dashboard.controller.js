(function () {
  'use strict';

  angular.module('hmsApp').controller('DashboardController', [
    '$scope', '$timeout', '$q', 'ApiService', 'ToastService',
    function ($scope, $timeout, $q, ApiService, ToastService) {
      $scope.summary = null;
      $scope.loading = true;
      $scope.selectedRange = 14;

      var charts = {};

      function destroyCharts() {
        Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].destroy(); });
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

      $scope.setRange = function(range) {
        $scope.selectedRange = range;
        
        if (range === 'Today') {
          // Gracefully hide charts by relying on ng-if in the template
          // Only fetch the summary data
          $scope.loading = true;
          ApiService.get('/dashboard/summary').then(function(res) {
            $scope.summary = res.data;
            $scope.loading = false;
          }).catch(function(err) {
            ToastService.error(err.message || 'Failed to load summary.');
            $scope.loading = false;
          });
        } else {
          loadData(range);
        }
      };

      function loadData(days) {
        $scope.loading = true;
        
        $q.all([
          ApiService.get('/dashboard/summary'),
          ApiService.get('/dashboard/charts/daily-trend', { days: days }),
          ApiService.get('/dashboard/charts/admissions-vs-discharges', { days: days }),
          ApiService.get('/dashboard/charts/patient-type-distribution'),
          ApiService.get('/dashboard/charts/speciality-distribution'),
          ApiService.get('/dashboard/charts/bed-occupancy')
        ]).then(function (results) {
          $scope.summary = results[0].data;
          var trend = results[1].data;
          var admDis = results[2].data;
          var typeDist = results[3].data;
          var specDist = results[4].data;
          var bedOcc = results[5].data;

          $scope.loading = false;

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
                { label: 'Admissions', data: admDis.map(function (d) { return d.admissions; }), backgroundColor: '#007AFF' },
                { label: 'Discharges', data: admDis.map(function (d) { return d.discharges; }), backgroundColor: '#ef4444' },
              ]);

            charts.typeDist = renderPieChart('chartTypeDist',
              typeDist.map(function (d) { return d.patient_type; }),
              typeDist.map(function (d) { return d.count; }));

            charts.specDist = renderBarChart('chartSpecDist',
              specDist.slice(0, 8).map(function (d) { return d.speciality_name; }),
              [{ label: 'Visits', data: specDist.slice(0, 8).map(function (d) { return d.visit_count; }), backgroundColor: '#007AFF' }],
              true);

            charts.bedOcc = renderBarChart('chartBedOcc',
              bedOcc.map(function (d) { return d.ward_name; }),
              [
                { label: 'Occupied', data: bedOcc.map(function (d) { return d.occupied; }), backgroundColor: '#ef4444' },
                { label: 'Available', data: bedOcc.map(function (d) { return d.available; }), backgroundColor: '#10b981' },
                { label: 'Maintenance', data: bedOcc.map(function (d) { return d.maintenance; }), backgroundColor: '#f59e0b' },
              ], true);
          }, 50);
        }).catch(function (err) { ToastService.error(err.message || 'Failed to load dashboard.'); $scope.loading = false; });
      }

      // Initial load
      loadData($scope.selectedRange);

      $scope.$on('$destroy', destroyCharts);
    },
  ]);
})();
