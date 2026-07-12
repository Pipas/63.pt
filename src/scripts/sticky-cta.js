// Sticky mobile CTA: show once the hero scrolls out of view,
// hide again while the final CTA (with the store badges) is on screen.
(function () {
  var bar = document.getElementById('sticky-cta');
  var hero = document.getElementById('top');
  var final = document.getElementById('get');
  if (!bar || !hero || !final || !('IntersectionObserver' in window)) return;

  var heroVisible = true;
  var finalVisible = false;

  function update() {
    bar.classList.toggle('visible', !heroVisible && !finalVisible);
  }

  new IntersectionObserver(function (entries) {
    heroVisible = entries[0].isIntersecting;
    update();
  }, { threshold: 0.1 }).observe(hero);

  new IntersectionObserver(function (entries) {
    finalVisible = entries[0].isIntersecting;
    update();
  }, { threshold: 0.1 }).observe(final);
})();
