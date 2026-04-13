const siteYear = document.getElementById('site-year');
const NAV_STORAGE_KEY = 'sovereign-standard.nav';

if (siteYear) {
  siteYear.textContent = new Date().getFullYear();
}

const pageName = document.body?.dataset.page || '';
const fluidRoot = document.querySelector('[data-fluid-root]');

if (fluidRoot) {
  const resetFluidState = () => {
    document.body.classList.remove('page-is-entering', 'page-is-exiting');
    document.body.classList.add('page-is-ready');
    delete document.body.dataset.navKind;
    delete document.body.dataset.navFrom;
    document.documentElement.classList.remove('has-pending-nav');
  };

  const pendingState = (() => {
    try {
      const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      const destination = parsed?.to || '';
      const matchesDestination = destination.includes(`${pageName}.html`)
        || (pageName === 'index' && (destination === '/' || destination.endsWith('/')));

      return matchesDestination ? parsed : null;
    } catch {
      return null;
    }
  })();

  if (pendingState) {
    document.body.dataset.navKind = pendingState.kind || '';
    document.body.dataset.navFrom = pendingState.fromPage || '';
    document.body.classList.add('page-is-entering');

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.body.classList.add('page-is-ready');
        document.body.classList.remove('page-is-entering');
        document.documentElement.classList.remove('has-pending-nav');
      });
    });

    window.setTimeout(() => {
      try {
        sessionStorage.removeItem(NAV_STORAGE_KEY);
      } catch {
      }
    }, 500);
  } else {
    resetFluidState();
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      resetFluidState();

      try {
        sessionStorage.removeItem(NAV_STORAGE_KEY);
      } catch {
      }
    }
  });

  window.addEventListener('pagehide', () => {
    if (document.body.classList.contains('page-is-exiting')) {
      document.body.classList.remove('page-is-ready');
    }
  });

  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) {
      return;
    }

    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || link.hasAttribute('download')) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) {
      return;
    }

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return;
    }

    const isSameDocument = url.pathname === window.location.pathname && url.search === window.location.search;
    if (isSameDocument) {
      return;
    }

    event.preventDefault();

    const navKind = link.dataset.navKind || 'page-flow';
    document.body.dataset.navKind = navKind;
    document.body.classList.add('page-is-exiting');

    try {
      sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify({
        from: window.location.pathname + window.location.search,
        to: url.pathname + url.search,
        fromPage: pageName,
        kind: navKind,
        at: Date.now()
      }));
    } catch {
    }

    window.setTimeout(() => {
      window.location.href = url.toString();
    }, 190);
  });
}

const finePointer = window.matchMedia('(pointer: fine)').matches;

if (finePointer) {
  document.documentElement.classList.add('has-custom-cursor');

  const cursorDot = document.createElement('div');
  cursorDot.className = 'cursor-dot';
  document.body.appendChild(cursorDot);

  const moveCursor = (event) => {
    cursorDot.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    cursorDot.classList.add('is-visible');
  };

  document.addEventListener('mousemove', moveCursor);
  document.addEventListener('mouseleave', () => {
    cursorDot.classList.remove('is-visible');
  });
  document.addEventListener('mouseenter', () => {
    cursorDot.classList.add('is-visible');
  });
}
