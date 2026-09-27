(function () {
  'use strict';

  angular.module('hmsApp').directive('scrollReveal', ['$timeout', function($timeout) {
    return {
      restrict: 'AC',
      link: function(scope, element, attrs) {
        var el = element[0];
        
        // Initial state
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        
        if (attrs.revealDelay) {
          el.style.transitionDelay = attrs.revealDelay + 'ms';
        }

        var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          return;
        }

        var observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              $timeout(function() {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
              });
              observer.unobserve(el);
            }
          });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        observer.observe(el);
        
        scope.$on('$destroy', function() {
          observer.disconnect();
        });
      }
    };
  }]);
})();
