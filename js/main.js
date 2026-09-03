// Molotov Studios — shared site behavior

(function () {
  'use strict';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime(date) {
    return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function startClock(el) {
    if (!el) return;
    var tick = function () {
      el.textContent = formatTime(new Date());
    };
    tick();
    setInterval(tick, 1000);
  }

  function initSmoothScroll(reduceMotion) {
    if (reduceMotion || typeof Lenis === 'undefined') return null;

    var lenis = new Lenis({
      duration: 1.1,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
    });

    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
    }

    if (typeof gsap !== 'undefined') {
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      });
    }

    return lenis;
  }

  function initScrollReveal(reduceMotion) {
    var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

    // If animation libs failed to load or the user prefers reduced motion,
    // drop the CSS hook that hides [data-reveal] elements so content stays visible.
    if (!hasGsap || reduceMotion) {
      document.documentElement.classList.remove('js-reveal');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      gsap.set(el, { y: 28 });
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });
    });

    document.querySelectorAll('[data-reveal-group]').forEach(function (group) {
      var items = Array.prototype.slice.call(group.children);
      if (!items.length) return;
      gsap.set(items, { y: 24 });
      gsap.to(items, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: group,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });
    });
  }

  function initCounters(reduceMotion) {
    var hasGsap = typeof gsap !== 'undefined';
    var hasScrollTrigger = typeof ScrollTrigger !== 'undefined';

    document.querySelectorAll('[data-count-to]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count-to'));
      var digits = parseInt(el.getAttribute('data-count-digits') || '0', 10);

      var render = function (val) {
        el.textContent = String(Math.round(val)).padStart(digits, '0');
      };

      if (reduceMotion || !hasGsap || !hasScrollTrigger) {
        render(target);
        return;
      }

      var counter = { val: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.to(counter, {
            val: target,
            duration: 1.5,
            ease: 'power2.out',
            onUpdate: function () { render(counter.val); },
          });
        },
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-live-clock]').forEach(startClock);

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    initSmoothScroll(reduceMotion);
    initScrollReveal(reduceMotion);
    initCounters(reduceMotion);
  });
})();
