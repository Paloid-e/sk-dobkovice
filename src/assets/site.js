(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* odhalování sekcí při scrollu */
  var revealed = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || reduced) {
    revealed.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    revealed.forEach(function (el) { io.observe(el); });
  }

  /* odpočet do výkopu */
  var cd = document.getElementById("countdown");
  if (cd) {
    var kickoff = new Date(cd.getAttribute("data-kickoff")).getTime();
    var elD = document.getElementById("cd-d"),
        elH = document.getElementById("cd-h"),
        elM = document.getElementById("cd-m"),
        elS = document.getElementById("cd-s");
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    var timer = setInterval(tickCd, 1000);
    function tickCd() {
      var diff = kickoff - Date.now();
      if (diff <= 0) {
        clearInterval(timer);
        /* do 2 hodin od výkopu se hraje, pak je odehráno */
        var msg = (Date.now() - kickoff < 2 * 3600 * 1000) ? "Právě hrajeme!" : "Odehráno";
        cd.innerHTML = '<div class="cd-live">' + msg + "</div>";
        return;
      }
      var s = Math.floor(diff / 1000);
      elD.textContent = pad(Math.floor(s / 86400));
      elH.textContent = pad(Math.floor(s % 86400 / 3600));
      elM.textContent = pad(Math.floor(s % 3600 / 60));
      elS.textContent = pad(s % 60);
    }
    tickCd();
  }

  /* počítadla statistik */
  var counters = document.querySelectorAll("[data-count]");
  if (!reduced && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        cio.unobserve(entry.target);
        var el = entry.target;
        var target = parseInt(el.getAttribute("data-count"), 10);
        var start = null;
        var dur = 900;
        function tick(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased);
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }
})();
