// On mobile, point "Play now" / sticky CTA straight at the right store
// instead of scrolling to the badges.
(function () {
  var ua = navigator.userAgent;
  var store = /android/i.test(ua)
    ? 'https://play.google.com/store/apps/details?id=pt.app63'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'https://apps.apple.com/app/63/id6449913779'
      : null;
  if (!store) return;
  document.querySelectorAll('.js-store-cta').forEach(function (a) {
    a.href = store;
  });
})();
