(() => {
  const experience = document.querySelector('[data-rack-experience]');
  const viewer = experience.querySelector('.rack-viewer');
  const stage = experience.querySelector('.rack-stage');
  const gpuCanvas = stage.querySelector('.rack-gpu');
  const cpuCanvas = stage.querySelector('.rack-cpu');
  const launch = experience.querySelector('.rack-launch');
  const close = experience.querySelector('.rack-close');
  const explore = experience.querySelector('.rack-explore');
  const tour = experience.querySelector('.rack-tour');
  const powerPanel = experience.querySelector('.rack-power');
  const powerToggle = powerPanel.querySelector('.rack-power-toggle');
  const advanceTime = powerPanel.querySelector('.rack-power-advance');
  const load = powerPanel.querySelector('#rack-load');
  const loadValue = powerPanel.querySelector('#rack-load-value');
  const announcement = powerPanel.querySelector('[data-power-announcement]');
  const powerOutputs = new Map(
    ['grid', 'ups', 'pdu', 'rack', 'runtime', 'battery'].map(name => [name, powerPanel.querySelector(`[data-power-${name}]`)])
  );
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const status = experience.querySelector('.rack-status');
  const description = experience.querySelector('.rack-description');
  const hero = experience.closest('.hero');
  const pins = [...stage.querySelectorAll('.rack-pin')];
  const selectors = [...experience.querySelectorAll('[data-rack-part]')];
  const parts = {
    servers: { id: 1, anchor: [0.54, 0.46, 0.83], copy: 'Los servidores ejecutan aplicaciones y alojan máquinas virtuales. La carga del rack influye en la autonomía de la UPS.' },
    network: { id: 2, anchor: [-0.46, 1.26, 0.84], copy: 'El switch conecta los servidores con la red. En este escenario recibe energía de la PDU y sigue operativo mientras la UPS tenga batería.' },
    power: { id: 3, anchor: [0.48, -1.24, 0.83], copy: 'La UPS alimenta la PDU durante un corte. La autonomía disminuye a medida que aumenta el consumo del rack.' },
    pdu: { id: 4, anchor: [-0.51, -0.70, 0.83], copy: 'La PDU recibe la alimentación de la UPS y la distribuye al switch y a los servidores.' },
  };
  const startYaw = 0.42;
  const startPitch = 0.16;
  let yaw = startYaw;
  let pitch = startPitch;
  let current = 'servers';
  let renderer;
  let drag;
  let frameId = 0;
  let open = false;
  let exploded = false;
  let spread = 0;
  let spreadTransition;
  let tourTimer;
  const tourOrder = ['network', 'servers', 'pdu', 'power'];
  const batteryCapacity = 360;
  const advanceMinutes = 5;
  let batteryEnergy = batteryCapacity;
  let gridOnline = true;
  let powerState = 0;

  const vertex = `
    attribute vec3 point, normal, color;
    attribute float part, glow;
    uniform mat4 projectionView;
    uniform float spread;
    uniform vec2 doorRotation;
    varying vec3 vWorld, vNormal, vColor;
    varying float vPart, vGlow;
    void main() {
      vWorld = point;
      vNormal = normal;
      if (part > 4.5) {
        vec2 hinge = vec2(0.855, 0.75);
        vec2 relative = point.xz - hinge;
        mat2 rotation = mat2(doorRotation.x, -doorRotation.y, doorRotation.y, doorRotation.x);
        vWorld.xz = hinge + rotation * relative;
        vNormal.xz = rotation * normal.xz;
      } else if (part > 0.5) {
        vWorld.z += spread * (part > 1.5 && part < 2.5 ? 0.34 : 0.56);
      }
      vColor = color; vPart = part; vGlow = glow;
      gl_Position = projectionView * vec4(vWorld, 1.0);
    }`;
  const fragment = `
    precision mediump float;
    uniform vec3 eye;
    uniform float selected;
    uniform float powerState;
    varying vec3 vWorld, vNormal, vColor;
    varying float vPart, vGlow;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 viewDirection = normalize(eye - vWorld);
      vec3 key = normalize(vec3(-0.4, 0.8, 1.0));
      vec3 rimLight = normalize(vec3(1.0, 0.3, -0.55));
      float diffuse = max(0.0, dot(n, key));
      float rimPower = pow(1.0 - abs(dot(n, viewDirection)), 2.0);
      float specular = pow(max(0.0, dot(n, normalize(viewDirection + key))), 20.0);
      float partSelected = vPart > 0.5 && abs(vPart - selected) < 0.2 ? 1.0 : 0.0;
      vec3 c = vColor * (0.62 + 0.53 * diffuse);
      c += vec3(0.06, 0.17, 0.22) * max(0.0, dot(n, rimLight));
      c += vec3(0.08, 0.22, 0.29) * rimPower * 0.48;
      c += vec3(0.24, 0.39, 0.49) * specular * 0.22;
      c += partSelected * vec3(0.015, 0.11, 0.145);
      c = mix(c, vColor, vGlow);
      c += partSelected * vec3(0.035, 0.22, 0.24) * vGlow;
      if (vGlow > 0.5 && vPart > 0.5 && vPart < 4.5) {
        if (powerState > 1.5) c = c * 0.19 + vec3(0.04, 0.05, 0.06);
        else if (powerState > 0.5 && abs(vPart - 3.0) < 0.2) c = vec3(1.0, 0.68, 0.26);
      }
      gl_FragColor = vec4(c, 1.0);
    }`;

  function makeGeometry() {
    const triangles = [];
    const lines = [];
    const surfaces = [];
    const guides = [];
    const rgb = (hex) => [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const steel = rgb('4c697d'), darkSteel = rgb('203747'), rail = rgb('537b91');
    const panel = rgb('183647'), rackBlack = rgb('101d2a'), vent = rgb('071421');
    const facePlate = rgb('2b4857'), metallic = rgb('315a70'), cyan = rgb('49d0e7');
    const dimCyan = rgb('448b9d'), led = rgb('55eacf'), green = rgb('9bea98'), amber = rgb('ffd277');
    const grid = rgb('2b5267'), gridStrong = rgb('376c80');
    const faces = [
      [[0, 0, 1], [4, 5, 6, 7]], [[0, 0, -1], [1, 0, 3, 2]],
      [[1, 0, 0], [5, 1, 2, 6]], [[-1, 0, 0], [0, 4, 7, 3]],
      [[0, 1, 0], [7, 6, 2, 3]], [[0, -1, 0], [0, 1, 5, 4]],
    ];
    function box(x, y, z, w, h, d, color, part = 0, glow = 0) {
      const around = [
        [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
        [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],
      ].map(([a,b,c]) => [x + a*w/2, y + b*h/2, z + c*d/2]);
      for (const [normal, indices] of faces) {
        surfaces.push({points: indices.map((index) => around[index]), normal, color, part, glow});
        for (const index of [0,1,2,0,2,3]) {
          triangles.push(...around[indices[index]], ...normal, ...color, part, glow);
        }
      }
    }
    function line(a, b, color) {
      guides.push({a,b,color});
      for (const point of [a,b]) lines.push(...point, 0, 1, 0, ...color, 0, 0.78);
    }

    for (let i = -6; i <= 6; i += 1) {
      const at = i * 0.52;
      const color = i === 0 ? gridStrong : grid;
      line([at, -1.89, -3.12], [at, -1.89, 3.12], color);
      line([-3.12, -1.89, at], [3.12, -1.89, at], color);
    }
    box(0,-1.79,0,2.05,.12,1.94,darkSteel);
    box(0,-1.724,0,1.91,.022,1.78,metallic);
    box(0,-1.75,.95,1.92,.015,.019,cyan,0,.83);
    box(.995,-1.75,0,.02,.015,1.83,dimCyan,0,.8);
    box(0,1.68,0,1.71,.11,1.63,steel);
    box(0,-1.62,0,1.71,.12,1.63,steel);
    box(0,0,-.762,1.59,3.2,.09,rackBlack);
    for (const direction of [-1, 1]) {
      const x = direction * .815;
      const accessPanel = direction > 0 ? 5 : 0;
      box(x,.018,0,.08,3.26,1.58,panel,accessPanel);
      box(x,.025,.763,.078,3.34,.092,rail);
      box(x,.025,-.744,.079,3.27,.1,steel);
      box(direction*.86,.32,0,.017,2.32,1.29,panel,accessPanel);
      for (let row = 0; row < 31; row += 1) {
        const y = -1.39 + row*.092;
        box(direction*.69,y,.796,.027,.027,.022,steel);
        for (let column = 0; column < 7; column += 1) {
          box(direction*.872,y,-.565 + column*.148,.013,.021,.084,vent,accessPanel);
        }
      }
    }
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        box(-.57+column*.14,1.743,-.56+row*.212,.077,.012,.126,vent);
      }
    }
    for (const y of [1.49,-1.49]) {
      box(0,y,.782,1.48,.105,.11,darkSteel);
      box(0,y+.045,.842,1.33,.014,.015,dimCyan,0,.65);
    }

    function unit(y, h, kind, color) {
      box(0,y,.145,1.31,h,1.13,rackBlack,kind);
      box(0,y,.737,1.41,h,.072,color,kind);
      box(0,y+h/2-.017,.781,1.37,.018,.016,metallic,kind);
      for (const x of [-.661,.661]) box(x,y,.789,.026,h*.77,.024,steel,kind);
    }
    for (const y of [1.31,1.105]) {
      unit(y,.17,2,facePlate);
      for (let i = 0; i < 14; i += 1) {
        const x = -.559 + i*.074;
        box(x,y,.791,.057,.061,.023,vent,2);
        box(x,y-.071,.794,.014,.013,.014,i%3 ? led : cyan,2,.95);
      }
      box(.578,y,.795,.043,.035,.017,dimCyan,2,.85);
    }
    unit(.919,.139,2,darkSteel);
    for (let i = 0; i < 10; i += 1) box(-.55+i*.12,.92,.787,.078,.019,.014,vent,2);

    for (const y of [.677,.389,.101,-.187,-.475]) {
      unit(y,.247,1,facePlate);
      for (let i = 0; i < 7; i += 1) {
        const x = -.52 + i*.132;
        box(x,y-.016,.792,.103,.131,.02,vent,1);
        box(x,y+.027,.808,.072,.026,.013,steel,1);
        box(x+.023,y-.049,.815,.012,.012,.012,i % 3 ? cyan : led,1,.93);
      }
      box(.569,y+.02,.802,.082,.075,.022,rackBlack,1);
      box(.577,y+.014,.817,.028,.018,.01,green,1,.92);
    }
    unit(-.712,.147,4,darkSteel);
    for (let i = 0; i < 10; i += 1) box(-.56+i*.108,-.715,.791,.063,.049,.02,vent,4);
    box(.552,-.712,.795,.055,.048,.02,led,4,.95);
    for (const y of [-.963,-1.292]) {
      unit(y,.295,3,facePlate);
      for (let i = 0; i < 10; i += 1) box(-.565+i*.074,y,.796,.035,.148,.018,vent,3);
      box(.385,y,.794,.32,.135,.023,rackBlack,3);
      box(.372,y+.013,.814,.19,.031,.014,cyan,3,.95);
      box(.557,y+.01,.815,.021,.021,.012,amber,3,.96);
    }
    for (let i=0; i<21; i+=1) {
      const y = -1.46 + i*.145;
      box(0,y,-.82,1.31,.035,.02,steel);
    }
    return { triangles: new Float32Array(triangles), lines: new Float32Array(lines), surfaces, guides };
  }

  function createGpuRenderer(geometry) {
    const canvas = gpuCanvas;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true });
    if (!gl) return null;

    function compile(type, text) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || 'No se pudo cargar el sombreado del rack 3D.');
      }
      return shader;
    }
    const program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    const attributes = [['point',3,0],['normal',3,3],['color',3,6],['part',1,9],['glow',1,10]]
      .map(([name,size,offset]) => ({ location: gl.getAttribLocation(program,name), size, offset }));
    const matrixUniform = gl.getUniformLocation(program, 'projectionView');
    const eyeUniform = gl.getUniformLocation(program, 'eye');
    const selectionUniform = gl.getUniformLocation(program, 'selected');
    const spreadUniform = gl.getUniformLocation(program, 'spread');
    const doorUniform = gl.getUniformLocation(program, 'doorRotation');
    const powerUniform = gl.getUniformLocation(program, 'powerState');
    const batches = [[geometry.lines,gl.LINES],[geometry.triangles,gl.TRIANGLES]].map(([data, mode]) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return {buffer,mode,count:data.length/11};
    });
    return {
      canvas,
      draw(matrix, eye, selected, doorRotation) {
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(matrixUniform, false, matrix);
        gl.uniform3fv(eyeUniform, eye);
        gl.uniform1f(selectionUniform, selected);
        gl.uniform1f(spreadUniform, spread);
        gl.uniform2fv(doorUniform, doorRotation);
        gl.uniform1f(powerUniform, powerState);
        for (const {buffer,mode,count} of batches) {
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          for (const {location,size,offset} of attributes) {
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location,size,gl.FLOAT,false,44,offset*4);
          }
          gl.drawArrays(mode,0,count);
        }
      },
    };
  }

  function createCanvasRenderer(geometry) {
    const canvas = cpuCanvas;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const keyDirection = normalize([-0.45,0.82,1]);
    const rimDirection = normalize([1,0.28,-0.52]);
    const rgb = (values) => `rgb(${values.map((v)=>Math.round(Math.min(1,Math.max(0,v))*255)).join(',')})`;

    return {
      canvas,
      draw(matrix, eye, selected, doorRotation) {
        const {width,height} = canvas;
        context.clearRect(0,0,width,height);
        function project([x,y,z]) {
          const depth = matrix[3]*x + matrix[7]*y + matrix[11]*z + matrix[15];
          return [
            width*(1 + (matrix[0]*x + matrix[4]*y + matrix[8]*z + matrix[12])/depth)/2,
            height*(1 - (matrix[1]*x + matrix[5]*y + matrix[9]*z + matrix[13])/depth)/2,
            depth,
          ];
        }

        context.lineWidth = width/canvas.clientWidth * .84;
        for (const {a,b,color} of geometry.guides) {
          const [x1,y1] = project(a), [x2,y2] = project(b);
          context.strokeStyle = rgb(color);
          context.beginPath();
          context.moveTo(x1,y1);
          context.lineTo(x2,y2);
          context.stroke();
        }

        const faces = [];
        for (const {points,normal,color,part,glow} of geometry.surfaces) {
          const worldPoints = spread && part ? points.map(point => rackPoint(point,part,doorRotation)) : points;
          const worldNormal = spread && part === 5 ? rotateDoor(normal,doorRotation) : normal;
          const toEye = eye.map((value, i) => value - worldPoints[0][i]);
          if (dot(toEye,worldNormal) <= 0) continue;
          const light = 0.63 + 0.57*Math.max(0,dot(worldNormal,keyDirection));
          const rim = Math.max(0,dot(worldNormal,rimDirection));
          let shade = color.map((channel,i) => channel*(glow+light*(1-glow)) + rim*[.065,.15,.22][i]*(1-glow));
          if (part === selected) {
            shade[0] += .023; shade[1] += .13; shade[2] += .17;
          }
          if (glow > 0.5 && part > 0 && part < 5) {
            if (powerState === 2) shade = shade.map((channel,i) => channel*.19 + [.04,.05,.06][i]);
            else if (powerState === 1 && part === 3) shade = [1,.68,.26];
          }
          const screen = worldPoints.map(project);
          const depth = screen.reduce((sum,point)=>sum+point[2],0)/4;
          faces.push({screen,depth,fill:rgb(shade)});
        }
        faces.sort((a,b)=>b.depth-a.depth);
        context.lineWidth = width/canvas.clientWidth * .42;
        for (const {screen,fill} of faces) {
          context.beginPath();
          context.moveTo(screen[0][0],screen[0][1]);
          for (let i=1;i<screen.length;i+=1) context.lineTo(screen[i][0],screen[i][1]);
          context.closePath();
          context.fillStyle = context.strokeStyle = fill;
          context.fill();
          context.stroke();
        }
      },
    };
  }

  function createRenderer() {
    const geometry = makeGeometry();
    try {
      const gpu = createGpuRenderer(geometry);
      if (gpu) return gpu;
    } catch (error) {
      console.warn('El renderizador WebGL del rack no está disponible.', error);
    }
    return createCanvasRenderer(geometry);
  }

  const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  const normalize = (v) => {
    const length = Math.hypot(...v);
    return v.map((x) => x/length);
  };
  function rotateDoor([x,y,z], [cos,sin]) {
    return [x*cos + z*sin, y, -x*sin + z*cos];
  }

  function rackPoint([x,y,z], part, doorRotation) {
    if (part === 5) {
      const [rotatedX, , rotatedZ] = rotateDoor([x-.855,0,z-.75],doorRotation);
      return [rotatedX+.855,y,rotatedZ+.75];
    }
    return [x,y,z + spread*(part === 2 ? .34 : .56)];
  }

  function camera(aspect) {
    const distance = (7.85 + .8*spread) * Math.max(1,0.74/aspect);
    const eye = [
      distance*Math.sin(yaw)*Math.cos(pitch), distance*Math.sin(pitch),
      distance*Math.cos(yaw)*Math.cos(pitch),
    ];
    const forward = normalize(eye);
    const right = normalize(cross([0,1,0],forward));
    const up = cross(forward,right);
    const view = [
      right[0],up[0],forward[0],0, right[1],up[1],forward[1],0, right[2],up[2],forward[2],0,
      -dot(eye,right),-dot(eye,up),-dot(eye,forward),1,
    ];
    const invTan = 1 / Math.tan(0.30);
    const proj = [invTan/aspect,0,0,0, 0,invTan,0,0, 0,0,-1.006,-1, 0,0,-0.201,0];
    const matrix = new Float32Array(16);
    for (let column=0;column<4;column+=1) {
      for (let row=0;row<4;row+=1) {
        for (let i=0;i<4;i+=1) matrix[column*4+row] += proj[i*4+row]*view[column*4+i];
      }
    }
    return {matrix,eye};
  }

  function render(now) {
    frameId = 0;
    if (!open) return;
    if (spreadTransition) {
      const {start,from,to} = spreadTransition;
      const elapsed = Math.min(1, Math.max(0, (now-start)/360));
      spread = from + (to-from)*(1 - (1-elapsed)**3);
      if (elapsed === 1) spreadTransition = undefined;
      else requestRender();
    }
    const {width,height} = stage.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const {canvas} = renderer;
    const density = Math.min(window.devicePixelRatio || 1, 1.65);
    const pixelWidth = Math.round(width*density);
    const pixelHeight = Math.round(height*density);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const {matrix,eye} = camera(width/height);
    const doorAngle = -1.32*spread;
    const doorRotation = [Math.cos(doorAngle), Math.sin(doorAngle)];
    renderer.draw(matrix,eye,parts[current].id,doorRotation);
    for (const pin of pins) {
      if (Math.cos(yaw) < 0.19) {
        if (document.activeElement === pin) {
          experience.querySelector('.rack-parts button[aria-pressed="true"]').focus({preventScroll:true});
        }
        pin.hidden = true;
        continue;
      }
      const {anchor,id} = parts[pin.dataset.rackPart];
      const [x,y,z] = rackPoint(anchor,id,doorRotation);
      const perspective = matrix[3]*x + matrix[7]*y + matrix[11]*z + matrix[15];
      const u = (matrix[0]*x + matrix[4]*y + matrix[8]*z + matrix[12])/perspective;
      const v = (matrix[1]*x + matrix[5]*y + matrix[9]*z + matrix[13])/perspective;
      pin.style.left = `${(u+1)*50}%`;
      pin.style.top = `${(1-v)*50}%`;
      pin.hidden = false;
    }
  }

  function requestRender() {
    if (open && !frameId) frameId = requestAnimationFrame(render);
  }

  function selectPart(name) {
    current = name;
    description.textContent = parts[name].copy;
    for (const button of selectors) button.setAttribute('aria-pressed', String(button.dataset.rackPart === name));
    requestRender();
  }

  function stopTour() {
    clearTimeout(tourTimer);
    tourTimer = undefined;
    tour.textContent = 'Iniciar recorrido';
  }

  function setExploded(next) {
    exploded = next;
    explore.setAttribute('aria-pressed', String(next));
    explore.textContent = next ? 'Cerrar vista interior' : 'Explorar por dentro';
    powerPanel.hidden = !next;
    tour.hidden = !next;
    if (next) {
      yaw = startYaw;
      pitch = startPitch;
    } else {
      stopTour();
    }
    const target = Number(next);
    if (motionPreference.matches || !open || spread === target) {
      spreadTransition = undefined;
      spread = target;
    } else {
      spreadTransition = {start: performance.now(), from: spread, to: target};
    }
    requestRender();
  }

  function startTour() {
    tour.textContent = 'Detener recorrido';
    function showStop(index) {
      selectPart(tourOrder[index]);
      tourTimer = setTimeout(() => {
        const next = index+1;
        if (next === tourOrder.length) stopTour();
        else showStop(next);
      }, 4100);
    }
    showStop(0);
  }

  function updatePower(announce = false) {
    const watts = Number(load.value);
    const batteryPercent = Math.round(100*batteryEnergy/batteryCapacity);
    powerState = gridOnline ? 0 : batteryEnergy > 0 ? 1 : 2;
    const remaining = Math.floor(3600*batteryEnergy/watts);
    const minutes = Math.floor(remaining/60);
    const seconds = remaining%60;
    const runtime = gridOnline ? 'En espera' : `${minutes} min ${String(seconds).padStart(2,'0')} s`;
    const energized = powerState !== 2;
    const powerReadings = {
      grid: gridOnline ? 'Activa' : 'Sin suministro',
      ups: ['En línea', 'En batería', 'Sin batería'][powerState],
      pdu: energized ? 'Distribuyendo' : 'Sin energía',
      rack: energized ? 'Operativos' : 'Apagados',
      runtime,
      battery: `${batteryPercent} %`,
    };
    powerPanel.dataset.state = ['grid', 'battery', 'depleted'][powerState];
    for (const [name, node] of powerOutputs) node.textContent = powerReadings[name];
    powerToggle.textContent = gridOnline ? 'Simular corte de energía' : 'Restablecer red eléctrica';
    advanceTime.disabled = powerState !== 1;
    loadValue.value = `${watts} W`;
    load.setAttribute('aria-valuetext', `${watts} vatios`);
    if (announce) announcement.textContent = `UPS: ${powerReadings.ups}. Equipos: ${powerReadings.rack}. Autonomía: ${runtime}.`;
    requestRender();
  }

  function showRack(focusViewer) {
    if (open) return;
    try {
      renderer ??= createRenderer();
    } catch (error) {
      console.warn('No se pudo mostrar el rack 3D.', error);
      renderer = null;
    }
    if (!renderer) {
      launch.hidden = true;
      if (focusViewer) {
        status.textContent = 'El navegador no pudo mostrar el rack 3D. Puedes consultar los servicios de infraestructura en esta página.';
        experience.querySelector('.rack-status').setAttribute('tabindex','-1');
        status.focus({preventScroll:true});
      } else {
        experience.hidden = true;
      }
      return;
    }
    open = true;
    gpuCanvas.hidden = renderer.canvas !== gpuCanvas;
    cpuCanvas.hidden = renderer.canvas !== cpuCanvas;
    viewer.hidden = false;
    launch.hidden = true;
    hero.classList.add('rack-open');
    requestRender();
    if (focusViewer) {
      viewer.setAttribute('tabindex','-1');
      viewer.focus();
    }
  }

  function hideRack() {
    stopTour();
    open = false;
    viewer.hidden = true;
    launch.hidden = false;
    hero.classList.remove('rack-open');
    launch.focus({preventScroll:true});
  }

  for (const button of selectors) {
    button.addEventListener('click', () => {
      stopTour();
      selectPart(button.dataset.rackPart);
    });
  }
  explore.addEventListener('click', () => setExploded(!exploded));
  tour.addEventListener('click', () => {
    if (tourTimer !== undefined) stopTour();
    else startTour();
  });
  powerToggle.addEventListener('click', () => {
    stopTour();
    gridOnline = !gridOnline;
    batteryEnergy = batteryCapacity;
    if (!gridOnline) selectPart('power');
    updatePower(true);
  });
  advanceTime.addEventListener('click', () => {
    batteryEnergy = Math.max(0, batteryEnergy - Number(load.value)*advanceMinutes/60);
    updatePower(true);
    if (advanceTime.disabled) powerToggle.focus({preventScroll:true});
  });
  load.addEventListener('input', () => updatePower());
  for (const button of stage.querySelectorAll('[data-rack-turn]')) {
    button.addEventListener('click', () => {
      stopTour();
      yaw += Number(button.dataset.rackTurn) * Math.PI/8;
      requestRender();
    });
  }
  stage.querySelector('[data-rack-reset]').addEventListener('click', () => {
    stopTour();
    yaw = startYaw;
    pitch = startPitch;
    requestRender();
  });
  stage.addEventListener('pointerdown', event => {
    if (drag || event.target !== renderer?.canvas || !event.isPrimary || event.button !== 0) return;
    stopTour();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    renderer.canvas.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    yaw -= (event.clientX-drag.x)*0.012;
    if (event.pointerType !== 'touch') pitch = Math.max(-0.1,Math.min(0.54,pitch+(event.clientY-drag.y)*0.007));
    drag.x = event.clientX;
    drag.y = event.clientY;
    requestRender();
  });
  stage.addEventListener('lostpointercapture', () => { drag = null; });
  gpuCanvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    const insideViewer = viewer.contains(document.activeElement);
    stopTour();
    open = false;
    viewer.hidden = true;
    launch.hidden = true;
    hero.classList.remove('rack-open');
    status.textContent = 'Se perdió la vista 3D. La portada en foto sigue disponible.';
    if (insideViewer) {
      status.setAttribute('tabindex','-1');
      status.focus({preventScroll:true});
    }
  });
  gpuCanvas.addEventListener('webglcontextrestored', () => {
    renderer = null;
    launch.hidden = false;
    status.textContent = '';
  });
  launch.addEventListener('click', () => showRack(true));
  close.addEventListener('click', hideRack);
  if (typeof ResizeObserver === 'function') new ResizeObserver(requestRender).observe(stage);
  else window.addEventListener('resize', requestRender);
  experience.hidden = false;
  selectPart(current);
  updatePower();
  const desktop = window.matchMedia('(min-width: 961px) and (pointer: fine)').matches;
  if (desktop && !motionPreference.matches && !navigator.connection?.saveData) showRack(false);
})();
