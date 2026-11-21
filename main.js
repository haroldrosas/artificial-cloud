const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');
const narrowScreen = window.matchMedia('(max-width: 820px)');

function setMenu(open) {
  const expanded = narrowScreen.matches && open;
  menuButton.setAttribute('aria-expanded', String(expanded));
  navigation.hidden = narrowScreen.matches && !expanded;
}

function syncNavigation() {
  menuButton.hidden = !narrowScreen.matches;
  setMenu(false);
}

menuButton.addEventListener('click', () => {
  setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
});

navigation.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (link && narrowScreen.matches && menuButton.getAttribute('aria-expanded') === 'true') {
    if (link.hasAttribute('download')) {
      menuButton.focus();
    } else if (link.hash) {
      const target = document.getElementById(link.hash.slice(1));
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
    }
    setMenu(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
});

narrowScreen.addEventListener('change', syncNavigation);
syncNavigation();

const heroVideo = document.querySelector('.hero-video');
if (heroVideo) {
  const control = document.querySelector('.hero-video-control');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let onscreen = typeof IntersectionObserver !== 'function';
  let userPaused = false;

  function syncHeroVideo() {
    if (motion.matches || connection?.saveData) {
      heroVideo.pause();
      heroVideo.classList.remove('has-frame');
      control.hidden = true;
      return;
    }
    if (!onscreen || document.hidden || userPaused) {
      heroVideo.pause();
      return;
    }
    if (!heroVideo.getAttribute('src')) heroVideo.src = heroVideo.dataset.src;
    heroVideo.play().catch(error => {
      if (error.name !== 'NotAllowedError' || motion.matches || connection?.saveData) return;
      control.textContent = 'Reproducir video';
      control.hidden = false;
    });
  }

  heroVideo.addEventListener('playing', () => {
    heroVideo.classList.add('has-frame');
    control.textContent = 'Pausar video';
    control.hidden = false;
  });
  heroVideo.addEventListener('pause', () => {
    control.textContent = 'Reproducir video';
  });
  heroVideo.addEventListener('error', () => {
    heroVideo.classList.remove('has-frame');
    control.hidden = true;
  });
  control.addEventListener('click', () => {
    userPaused = !heroVideo.paused;
    syncHeroVideo();
  });

  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(([entry]) => {
      onscreen = entry.intersectionRatio >= .18;
      syncHeroVideo();
    }, {threshold: .18});
    observer.observe(heroVideo.closest('.hero'));
  }
  document.addEventListener('visibilitychange', syncHeroVideo);
  motion.addEventListener('change', syncHeroVideo);
  connection?.addEventListener?.('change', syncHeroVideo);
  syncHeroVideo();
}
