(function () {
  'use strict';

  angular.module('hmsApp').controller('LandingController', [
    '$scope',
    'ApiService',
    function ($scope, ApiService) {
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

      function loadSpecialities() {
        ApiService.get('/specialities').then(function(res) {
          if (res.data && res.data.success) {
            $scope.specialities = res.data.data.map(function(s) {
              return {
                name: s.name,
                desc: s.description || 'Specialized medical care and consultation.',
                image: imageMapping[s.name] || defaultImage
              };
            });
          }
        }).catch(function(err) {
          console.error('Failed to load specialities', err);
        });
      }
      
      loadSpecialities();
    },
  ]);
})();
