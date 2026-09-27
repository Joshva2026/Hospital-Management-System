(function () {
  'use strict';

  angular.module('hmsApp').controller('AnalyticsController', [
    '$scope', '$timeout', '$q', 'ApiService', 'ToastService',
    function ($scope, $timeout, $q, ApiService, ToastService) {
      $scope.loading = true;
      $scope.doctorWorkload = [];
      $scope.summary = {};
      $scope.selectedRange = 14;
      var charts = {};

      function destroyCharts() { Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].destroy(); }); }

      function renderLine(id, labels, datasets) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'line',
          data: { labels: labels, datasets: datasets },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: datasets.length > 1 } } },
        });
      }

      function renderBar(id, labels, datasets, horizontal) {
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

      function renderPie(id, labels, data, colors) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        var defaultColors = ['#0d7c78', '#6fd6cf', '#b9770e', '#c0392b', '#2980b9', '#8e44ad', '#16a085', '#d35400'];
        return new Chart(ctx, {
          type: 'doughnut',
          data: { labels: labels, datasets: [{ data: data, backgroundColor: colors || defaultColors }] },
          options: { responsive: true, maintainAspectRatio: false },
        });
      }

      $scope.setRange = function(range) {
        $scope.selectedRange = range;
        var daysParam = parseInt(range, 10);
        var monthsParam = Math.ceil(daysParam / 30) || 1;
        loadData(daysParam, monthsParam);
      };

      function loadData(days, months) {
        $scope.loading = true;
        
        $q.all([
          ApiService.get('/analytics/doctor-workload'),
          ApiService.get('/analytics/appointment-status'),
          ApiService.get('/analytics/registrations-trend', { months: months }),
          ApiService.get('/analytics/discharge-types'),
          ApiService.get('/dashboard/summary'),
          ApiService.get('/dashboard/charts/daily-trend', { days: days }),
          ApiService.get('/dashboard/charts/admissions-vs-discharges', { days: days }),
          ApiService.get('/dashboard/charts/patient-type-distribution'),
          ApiService.get('/dashboard/charts/speciality-distribution'),
          ApiService.get('/dashboard/charts/bed-occupancy'),
        ]).then(function (results) {
          $scope.doctorWorkload = results[0].data;
          var apptStatus = results[1].data;
          var regTrend = results[2].data;
          var dischargeTypes = results[3].data;
          
          $scope.summary = results[4].data;
          var dashTrend = results[5].data;
          var admDis = results[6].data;
          var typeDist = results[7].data;
          var specDist = results[8].data;
          var bedOcc = results[9].data;

          $scope.loading = false;

          $timeout(function () {
            destroyCharts();

            // Section A: Patient Activity
            charts.regTrend = renderLine('chartRegTrend', 
              regTrend.map(function (r) { return r.month; }), 
              [{ label: 'Monthly Registrations', data: regTrend.map(function (r) { return r.registrations; }), borderColor: '#2980b9', backgroundColor: 'rgba(41,128,185,0.1)', tension: 0.3, fill: true }]
            );

            charts.dailyTrend = renderLine('chartDailyTrend',
              dashTrend.map(function (d) { return d.date.slice(5); }),
              [
                { label: 'Registrations', data: dashTrend.map(function (d) { return d.registrations; }), borderColor: '#0d7c78', backgroundColor: 'rgba(13,124,120,0.1)', tension: 0.3, fill: true },
                { label: 'OPD Visits', data: dashTrend.map(function (d) { return d.opd_visits; }), borderColor: '#b9770e', backgroundColor: 'rgba(185,119,14,0.1)', tension: 0.3, fill: true },
              ]);

            // Section B: Hospital Flow
            charts.admDis = renderBar('chartAdmDis',
              admDis.map(function (d) { return d.date.slice(5); }),
              [
                { label: 'Admissions', data: admDis.map(function (d) { return d.admissions; }), backgroundColor: '#0d7c78' },
                { label: 'Discharges', data: admDis.map(function (d) { return d.discharges; }), backgroundColor: '#c0392b' },
              ]);

            // Section C: Patient Composition
            charts.typeDist = renderPie('chartTypeDist',
              typeDist.map(function (d) { return d.patient_type; }),
              typeDist.map(function (d) { return d.count; }));

            charts.specDist = renderBar('chartSpecDist',
              specDist.slice(0, 8).map(function (d) { return d.speciality_name; }),
              [{ label: 'Visits', data: specDist.slice(0, 8).map(function (d) { return d.visit_count; }), backgroundColor: '#0d7c78' }],
              true);

            // Section D: Bed Intelligence
            charts.bedOcc = renderBar('chartBedOcc',
              bedOcc.map(function (d) { return d.ward_name; }),
              [
                { label: 'Occupied', data: bedOcc.map(function (d) { return d.occupied; }), backgroundColor: '#c0392b' },
                { label: 'Available', data: bedOcc.map(function (d) { return d.available; }), backgroundColor: '#1e8449' },
                { label: 'Maintenance', data: bedOcc.map(function (d) { return d.maintenance; }), backgroundColor: '#b9770e' },
              ], true);

            // Section E: Operational Workload
            charts.workload = renderBar('chartWorkload',
              $scope.doctorWorkload.slice(0, 10).map(function (d) { return d.doctor_name; }),
              [{ label: 'Visits', data: $scope.doctorWorkload.slice(0, 10).map(function (d) { return d.total_visits; }), backgroundColor: '#0d7c78' }],
              true);
              
            charts.apptStatus = renderPie('chartApptStatus', 
              apptStatus.map(function (a) { return a.status; }), 
              apptStatus.map(function (a) { return a.count; }));

            // Section F: Discharge Insights
            charts.dischargeTypes = renderPie('chartDischargeTypes', 
              dischargeTypes.map(function (d) { return d.discharge_type; }), 
              dischargeTypes.map(function (d) { return d.count; }));
              
          }, 50);
        }).catch(function (err) { ToastService.error(err.message || "Failed to load analytics."); $scope.loading = false; });
      }

      // Initial load
      $scope.setRange($scope.selectedRange);

      $scope.$on('$destroy', destroyCharts);
    },
  ]);
})();
