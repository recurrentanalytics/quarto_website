// Making-of articles (pages with a .rac-backlink): a jump list to the sections on screens
// where Quarto's table of contents is hidden, and the long side parts (reading guide, data
// and credits, references) folded into <details>, closed on phones and open on wider screens.
// The headings stay where they are, the text is not changed or moved. Without JS the page is
// the plain article.
(function () {
  function run() {
    var back = document.querySelector('main .rac-backlink');
    if (!back) return;
    var sections = document.querySelectorAll('main section.level2');

    // Side parts: id of the section -> label of the fold.
    var folds = {
      'a-reading-guide': 'Reading list',
      'data-and-sources': 'Data and credits',
      'data-and-licences': 'Data and credits',
      'references': 'All references'
    };
    var wide = window.matchMedia('(min-width: 768px)').matches;
    Array.prototype.forEach.call(sections, function (sec) {
      var label = folds[sec.id];
      var h = sec.querySelector(':scope > h2');
      if (!label || !h) return;
      var d = document.createElement('details');
      d.className = 'rac-fold';
      if (wide) d.open = true;
      var s = document.createElement('summary');
      s.textContent = label;
      d.appendChild(s);
      while (h.nextSibling) d.appendChild(h.nextSibling);
      sec.appendChild(d);
    });

    // Jump list: one link per second-level heading, from the headings themselves.
    if (sections.length > 2) {
      var nav = document.createElement('nav');
      nav.className = 'rac-jump';
      nav.setAttribute('aria-label', 'Sections of this article');
      var det = document.createElement('details');
      var sum = document.createElement('summary');
      sum.textContent = 'Jump to a section';
      det.appendChild(sum);
      var ol = document.createElement('ol');
      Array.prototype.forEach.call(sections, function (sec) {
        var h = sec.querySelector(':scope > h2');
        if (!h || !sec.id) return;
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + sec.id;
        a.textContent = h.textContent;
        li.appendChild(a);
        ol.appendChild(li);
      });
      det.appendChild(ol);
      nav.appendChild(det);
      ol.addEventListener('click', function (ev) {
        if (ev.target.closest('a')) det.open = false;
      });
      back.parentNode.insertBefore(nav, back.nextSibling);
    }

    // A link into a closed fold (a section link, a citation, an address with #) opens it.
    function openFor(id) {
      if (!id) return;
      var el = document.getElementById(id);
      if (!el) return;
      var d = el.closest('details.rac-fold');
      if (d && !d.open) { d.open = true; el.scrollIntoView(); }
    }
    window.addEventListener('hashchange', function () { openFor(decodeURIComponent(location.hash.slice(1))); });
    openFor(decodeURIComponent(location.hash.slice(1)));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
