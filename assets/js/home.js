/* POLIS homepage: hero typing, carousel, journal and calendar.
   Vanilla JS, no dependencies. Content comes from /data/*.json. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }

  /* Build an element. Text always goes in as text, never as HTML. */
  function el(tag, props, kids) {
    var node = doc.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (props[k] == null || props[k] === false) return;
      if (k === 'className') node.className = props[k];
      else node.setAttribute(k, props[k] === true ? '' : props[k]);
    });
    (kids || []).forEach(function (kid) {
      if (kid == null || kid === '') return;
      node.appendChild(typeof kid === 'string' ? doc.createTextNode(kid) : kid);
    });
    return node;
  }

  function text(v) { return typeof v === 'string' ? v.trim() : ''; }

  function safeUrl(u) {
    u = text(u);
    return u && !/^(javascript|data|vbscript):/i.test(u) ? u : null;
  }

  function getJSON(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    }).catch(function (err) {
      if (window.console) console.warn('[polis] could not load', path, err);
      return null;
    });
  }

  /* "2026-11-03" -> local Date. Anything else (a [placeholder]) -> null. */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(s));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmtDate(s, opts) {
    var d = parseDate(s);
    return d ? d.toLocaleDateString('en-US', opts) : text(s);
  }
  var LONG = { month: 'long', day: 'numeric', year: 'numeric' };
  var SHORT = { month: 'short', day: 'numeric' };
  var EVENT = { weekday: 'short', month: 'short', day: 'numeric' };


  /* ------------------------------------------------------------------
     Hero typing
     ------------------------------------------------------------------ */

  var CHAR_MS = 40;         /* per character */
  var LINE_PAUSE_MS = 340;  /* extra beat at each line break */
  var START_DELAY_MS = 450;

  function initTyping() {
    var layer = $('.hero-type');
    if (!layer || !root.classList.contains('will-type')) return;

    window.__polisTyping = true;
    try { sessionStorage.setItem('polisHeroTyped', '1'); } catch (e) {}

    /* Split each line into a typed part and a hidden remainder. The remainder
       still takes up its space, so nothing moves as characters appear. */
    var lines = [].slice.call(layer.querySelectorAll('.line')).map(function (line) {
      var full = line.textContent;
      var typed = el('span', { className: 'typed' });
      var rest = el('span', { className: 'rest' }, [full]);
      line.textContent = '';
      line.appendChild(typed);
      line.appendChild(rest);
      return { full: full, typed: typed, rest: rest, n: 0 };
    });
    if (!lines.length) { root.classList.remove('will-type'); return; }

    root.classList.add('is-typing');
    root.classList.remove('will-type');
    lines[0].typed.classList.add('has-caret');

    var li = 0, wait = START_DELAY_MS, acc = 0, last = null;

    function frame(now) {
      if (last === null) last = now;
      /* rAF stops in a hidden tab; the clamp keeps it from "catching up" on return. */
      acc += Math.min(now - last, 100);
      last = now;

      while (li < lines.length && acc >= wait) {
        acc -= wait;
        var ln = lines[li];
        ln.n += 1;
        ln.typed.textContent = ln.full.slice(0, ln.n);
        ln.rest.textContent = ln.full.slice(ln.n);
        wait = CHAR_MS;

        if (ln.n >= ln.full.length) {
          li += 1;
          if (li < lines.length) {
            ln.typed.classList.remove('has-caret');
            lines[li].typed.classList.add('has-caret');
            wait = CHAR_MS + LINE_PAUSE_MS;
          }
        }
      }

      if (li < lines.length) requestAnimationFrame(frame);
      else finish();
    }

    function finish() {
      root.classList.remove('is-typing');           /* supporting copy fades in */
      setTimeout(function () {
        root.classList.add('caret-out');            /* caret fades ~1s after the last key */
        setTimeout(function () {
          lines[lines.length - 1].typed.classList.remove('has-caret');
        }, 600);
      }, 1000);
    }

    doc.addEventListener('visibilitychange', function () { last = null; });
    requestAnimationFrame(frame);
  }


  /* ------------------------------------------------------------------
     Site settings (site.json)
     ------------------------------------------------------------------ */

  function currentSemester() {
    var d = new Date(), m = d.getMonth();
    return (m <= 4 ? 'Spring ' : m <= 7 ? 'Summer ' : 'Fall ') + d.getFullYear();
  }

  function setText(sel, value) {
    var node = $(sel);
    if (node && text(value)) node.textContent = text(value);
  }

  function applySite(site) {
    site = site || {};
    setText('[data-semester]', text(site.semester) || currentSemester());
    setText('[data-hero-support]', site.heroSupport);
    setText('[data-network-disclaimer]', site.networkDisclaimer);
    setText('[data-people-line]', site.peopleLine);

    var credit = $('[data-hero-credit]');
    if (credit && text(site.heroCredit)) {
      credit.textContent = text(site.heroCredit);
      credit.hidden = false;
    }

    var apply = safeUrl(site.applyUrl);
    if (apply) [].forEach.call(doc.querySelectorAll('[data-apply]'), function (a) { a.href = apply; });
  }


  /* ------------------------------------------------------------------
     Carousel
     ------------------------------------------------------------------ */

  var LOGO_DIR = 'assets/logos/';
  var PX_PER_SECOND = 55;

  function showAsLogo(entry, mode) {
    if (!text(entry.file)) return false;
    if (mode === 'text') return false;
    if (mode === 'logos') return true;
    return entry.displayMode !== 'text';          /* mixed: per entry */
  }

  function plate(name, fallback) {
    return el('span', { className: 'plate' + (fallback ? ' plate--fallback' : '') }, [name]);
  }

  function orgItem(entry, mode, clone) {
    var name = text(entry.name);
    var inner;

    if (showAsLogo(entry, mode)) {
      inner = el('img', { src: LOGO_DIR + encodeURIComponent(text(entry.file)), alt: name, loading: 'lazy', decoding: 'async' });
      inner.addEventListener('error', function () {
        inner.replaceWith(plate(name, true));
      });
    } else {
      inner = plate(name, false);
    }

    var url = safeUrl(entry.url);
    if (url) {
      inner = el('a', { href: url, rel: 'noopener', tabindex: clone ? '-1' : null }, [inner]);
    }
    return el('li', { className: 'org', 'aria-hidden': clone ? 'true' : null }, [inner]);
  }

  function buildSet(entries, mode, clone, repeats) {
    var set = el('ul', { className: 'marquee-set', 'aria-hidden': clone ? 'true' : null });
    for (var r = 0; r < repeats; r++) {
      entries.forEach(function (entry) { set.appendChild(orgItem(entry, mode, clone || r > 0)); });
    }
    return set;
  }

  function renderCarousel(site, logos) {
    var track = $('[data-marquee-track]');
    var entries = (Array.isArray(logos) ? logos : (logos && logos.logos) || []).filter(function (e) { return e && text(e.name); });
    if (!track || !entries.length) return;

    var mode = site && /^(logos|text|mixed)$/.test(site.carouselMode) ? site.carouselMode : 'text';

    track.textContent = '';
    var first = buildSet(entries, mode, false, 1);
    track.appendChild(first);
    if (reducedMotion) return;                    /* static wrapped grid, no clone */

    /* One set has to be wider than the screen or the loop shows a gap. */
    var w = first.getBoundingClientRect().width;
    var repeats = w > 0 ? Math.min(6, Math.ceil(Math.max(window.innerWidth, 1) / w)) : 1;
    if (repeats > 1) {
      track.replaceChild(first = buildSet(entries, mode, false, repeats), track.firstChild);
      w = first.getBoundingClientRect().width;
    }
    track.appendChild(buildSet(entries, mode, true, repeats));
    track.style.setProperty('--marquee-duration', Math.max(20, Math.round(w / PX_PER_SECOND)) + 's');
  }


  /* ------------------------------------------------------------------
     Journal
     ------------------------------------------------------------------ */

  function byline(a) {
    var bits = [];
    if (text(a.author)) bits.push('by ' + text(a.author));
    if (text(a.date)) bits.push(fmtDate(a.date, LONG));
    return bits.join(', ');
  }

  function titleNode(a) {
    var url = safeUrl(a.url);
    return url ? el('a', { href: url }, [text(a.title)]) : text(a.title);
  }

  function renderArticles(data) {
    var leadBox = $('[data-lead-article]'), list = $('[data-article-list]');
    if (!leadBox || !list) return;

    var articles = (Array.isArray(data) ? data : (data && data.articles) || []).filter(function (a) { return a && text(a.title); });
    if (!articles.length) {
      leadBox.appendChild(el('p', { className: 'empty' }, ['Nothing published yet.']));
      return;
    }

    /* Newest first; entries without a real date keep their file order. */
    articles = articles.map(function (a, i) { return { a: a, i: i, d: parseDate(a.date) }; })
      .sort(function (x, y) { return x.d && y.d ? y.d - x.d || x.i - y.i : x.i - y.i; })
      .map(function (x) { return x.a; });

    var leadIdx = 0;
    articles.forEach(function (a, i) { if (a.lead === true && leadIdx === 0) leadIdx = i; });
    var lead = articles.splice(leadIdx, 1)[0];

    leadBox.appendChild(el('article', { className: 'lead' }, [
      el('h3', { className: 'lead-title' }, [titleNode(lead)]),
      text(lead.excerpt) ? el('p', { className: 'lead-excerpt' }, [text(lead.excerpt)]) : null,
      byline(lead) ? el('p', { className: 'byline' }, [byline(lead)]) : null
    ]));

    articles.slice(0, 4).forEach(function (a) {
      list.appendChild(el('li', {}, [
        el('span', { className: 'article-date' }, [fmtDate(a.date, SHORT)]),
        el('span', { className: 'article-title' }, [
          titleNode(a),
          text(a.author) ? el('span', { className: 'article-author' }, ['by ' + text(a.author)]) : null
        ])
      ]));
    });
  }


  /* ------------------------------------------------------------------
     Calendar
     ------------------------------------------------------------------ */

  function renderEvents(data) {
    var dl = $('[data-events]'), past = $('[data-past-speakers]');
    data = data || {};

    if (dl) {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var upcoming = (data.upcoming || [])
        .filter(function (e) { return e && text(e.name); })
        .map(function (e, i) { return { e: e, i: i, d: parseDate(e.date) }; })
        .filter(function (x) { return !x.d || x.d >= today; })      /* drop anything already over */
        .sort(function (x, y) { return x.d && y.d ? x.d - y.d || x.i - y.i : x.i - y.i; });

      if (!upcoming.length) {
        dl.appendChild(el('dd', { className: 'empty' }, ['Nothing on the books right now.']));
      }
      upcoming.slice(0, 5).forEach(function (x) {
        var e = x.e;
        var when = [fmtDate(e.date, EVENT), text(e.time)].filter(Boolean).join(', ');
        var line = [when, text(e.venue)].filter(Boolean).join(' · ');
        var rsvp = safeUrl(e.rsvpUrl);
        dl.appendChild(el('dt', {}, [text(e.name)]));
        dl.appendChild(el('dd', {}, [
          line,
          rsvp ? (line ? ' · ' : '') : null,
          rsvp ? el('a', { href: rsvp, 'aria-label': 'RSVP for ' + text(e.name) }, ['RSVP']) : null
        ]));
      });
    }

    if (past) {
      (data.pastSpeakers || []).filter(function (s) { return s && text(s.name); }).slice(0, 8).forEach(function (s) {
        past.appendChild(el('li', {}, [
          text(s.name),
          text(s.note) ? el('span', { className: 'speaker-note' }, [', ' + text(s.note)]) : null
        ]));
      });
    }
  }


  /* ------------------------------------------------------------------
     ⌘K palette
     The palette itself is the existing site script. This button asks it to
     open three ways; whichever one that script understands will work.
     ------------------------------------------------------------------ */

  function initPaletteButton() {
    var btn = $('[data-open-palette]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (typeof window.openPalette === 'function') { window.openPalette(); return; }
      doc.dispatchEvent(new CustomEvent('polis:open-palette', { bubbles: true }));
      var mac = /Mac|iPhone|iPad/.test(navigator.platform || '');
      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: mac, ctrlKey: !mac, bubbles: true }));
    });
  }


  /* ------------------------------------------------------------------ */

  initTyping();
  initPaletteButton();

  var site = getJSON('data/site.json');
  site.then(applySite);
  Promise.all([site, getJSON('data/logos.json')]).then(function (r) { renderCarousel(r[0], r[1]); });
  getJSON('data/articles.json').then(renderArticles);
  getJSON('data/events.json').then(renderEvents);
})();
