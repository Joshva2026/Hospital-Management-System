(function () {
  'use strict';

  angular.module('hmsApp').controller('DashboardController', [
    '$scope', '$timeout', '$q', 'ApiService', 'ToastService',
    function ($scope, $timeout, $q, ApiService, ToastService) {
      $scope.summary = null;
      $scope.loading = true;
      $scope.today = new Date();
      $scope.selectedRange = 14;
      $scope.trends = {};
      $scope.wardStats = [];
      $scope.demographicsLegend = [];
      $scope.totalPatientsCount = 0;

      // Empty chart states
      $scope.emptyCharts = {
        dailyTrend: false,
        admDis: false,
        typeDist: false,
        specDist: false,
        bedOcc: false,
      };

      var charts = {};

      function destroyCharts() {
        Object.keys(charts).forEach(function (k) {
          if (charts[k]) {
            charts[k].destroy();
            charts[k] = null;
          }
        });
      }

      // Helper: Format date strings/timestamps as "Nov 2"
      function formatDateLabel(val) {
        if (!val) return '';
        var d = new Date(val);
        if (isNaN(d.getTime())) {
          var parts = String(val).split(/[-T\s]/);
          if (parts.length >= 3) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          }
        }
        if (isNaN(d.getTime())) return String(val);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate();
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
            plugins: {
              legend: {
                display: datasets.length > 1,
                position: 'top',
                labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                  stepSize: 1,
                  font: { family: 'Inter', size: 11 },
                },
                grid: { color: 'rgba(0,0,0,0.05)' },
              },
              x: {
                ticks: { font: { family: 'Inter', size: 11 } },
                grid: { display: false },
              },
            },
          },
        });
      }

      function renderBarChart(id, labels, datasets, horizontal, extraPlugins, extraOptions) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;

        var scales = {};
        if (horizontal) {
          scales = {
            x: {
              beginAtZero: true,
              ticks: { precision: 0, stepSize: 1, font: { family: 'Inter', size: 11 } },
              grid: { color: 'rgba(0,0,0,0.05)' },
            },
            y: {
              ticks: { font: { family: 'Inter', size: 11 } },
              grid: { display: false },
            },
          };
        } else {
          scales = {
            y: {
              beginAtZero: true,
              ticks: { precision: 0, stepSize: 1, font: { family: 'Inter', size: 11 } },
              grid: { color: 'rgba(0,0,0,0.05)' },
            },
            x: {
              ticks: { font: { family: 'Inter', size: 11 } },
              grid: { display: false },
            },
          };
        }

        var opts = {
          indexAxis: horizontal ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: datasets.length > 1,
              position: 'top',
              labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } },
            },
          },
          scales: scales,
        };

        if (extraOptions) {
          if (extraOptions.layout) opts.layout = extraOptions.layout;
          if (extraOptions.scales) Object.assign(opts.scales, extraOptions.scales);
        }

        return new Chart(ctx, {
          type: 'bar',
          data: { labels: labels, datasets: datasets },
          options: opts,
          plugins: extraPlugins || [],
        });
      }

      function renderPieChart(id, labels, data, colors) {
        var ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: colors || ['#0d7c78', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
              borderWidth: 2,
              borderColor: '#ffffff',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: { display: false },
            },
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
          ApiService.get('/dashboard/charts/bed-occupancy'),
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

          // Evaluate empty chart conditions
          var hasTrend = trend.some(function (d) {
            return (Number(d.registrations) || 0) > 0 || (Number(d.opd_visits) || 0) > 0;
          });
          $scope.emptyCharts.dailyTrend = !hasTrend;

          var hasAdmDis = admDis.some(function (d) {
            return (Number(d.admissions) || 0) > 0 || (Number(d.discharges) || 0) > 0;
          });
          $scope.emptyCharts.admDis = !hasAdmDis;

          var totalPatients = typeDist.reduce(function (sum, d) {
            return sum + (Number(d.count) || 0);
          }, 0);
          $scope.totalPatientsCount = totalPatients;
          $scope.emptyCharts.typeDist = totalPatients === 0;

          var demoPalette = ['#0d7c78', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];
          $scope.demographicsLegend = typeDist.map(function (d, i) {
            var count = Number(d.count) || 0;
            var pct = totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0;
            return {
              label: d.patient_type || 'General',
              count: count,
              pct: pct,
              color: demoPalette[i % demoPalette.length],
            };
          });

          // Sorted top 8 specialities
          var sortedSpec = (specDist || []).slice().sort(function (a, b) {
            return (Number(b.visit_count) || 0) - (Number(a.visit_count) || 0);
          }).slice(0, 8);

          var hasSpec = sortedSpec.some(function (d) {
            return (Number(d.visit_count) || 0) > 0;
          });
          $scope.emptyCharts.specDist = !hasSpec;

          // Ward occupancy calculations
          var hasBedOcc = bedOcc.some(function (w) {
            return (Number(w.occupied) || 0) > 0 || (Number(w.available) || 0) > 0 || (Number(w.maintenance) || 0) > 0;
          });
          $scope.emptyCharts.bedOcc = !hasBedOcc;

          $scope.wardStats = bedOcc.map(function (w) {
            var occ = Number(w.occupied) || 0;
            var avail = Number(w.available) || 0;
            var maint = Number(w.maintenance) || 0;
            var total = occ + avail + maint;
            var rate = total > 0 ? Math.round((occ / total) * 100) : 0;
            var colorClass = rate >= 100 ? 'bg-danger' : (rate >= 80 ? 'bg-warning' : 'bg-success');
            var bedsPlural = total === 1 ? '1 bed' : total + ' beds';
            var statusText = occ + ' of ' + bedsPlural + ' occupied';
            return {
              ward_name: w.ward_name,
              occupied: occ,
              available: avail,
              maintenance: maint,
              total: total,
              rate: rate,
              colorClass: colorClass,
              statusText: statusText,
            };
          });

          $scope.loading = false;

          $timeout(function () {
            destroyCharts();

            // 1. Daily Trend
            if (!$scope.emptyCharts.dailyTrend) {
              charts.trend = renderLineChart('chartDailyTrend',
                trend.map(function (d) { return formatDateLabel(d.date); }),
                [
                  {
                    label: 'Registrations',
                    data: trend.map(function (d) { return Number(d.registrations) || 0; }),
                    borderColor: '#0d7c78',
                    backgroundColor: 'rgba(13, 124, 120, 0.12)',
                    tension: 0.3,
                    fill: true,
                  },
                  {
                    label: 'OPD Visits',
                    data: trend.map(function (d) { return Number(d.opd_visits) || 0; }),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.3,
                    fill: true,
                  },
                ]);
            }

            // 2. Admissions vs Discharges (Flow Analytics)
            if (!$scope.emptyCharts.admDis) {
              charts.admDis = renderBarChart('chartAdmDis',
                admDis.map(function (d) { return formatDateLabel(d.date); }),
                [
                  {
                    label: 'Admissions',
                    data: admDis.map(function (d) { return Number(d.admissions) || 0; }),
                    backgroundColor: '#0d7c78',
                    borderRadius: 4,
                  },
                  {
                    label: 'Discharges',
                    data: admDis.map(function (d) { return Number(d.discharges) || 0; }),
                    backgroundColor: '#10b981',
                    borderRadius: 4,
                  },
                ],
                false);
            }

            // 3. Patient Demographics Donut
            if (!$scope.emptyCharts.typeDist) {
              charts.typeDist = renderPieChart('chartTypeDist',
                typeDist.map(function (d) { return d.patient_type; }),
                typeDist.map(function (d) { return Number(d.count) || 0; }),
                demoPalette);
            }

            // 4. Speciality Insights (Horizontal bars with value labels at bar end)
            if (!$scope.emptyCharts.specDist) {
              var barValuePlugin = {
                id: 'barValueLabels',
                afterDatasetsDraw: function (chart) {
                  var ctx = chart.ctx;
                  chart.data.datasets.forEach(function (dataset, i) {
                    var meta = chart.getDatasetMeta(i);
                    if (!meta || !meta.data) return;
                    meta.data.forEach(function (bar, index) {
                      var val = dataset.data[index];
                      if (val !== undefined && val !== null) {
                        ctx.save();
                        ctx.font = '600 12px Inter, sans-serif';
                        ctx.fillStyle = '#64748b';
                        ctx.textBaseline = 'middle';
                        var text = val + (val === 1 ? ' visit' : ' visits');
                        ctx.fillText(text, bar.x + 6, bar.y);
                        ctx.restore();
                      }
                    });
                  });
                },
              };

              var maxSpecVal = Math.max.apply(null, sortedSpec.map(function (d) { return Number(d.visit_count) || 0; }));
              var specXMax = Math.ceil((maxSpecVal || 1) * 1.35);

              charts.specDist = renderBarChart('chartSpecDist',
                sortedSpec.map(function (d) { return d.speciality_name; }),
                [{
                  label: 'Visits',
                  data: sortedSpec.map(function (d) { return Number(d.visit_count) || 0; }),
                  backgroundColor: '#0d7c78',
                  borderRadius: 6,
                }],
                true,
                [barValuePlugin],
                {
                  layout: { padding: { right: 55 } },
                  scales: {
                    x: {
                      beginAtZero: true,
                      max: specXMax,
                      ticks: { precision: 0, stepSize: 1, font: { family: 'Inter', size: 11 } },
                      grid: { color: 'rgba(0,0,0,0.05)' },
                    },
                  },
                });
            }

            // 5. Ward Bed Occupancy Breakdown Chart
            if (!$scope.emptyCharts.bedOcc) {
              charts.bedOcc = renderBarChart('chartBedOcc',
                bedOcc.map(function (d) { return d.ward_name; }),
                [
                  { label: 'Occupied', data: bedOcc.map(function (d) { return Number(d.occupied) || 0; }), backgroundColor: '#ef4444', borderRadius: 4 },
                  { label: 'Available', data: bedOcc.map(function (d) { return Number(d.available) || 0; }), backgroundColor: '#10b981', borderRadius: 4 },
                  { label: 'Maintenance', data: bedOcc.map(function (d) { return Number(d.maintenance) || 0; }), backgroundColor: '#f59e0b', borderRadius: 4 },
                ],
                true);
            }
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
