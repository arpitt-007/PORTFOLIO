/* 3D hero sculpture. Loaded as a module; every failure path falls back to the static CSS/SVG stage. */
const root = document.documentElement;
const canvas = document.getElementById('stage');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => window.innerWidth < 900;

function fallback() { root.classList.add('no-webgl'); }

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

async function start() {
  if (!canvas || !hasWebGL()) return fallback();

  let THREE, RoomEnvironment;
  try {
    THREE = await import('three');
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (e) { console.warn('3D unavailable, using fallback', e); return fallback(); }

  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || narrow();
  let dprCap = lowPower ? 1.5 : 1.75;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return fallback(); }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 7);

  // Reflections come from a generated room environment, so no texture downloads.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  // Lights: a warm key that follows the pointer and a cool rim.
  const key = new THREE.DirectionalLight(0xffe2b0, 2.2);
  key.position.set(3, 3, 5);
  const rim = new THREE.DirectionalLight(0x6f8cff, 0.9);
  rim.position.set(-4, -1, -3);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.12));

  // Sculpture: faceted gold core, a wireframe shell, and one tilted ring.
  const group = new THREE.Group();
  scene.add(group);

  const coreGeo = new THREE.IcosahedronGeometry(1.15, 1);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9a96e, metalness: 1, roughness: 0.26, flatShading: true,
    clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 1.1
  });
  const core = new THREE.Mesh(coreGeo, coreMat);

  const shellGeo = new THREE.IcosahedronGeometry(1.75, 1);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xe8d5a3, wireframe: true, transparent: true, opacity: 0.16 });
  const shell = new THREE.Mesh(shellGeo, shellMat);

  const ringGeo = new THREE.TorusGeometry(2.25, 0.012, 8, 160);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xe8d5a3, transparent: true, opacity: 0.45 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.4;
  ring.rotation.y = 0.4;

  group.add(core, shell, ring);

  // Dust
  const count = lowPower ? 350 : 900;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 3 + Math.random() * 9;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
    pos[i * 3 + 2] = r * Math.cos(ph) - 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xe8d5a3, size: 0.028, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ── State ──
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = window.scrollY;
  let vh = window.innerHeight;
  const cur = { x: 0, y: 0, s: 1, ry: 0 };
  let raf = 0, running = false, last = performance.now(), slow = 0, frames = 0;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    vh = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Pose target from scroll: big and right of the headline in the hero,
  // then drifts to the edge, smaller, while content scrolls past.
  function target() {
    const p = Math.min(scrollY / vh, 3);
    const m = narrow();
    const fit = Math.min(1, Math.max(0.62, camera.aspect / 1.75));
    const heroX = m ? 0 : 2.15 * (0.55 + 0.45 * fit), heroY = m ? 1.75 : 0.1, heroS = m ? 0.5 : 0.82 * fit + 0.18 * fit * fit;
    const rest = Math.min(p, 1);
    const x = heroX + (m ? 0 : (3.1 - heroX)) * rest;
    const y = heroY + (m ? 1.2 : -0.2) * rest;
    const s = heroS * (1 - 0.42 * rest);
    // dim the stage once content takes over so text stays readable
    const o = 1 - 0.58 * rest;
    canvas.style.setProperty('--stage-o', o.toFixed(3));
    return { x, y, s, ry: scrollY * 0.0016 };
  }

  function render(dt) {
    const t = target();
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt);       // frame-rate independent easing
    cur.x += (t.x - cur.x) * k; cur.y += (t.y - cur.y) * k;
    cur.s += (t.s - cur.s) * k; cur.ry += (t.ry - cur.ry) * k;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4);

    const time = performance.now() * 0.001;
    const idle = reduced ? 0 : time;
    group.position.set(cur.x + pointer.x * 0.25, cur.y + pointer.y * 0.18, 0);
    group.scale.setScalar(cur.s);
    group.rotation.y = idle * 0.12 + cur.ry + pointer.x * 0.35;
    group.rotation.x = Math.sin(idle * 0.17) * 0.12 - pointer.y * 0.25;
    shell.rotation.y = -idle * 0.07;
    ring.rotation.z = idle * 0.05;
    dust.rotation.y = idle * 0.012 + scrollY * 0.00012;

    key.position.set(3 + pointer.x * 4, 3 + pointer.y * 3, 5);
    renderer.render(scene, camera);
  }

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    render(dt);

    // Adaptive quality: if frames are consistently slow, lower the pixel ratio once, then thin the dust.
    frames++;
    if (dt > 0.034) slow++;
    if (frames === 90) {
      if (slow > 45) {
        if (dprCap > 1) { dprCap = 1; resize(); }
        else dustGeo.setDrawRange(0, Math.floor(count / 2));
      }
      frames = 0; slow = 0;
    }
  }

  function startLoop() {
    if (reduced || running) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function stopLoop() { running = false; cancelAnimationFrame(raf); }

  // Reduced motion: no loop; redraw only when the page scrolls or resizes.
  let pending = false;
  function renderOnce() {
    if (pending) return; pending = true;
    requestAnimationFrame(() => { pending = false; render(1); });
  }

  const onResize = () => { resize(); renderOnce(); };
  const onScroll = () => { scrollY = window.scrollY; if (reduced) renderOnce(); };
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  };
  const onVisibility = () => { document.hidden ? stopLoop() : startLoop(); };

  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true });
  if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stopLoop(); fallback(); });
  canvas.addEventListener('webglcontextrestored', () => { root.classList.remove('no-webgl'); startLoop(); renderOnce(); });

  window.addEventListener('pagehide', () => {
    stopLoop();
    [coreGeo, shellGeo, ringGeo, dustGeo, coreMat, shellMat, ringMat, dustMat, envTex].forEach((o) => o.dispose());
    pmrem.dispose(); renderer.dispose();
  });

  resize();
  // Start with the pose already in place (no fly-in), then run.
  const t0 = target(); Object.assign(cur, t0);
  render(1);
  root.classList.add('webgl-ready');
  startLoop();
}

start().catch((e) => { console.warn(e); fallback(); });
