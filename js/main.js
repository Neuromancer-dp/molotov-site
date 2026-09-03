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

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-live-clock]').forEach(startClock);
  });
})();
