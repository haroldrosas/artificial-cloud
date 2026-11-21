const decimal = new Intl.NumberFormat('es-PE', {maximumFractionDigits:2});

function buildPanel(container, markup) {
  const panel = document.createElement('div');
  panel.className = 'demo-panel';
  panel.innerHTML = markup;
  container.replaceChildren(panel);
  return selector => panel.querySelector(selector);
}

function cyber(container) {
  const find = buildPanel(container, `
    <div class="demo-grid">
      <section class="demo-card">
        <h3>Alerta de acceso</h3>
        <dl class="demo-incident">
          <div><dt>Cuenta de ejemplo</dt><dd>Operaciones</dd></div>
          <div><dt>Señal detectada</dt><dd>Inicio de sesión desde un equipo sin registrar</dd></div>
          <div><dt>Estado</dt><dd data-alert-state>Pendiente de revisión</dd></div>
        </dl>
        <div class="demo-actions">
          <button class="demo-button demo-primary" data-block type="button">Bloquear acceso</button>
          <button class="demo-button" data-notify type="button" disabled>Notificar al equipo</button>
          <button class="demo-button" data-reset type="button">Reiniciar</button>
        </div>
      </section>
      <section class="demo-card">
        <h3>Registro del incidente</h3>
        <ol class="demo-events" aria-label="Eventos del incidente">
          <li>El sistema generó una alerta para revisión.</li>
          <li data-event-block hidden>El analista bloqueó la sesión indicada por la alerta.</li>
          <li data-event-notify hidden>El equipo de seguridad recibió el incidente para seguimiento.</li>
        </ol>
        <p class="demo-status" role="status" data-alert-feedback></p>
      </section>
    </div>
    <p class="demo-note">Simulación didáctica con una cuenta y eventos ficticios.</p>
  `);
  const block = find('[data-block]');
  const notify = find('[data-notify]');
  const reset = find('[data-reset]');
  let phase = 0;

  function update() {
    find('[data-alert-state]').textContent = ['Pendiente de revisión','Acceso bloqueado','Incidente notificado'][phase];
    block.disabled = phase > 0;
    notify.disabled = phase !== 1;
    find('[data-event-block]').hidden = phase === 0;
    find('[data-event-notify]').hidden = phase < 2;
    find('[data-alert-feedback]').textContent = [
      'Revisa la señal y decide si bloqueas el acceso.',
      'Acceso bloqueado. Ya puedes escalar el incidente.',
      'El registro conserva el bloqueo y la notificación.',
    ][phase];
  }

  block.addEventListener('click', () => { phase = 1; update(); notify.focus(); });
  notify.addEventListener('click', () => { phase = 2; update(); reset.focus(); });
  reset.addEventListener('click', () => { phase = 0; update(); block.focus(); });
  update();
}

function infra(container) {
  const initial = [8,24,400];
  const resources = [
    {name:'vCPU asignadas',unit:'vCPU',limit:24},
    {name:'Memoria RAM',unit:'GB',limit:96},
    {name:'Almacenamiento SSD',unit:'GB',limit:1600},
  ];
  const profiles = {
    app: {name:'Aplicaciones', demand:[4,8,100]},
    data: {name:'Base de datos', demand:[8,32,400]},
  };
  const find = buildPanel(container, `
    <div class="demo-grid">
      <section class="demo-card">
        <h3>Nueva máquina virtual</h3>
        <label class="demo-label" for="demo-vm">Perfil de carga</label>
        <select class="demo-control" id="demo-vm">
          <option value="app">Servidor de aplicaciones</option>
          <option value="data">Servidor de base de datos</option>
        </select>
        <p class="demo-note" data-profile></p>
        <div class="demo-actions">
          <button class="demo-button demo-primary" data-add type="button">Añadir máquina virtual</button>
          <button class="demo-button" data-reset type="button">Reiniciar</button>
        </div>
        <p class="demo-status" role="status" data-vm-status></p>
      </section>
      <section class="demo-card">
        <h3>Capacidad del servidor</h3>
        ${resources.map(({name,limit}, index) => `
          <div class="demo-resource">
            <div><span id="demo-resource-${index}">${name}</span><span data-resource="${index}"></span></div>
            <meter min="0" max="${limit}" value="0" aria-labelledby="demo-resource-${index}"></meter>
          </div>`).join('')}
      </section>
    </div>
    <p class="demo-note">Simulación didáctica de un servidor con capacidad fija. Las cifras representan recursos reservados.</p>
  `);
  const profileMenu = find('#demo-vm');
  const status = find('[data-vm-status]');
  let usage = [...initial];
  let added = 0;

  function showProfile() {
    const [cpu, ram, disk] = profiles[profileMenu.value].demand;
    find('[data-profile]').textContent = `${cpu} vCPU · ${ram} GB de RAM · ${disk} GB de SSD por máquina`;
  }
  function showUsage() {
    resources.forEach(({unit,limit}, index) => {
      const label = find(`[data-resource="${index}"]`);
      const meter = label.closest('.demo-resource').querySelector('meter');
      label.textContent = `${decimal.format(usage[index])} / ${decimal.format(limit)} ${unit}`;
      meter.value = usage[index];
      meter.setAttribute('aria-valuetext', label.textContent);
    });
  }

  find('[data-add]').addEventListener('click', () => {
    const profile = profiles[profileMenu.value];
    const nextUsage = usage.map((value, index) => value + profile.demand[index]);
    const deficits = resources.flatMap(({name,limit,unit}, index) =>
      nextUsage[index] > limit ? [`${name} (${decimal.format(nextUsage[index]-limit)} ${unit})`] : []);
    if (deficits.length) {
      status.dataset.tone = 'warning';
      status.textContent = `Capacidad insuficiente. Faltan recursos para ${deficits.join(', ')}.`;
      return;
    }
    usage = nextUsage;
    added += 1;
    status.dataset.tone = 'normal';
    status.textContent = `Máquina virtual añadida con el perfil «${profile.name}». Total añadido: ${added}.`;
    showUsage();
  });
  find('[data-reset]').addEventListener('click', () => {
    added = 0;
    usage = [...initial];
    profileMenu.value = 'app';
    status.dataset.tone = 'normal';
    status.textContent = 'Asignación inicial restaurada.';
    showProfile();
    showUsage();
  });
  profileMenu.addEventListener('change', showProfile);
  showProfile();
  showUsage();
}

function cctv(container) {
  const sliders = [
    {id:'cameras',label:'Cámaras IP',unit:'cámaras',min:4,max:128,step:1,value:32},
    {id:'bitrate',label:'Tasa por cámara',unit:'Mbps',min:1,max:12,step:.5,value:4},
    {id:'days',label:'Retención',unit:'días',min:7,max:90,step:1,value:30},
  ];
  const find = buildPanel(container, `
    <div class="demo-grid">
      <section class="demo-card demo-controls">
        <h3>Parámetros de grabación</h3>
        ${sliders.map(({id,label,min,max,step,value}) => `
          <div class="demo-field">
            <label class="demo-label" for="demo-${id}">${label}<output for="demo-${id}" data-value="${id}" aria-hidden="true"></output></label>
            <input type="range" id="demo-${id}" min="${min}" max="${max}" step="${step}" value="${value}">
          </div>`).join('')}
        <div class="demo-actions"><button type="button" class="demo-button" data-reset>Reiniciar</button></div>
      </section>
      <section class="demo-card">
        <h3>Dimensionamiento estimado</h3>
        <ol class="demo-flow" aria-label="Ruta de grabación">
          <li>Cámaras IP</li><li>Grabador o VMS</li><li>Almacenamiento</li>
        </ol>
        <dl class="demo-readouts" aria-live="polite" aria-atomic="true">
          <div><dt>Tráfico de video</dt><dd data-total-traffic></dd></div>
          <div><dt>Volumen de video</dt><dd data-total-storage></dd></div>
        </dl>
        <p class="demo-note">Grabación continua de 24 horas a tasa constante. El volumen se expresa en TB decimales antes de aplicar RAID y reservas de capacidad.</p>
      </section>
    </div>
    <p class="demo-note">Simulación didáctica para explorar cómo cambian los requisitos de grabación.</p>
  `);
  const inputs = sliders.map(({id}) => find(`#demo-${id}`));
  function update() {
    const [cameras, bitrate, days] = inputs.map(input => input.valueAsNumber);
    const traffic = cameras * bitrate;
    const storage = traffic * days * 86400 / 8000000;
    sliders.forEach(({id,unit}, index) => {
      const value = `${decimal.format(inputs[index].valueAsNumber)} ${unit}`;
      find(`[data-value="${id}"]`).value = value;
      inputs[index].setAttribute('aria-valuetext', value);
    });
    find('[data-total-traffic]').textContent = `${decimal.format(traffic)} Mbps`;
    find('[data-total-storage]').textContent = `${decimal.format(storage)} TB`;
  }
  for (const input of inputs) input.addEventListener('input', update);
  find('[data-reset]').addEventListener('click', () => {
    sliders.forEach(({value}, index) => { inputs[index].value = value; });
    update();
  });
  update();
}

function software(container) {
  const documents = [
    ['Orden de compra: OC-018','Proveedor: Suministros Horizonte','Concepto: Equipos de oficina','Total en soles: 2450.00'].join('\n'),
    ['Orden de compra: OC-024','Proveedor: Redes del Valle','Concepto: Material de conectividad','Total en soles: 6810.50'].join('\n'),
  ];
  const find = buildPanel(container, `
    <div class="demo-grid">
      <section class="demo-card">
        <h3>Documento de ejemplo</h3>
        <label class="demo-label" for="demo-document-select">Orden de compra</label>
        <select id="demo-document-select" class="demo-control">
          <option value="0">OC-018</option><option value="1">OC-024</option>
        </select>
        <pre class="demo-document" data-document></pre>
        <div class="demo-actions"><button type="button" class="demo-button demo-primary" data-extract>Extraer datos</button></div>
      </section>
      <section class="demo-card">
        <h3>Revisión de campos</h3>
        <p data-extraction-prompt>Procesa una orden para revisar los datos extraídos.</p>
        <form data-review hidden>
          <div class="demo-field"><label class="demo-label" for="demo-order">Número de orden</label><input class="demo-control" id="demo-order" required maxlength="40"></div>
          <div class="demo-field"><label class="demo-label" for="demo-supplier">Proveedor</label><input class="demo-control" id="demo-supplier" required maxlength="100"></div>
          <div class="demo-field"><label class="demo-label" for="demo-total">Total (S/)</label><input class="demo-control" id="demo-total" type="number" inputmode="decimal" min="0.01" step=".01" required></div>
          <div class="demo-actions"><button type="submit" class="demo-button demo-primary">Confirmar datos</button></div>
        </form>
        <p class="demo-status" role="status" data-extraction-status></p>
      </section>
    </div>
    <p class="demo-note">Simulación didáctica con documentos ficticios. La extracción usa patrones de texto y la confirmación queda en esta sesión.</p>
  `);
  const selected = find('#demo-document-select');
  const documentView = find('[data-document]');
  const form = find('[data-review]');
  const prompt = find('[data-extraction-prompt]');
  const status = find('[data-extraction-status]');
  const order = find('#demo-order');
  const supplier = find('#demo-supplier');
  const total = find('#demo-total');
  function showDocument() {
    documentView.textContent = documents[Number(selected.value)];
    prompt.hidden = false;
    form.hidden = true;
    status.textContent = '';
  }

  selected.addEventListener('change', showDocument);
  find('[data-extract]').addEventListener('click', () => {
    const fields = new Map(
      documents[Number(selected.value)].split('\n').map(line => line.split(': '))
    );
    order.value = fields.get('Orden de compra');
    supplier.value = fields.get('Proveedor');
    total.value = fields.get('Total en soles');
    prompt.hidden = true;
    form.hidden = false;
    status.textContent = 'Datos extraídos. Revísalos antes de confirmar.';
  });
  form.addEventListener('input', () => {
    status.textContent = 'Cambios pendientes de confirmar.';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    status.textContent = `Orden ${order.value.trim()} revisada y confirmada.`;
  });
  showDocument();
}

function fiber(container) {
  const links = [
    {id:'ab',label:'Sede A – Nodo B',primary:true},
    {id:'bc',label:'Nodo B – Sede C',primary:true},
    {id:'ad',label:'Sede A – Nodo D',primary:false},
    {id:'dc',label:'Nodo D – Sede C',primary:false},
  ];
  const find = buildPanel(container, `
    <div class="demo-grid">
      <section class="demo-card">
        <h3>Falla de un enlace</h3>
        <label class="demo-label" for="demo-fiber">Tramo de fibra</label>
        <select class="demo-control" id="demo-fiber">
          ${links.map(({id,label}) => `<option value="${id}">${label}</option>`).join('')}
        </select>
        <div class="demo-actions">
          <button class="demo-button demo-primary" data-cut type="button">Simular corte</button>
          <button class="demo-button" data-restore type="button" disabled>Restablecer enlace</button>
        </div>
        <p class="demo-status" role="status" data-fiber-status></p>
      </section>
      <section class="demo-card">
        <h3>Ruta entre las sedes</h3>
        <div class="demo-ring" aria-hidden="true">
          <span class="demo-ring-node">Sede A</span><span class="demo-ring-node">Nodo B</span>
          <span class="demo-ring-node">Nodo D</span><span class="demo-ring-node">Sede C</span>
          ${links.map(({id}) => `<i class="demo-ring-edge" data-link="${id}"></i>`).join('')}
        </div>
        <dl class="demo-readouts" aria-live="polite" aria-atomic="true">
          <div><dt>Ruta activa</dt><dd data-route></dd></div>
          <div><dt>Conectividad</dt><dd>Operativa</dd></div>
        </dl>
      </section>
    </div>
    <p class="demo-note">Simulación didáctica de un anillo con dos rutas entre las sedes. La ruta de respaldo entra en servicio cuando falla un tramo de la principal.</p>
  `);
  const select = find('#demo-fiber');
  const cut = find('[data-cut]');
  const restore = find('[data-restore]');
  let failedLink;

  function update() {
    const useBackup = failedLink?.primary === true;
    for (const link of links) {
      const active = link.primary !== useBackup;
      find(`[data-link="${link.id}"]`).dataset.state = link === failedLink ? 'cut' : active ? 'active' : 'standby';
    }
    find('[data-route]').textContent = useBackup ? 'A → D → C' : 'A → B → C';
    restore.disabled = !failedLink;
    cut.disabled = Boolean(failedLink);
    select.disabled = Boolean(failedLink);
    const status = find('[data-fiber-status]');
    status.dataset.tone = failedLink ? 'warning' : 'normal';
    if (!failedLink) {
      status.textContent = 'Ruta principal activa. La ruta de respaldo está disponible.';
    } else {
      const next = useBackup ? 'El tráfico continúa por la ruta de respaldo.' : 'El tráfico continúa por la ruta principal.';
      status.textContent = `Corte en ${failedLink.label}. ${next}`;
    }
  }

  cut.addEventListener('click', () => {
    failedLink = links.find(link => link.id === select.value);
    update();
    restore.focus();
  });
  restore.addEventListener('click', () => {
    failedLink = undefined;
    update();
    cut.focus();
  });
  update();
}

export const simulations = {cyber, infra, cctv, software, fiber};
