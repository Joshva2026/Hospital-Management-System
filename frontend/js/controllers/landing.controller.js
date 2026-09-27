(function () {
  'use strict';

  angular.module('hmsApp').controller('LandingController', [
    '$scope',
    '$q',
    '$timeout',
    'ApiService',
    function ($scope, $q, $timeout, ApiService) {
      $scope.showLoginModal = false;

      $scope.openLoginModal = function () {
        $scope.showLoginModal = true;
      };

      $scope.closeLoginModal = function () {
        $scope.showLoginModal = false;
      };

      $scope.specialities = [];
      
      const imageMapping = {
        'Cardiology': 'https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?q=80&w=800&auto=format&fit=crop',
        'Neurology': 'https://images.unsplash.com/photo-1559757175-5700dde675bc?q=80&w=800&auto=format&fit=crop',
        'Orthopaedics': 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=800&auto=format&fit=crop',
        'Paediatrics': 'https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=800&auto=format&fit=crop',
        'General Surgery': 'https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=800&auto=format&fit=crop',
        'Emergency Care': 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=800&auto=format&fit=crop'
      };
      
      const defaultImage = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop';

      function loadData() {
        $q.all([
          ApiService.get('/public/specialities'),
          ApiService.get('/public/doctors')
        ]).then(function(results) {
          var specsRes = results[0];
          var docsRes = results[1];

          if (specsRes.data && specsRes.data.success && docsRes.data && docsRes.data.success) {
            var allDocs = docsRes.data.data;
            
            $scope.specialities = specsRes.data.data.map(function(s) {
              var docsForSpec = allDocs.filter(function(d) { return d.speciality_id === s.speciality_id; });
              
              var doctorsWithImages = docsForSpec.map(function(d) {
                var neutralImage = 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=800&auto=format&fit=crop'; // Neutral professional medical setting
                
                return {
                  name: d.doctor_name,
                  qualification: d.qualification,
                  experience: d.experience_years,
                  image: neutralImage
                };
              });

              return {
                name: s.speciality_name,
                desc: s.department_description || 'Specialized medical care and consultation.',
                image: imageMapping[s.speciality_name] || defaultImage,
                doctors: doctorsWithImages
              };
            });
            
            $timeout(setupScrollReveal, 100);
          }
        }).catch(function(err) {
          console.error('Failed to load public data', err);
        });
      }
      
      function setupScrollReveal() {
        var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var elements = document.querySelectorAll('.reveal');
        
        if (prefersReducedMotion) {
          elements.forEach(function(el) { el.classList.add('active'); });
          return;
        }

        var observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('active');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1 });

        elements.forEach(function(el) { observer.observe(el); });
      }

      loadData();
    },
  ]);
})();
