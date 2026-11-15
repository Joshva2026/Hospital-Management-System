(function () {
  'use strict';

  angular.module('hmsApp').controller('DashboardController', [
    '$scope', '$timeout', '$q', 'ApiService', 'ToastService',
    function ($scope, $timeout, $q, ApiService, ToastService) {
      $scope.summary = null;
      $scope.loading = true;
      $scope.selectedRange = 14;
      $scope.trends = {};

      var charts = {};

      function destroyCharts() {
        Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].destroy(); });
      }

      function calculateTrend(todayVal, yesterdayVal) {
        if (todayVal === undefined || yesterdayVal === undefined || yesterdayVal === null) return null;
        var diff = todayVal - yesterdayVal;
        var pct = yesterdayVal > 0 ? Math.round((Math.abs(diff) / yesterdayVal) * 100) : null;
        var label = (diff > 0 ? '+' : '') + diff;
        if (pct !== null) label += ' (' + (diff > 0 ? '+' : '') + (diff >= 0 ? pct : -pct) + '%)';
        return {
          diff: diff,
          direction: diff > 0 ? 'up' : (diff < 0 ? 'down' : 'neutral'),
          label: label,
        };
      }

      function renderLineChart(id, labels, datasets) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'line',
          data: { labels: labels, datasets: datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: datasets.length > 1 } },
          },
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
            responsive: true,
            maintainAspectRatio: false,
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
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: ['#007AFF', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316'],
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
          },
        });
      }

      $scope.setRange = function (range) {
        $scope.selectedRange = range;
        
        if (range === 'Today') {
          $scope.loading = true;
          $scope.trends = {};
          ApiService.get('/dashboard/summary').then(function (res) {
            $scope.summary = res.data;
            $scope.loading = false;
          }).catch(function (err) {
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
          var trend = results[1].data || [];
          var admDis = results[2].data || [];
          var typeDist = results[3].data || [];
          var specDist = results[4].data || [];
          var bedOcc = results[5].data || [];

          // Compute trend indicators vs yesterday
          if (trend.length >= 2) {
            var todayT = trend[trend.length - 1];
            var yestT = trend[trend.length - 2];
            $scope.trends.opd = calculateTrend(todayT.opd_visits, yestT.opd_visits);
            $scope.trends.patients = calculateTrend(todayT.registrations, yestT.registrations);
          } else {
            $scope.trends.opd = null;
            $scope.trends.patients = null;
          }

          if (admDis.length >= 2) {
            var todayAD = admDis[admDis.length - 1];
            var yestAD = admDis[admDis.length - 2];
            $scope.trends.admissions = calculateTrend(todayAD.admissions, yestAD.admissions);
            $scope.trends.discharges = calculateTrend(todayAD.discharges, yestAD.discharges);
          } else {
            $scope.trends.admissions = null;
            $scope.trends.discharges = null;
          }

          $scope.loading = false;

          $timeout(function () {
            destroyCharts();

            charts.trend = renderLineChart('chartDailyTrend',
              trend.map(function (d) { return d.date.slice(5); }),
              [
                { label: 'Registrations', data: trend.map(function (d) { return d.registrations; }), borderColor: '#007AFF', backgroundColor: 'rgba(0,122,255,0.1)', tension: 0.3, fill: true },
                { label: 'OPD Visits', data: trend.map(function (d) { return d.opd_visits; }), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true },
              ]);

            charts.admDis = renderBarChart('chartAdmDis',
              admDis.map(function (d) { return d.date.slice(5); }),
              [
                { label: 'Admissions', data: admDis.map(function (d) { return d.admissions; }), backgroundColor: '#007AFF' },
                { label: 'Discharges', data: admDis.map(function (d) { return d.discharges; }), backgroundColor: '#10b981' },
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
        }).catch(function (err) {
          ToastService.error(err.message || 'Failed to load dashboard.');
          $scope.loading = false;
        });
      }

      // Initial load
      loadData($scope.selectedRange);

      $scope.$on('$destroy', destroyCharts);
    },
  ]);
})();
