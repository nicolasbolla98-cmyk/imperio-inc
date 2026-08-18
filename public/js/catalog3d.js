// Imperio Inc. — 3D floating products for catalog grid

class ProductScene3D {
  constructor(canvas, imageUrl) {
    this.canvas = canvas;
    this.running = false;
    this.raf = null;
    this.group = null;
    this.phase = Math.random() * Math.PI * 2;
    this._init(imageUrl);
  }

  _init(imageUrl) {
    if (typeof THREE === 'undefined') return;

    const w = this.canvas.offsetWidth || 260;
    const h = this.canvas.offsetHeight || 347;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    this.camera.position.z = 4.2;

    this.scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 5, 5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xF5DFA0, 0.7);
    fill.position.set(-4, 0, 3);
    this.scene.add(fill);

    this.clock = new THREE.Clock();
    this.group = new THREE.Group();
    this.scene.add(this.group);

    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      texture => {
        texture.encoding = THREE.sRGBEncoding;
        const aspect = (texture.image.naturalWidth || 3) / (texture.image.naturalHeight || 4);
        const h3 = 2.5;
        const w3 = h3 * aspect;

        const geo = new THREE.PlaneGeometry(w3, h3);
        const mat = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
          roughness: 0.2,
          metalness: 0.0,
        });
        this.group.add(new THREE.Mesh(geo, mat));

        // Oval shadow below
        const shadowGeo = new THREE.CircleGeometry(w3 * 0.36, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.06 });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -(h3 / 2) - 0.25;
        this.group.add(shadow);

        this.start();
      },
      undefined,
      () => {
        // Gold box fallback when image fails
        const geo = new THREE.BoxGeometry(1.5, 2.0, 0.12);
        const mat = new THREE.MeshStandardMaterial({ color: 0xB08D45, metalness: 0.65, roughness: 0.25 });
        this.group.add(new THREE.Mesh(geo, mat));
        this.start();
      }
    );
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  }

  _loop() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this._loop());
    const t = this.clock.getElapsedTime();
    if (this.group) {
      this.group.rotation.y += 0.009;
      this.group.position.y = Math.sin(t * 0.85 + this.phase) * 0.14;
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    this.stop();
    try { this.renderer.dispose(); } catch (e) {}
  }
}

// ── Manager ───────────────────────────────────────────────────────────
const MAX_3D_SCENES = 8;
const _scenes3d = new Map();
let _observer3d = null;

function initCatalog3D() {
  if (typeof THREE === 'undefined') return;

  if (_observer3d) _observer3d.disconnect();

  _observer3d = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const canvas = entry.target;
      if (entry.isIntersecting) {
        if (!_scenes3d.has(canvas)) {
          if (_scenes3d.size >= MAX_3D_SCENES) return;
          const scene = new ProductScene3D(canvas, canvas.dataset.img || '');
          _scenes3d.set(canvas, scene);
        } else {
          _scenes3d.get(canvas)?.start();
        }
      } else {
        _scenes3d.get(canvas)?.stop();
      }
    });
  }, { threshold: 0.05 });

  document.querySelectorAll('.product-3d-canvas').forEach(c => _observer3d.observe(c));
}

function destroyCatalog3D() {
  if (_observer3d) { _observer3d.disconnect(); _observer3d = null; }
  _scenes3d.forEach(s => s.destroy());
  _scenes3d.clear();
}
