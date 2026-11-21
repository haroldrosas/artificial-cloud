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

const hero = document.querySelector('.hero');
const heroScene = hero?.querySelector('.hero-scene');
const heroMotion = window.matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 501px)');
let heroFrame = 0;
let lastHeroProgress = -1;

function updateHeroProgress() {
  heroFrame = 0;
  if (hero.classList.contains('rack-open')) return;
  const travel = hero.offsetHeight - heroScene.offsetHeight;
  if (travel <= 0) return;
  const progress = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / travel));
  if (progress === lastHeroProgress) return;
  const eased = progress * progress * (3 - 2 * progress);
  heroScene.style.setProperty('--hero-progress', eased.toFixed(4));
  lastHeroProgress = progress;
}

function scheduleHeroProgress() {
  if (heroMotion.matches && !heroFrame) heroFrame = requestAnimationFrame(updateHeroProgress);
}

function syncHeroMotion() {
  hero.classList.toggle('hero-immersive', heroMotion.matches);
  if (heroMotion.matches) scheduleHeroProgress();
  else {
    cancelAnimationFrame(heroFrame);
    heroFrame = 0;
  }
}

if (heroScene) {
  heroMotion.addEventListener('change', syncHeroMotion);
  window.addEventListener('resize', scheduleHeroProgress);
  window.addEventListener('scroll', scheduleHeroProgress, {passive: true});
  new MutationObserver(scheduleHeroProgress).observe(hero, {attributeFilter: ['class']});
  syncHeroMotion();
}
