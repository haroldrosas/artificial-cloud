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
