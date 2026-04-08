const siteYear = document.getElementById('site-year');

if (siteYear) {
  siteYear.textContent = new Date().getFullYear();
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
