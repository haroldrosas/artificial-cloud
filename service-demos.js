(() => {
  const dialog = document.querySelector('#service-demo');
  if (typeof dialog?.showModal !== 'function') return;

  const category = dialog.querySelector('[data-demo-category]');
  const title = dialog.querySelector('#service-demo-title');
  const body = dialog.querySelector('[data-demo-body]');
  const rack = document.querySelector('[data-rack-experience]');
  const rackHome = document.createComment('rack-experience');
  rack.before(rackHome);

  const captions = {
    cyber: 'Respuesta a una alerta de acceso',
    infra: 'Asignación de recursos para servidores virtuales',
    rack: 'Respaldo eléctrico en un rack 3D',
    cctv: 'Capacidad de grabación para cámaras IP',
    software: 'Revisión de una orden de compra',
    fiber: 'Continuidad en un anillo de fibra',
  };
  let active;

  for (const button of document.querySelectorAll('[data-service-demo]')) {
    button.hidden = false;
    button.addEventListener('click', () => openDemo(button));
  }

  async function openDemo(button) {
    if (active) return;
    const key = button.dataset.serviceDemo;
    const request = {button,key};
    active = request;
    category.textContent = button.closest('.service-card').querySelector('h3').textContent;
    title.textContent = captions[key];
    body.textContent = key === 'rack' ? '' : 'Cargando simulación…';
    dialog.showModal();
    dialog.scrollTop = 0;
    title.focus({preventScroll:true});

    if (key === 'rack') {
      body.append(rack);
      rack.dispatchEvent(new Event('rack-service-open'));
      return;
    }

    try {
      const {simulations} = await import('./service-simulations.js');
      if (active === request) simulations[key](body);
    } catch (error) {
      if (active === request) body.textContent = 'La simulación no pudo cargarse. Cierra el panel y vuelve a intentarlo.';
      console.error('Error al cargar la demostración.', error);
    }
  }

  function closeDemo() {
    const {button,key} = active;
    if (key === 'rack') {
      rackHome.after(rack);
      rack.dispatchEvent(new Event('rack-service-close'));
    }
    body.replaceChildren();
    active = undefined;
    dialog.close();
    button.focus({preventScroll:true});
  }

  dialog.querySelector('.service-demo-close').addEventListener('click', closeDemo);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeDemo();
  });
})();
