// Imperio Inc. — Hero 3D producto girando
// Acepta cualquier imagen subida desde el panel admin

class HeroScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.mouse = { x: 0, y: 0 };
    this.targetMouse = { x: 0, y: 0 };
    this.productGroup = null;
    this.imageLoaded = false;
    this.isMobile = window.innerWidth < 768;
    this.init();
  }

  init() {
    const w = this.canvas.parentElement.clientWidth || window.innerWidth / 2;
    const h = this.canvas.parentElement.clientHeight || window.innerHeight * 0.7;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0xFFFFFF, 0); // fondo transparente (hereda el blanco del HTML)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 7);

    this.createLights();
    this.createShadowPlane();
    this.createParticles();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('mousemove', e => {
      this.targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      this.targetMouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    });

    this.animate();
  }

  createLights() {
    // Luz ambiental suave (ambiente blanco)
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    // Luz principal — suave desde arriba-izquierda
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.keyLight.position.set(-4, 6, 6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.scene.add(this.keyLight);

    // Luz de relleno — desde la derecha, dorada suave
    const fill = new THREE.DirectionalLight(0xF5DFA0, 1.0);
    fill.position.set(5, 2, 3);
    this.scene.add(fill);

    // Rim light — desde atrás, blanca
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0, -3, -5);
    this.scene.add(rim);
  }

  createShadowPlane() {
    // Sombra proyectada debajo del producto (solo visual)
    const geo = new THREE.PlaneGeometry(6, 6);
    const mat = new THREE.ShadowMaterial({ opacity: 0.10 });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2.8;
    plane.receiveShadow = true;
    this.scene.add(plane);
  }

  // Carga la imagen del producto y crea el objeto 3D
  loadProductImage(url) {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      texture => {
        texture.encoding = THREE.sRGBEncoding;

        // Limpiar grupo anterior si existe
        if (this.productGroup) this.scene.remove(this.productGroup);
        this.productGroup = new THREE.Group();

        const imgW = texture.image.naturalWidth || 1;
        const imgH = texture.image.naturalHeight || 1;
        const aspect = imgW / imgH;

        // Tamaño del "producto"
        const H = 3.2;
        const W = H * aspect;

        // ── CARA FRONTAL (imagen del producto) ──────────────────
        const frontGeo = new THREE.PlaneGeometry(W, H);
        const frontMat = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          side: THREE.FrontSide,
          roughness: 0.35,
          metalness: 0.05,
        });
        const front = new THREE.Mesh(frontGeo, frontMat);
        front.castShadow = true;
        this.productGroup.add(front);

        // ── CARA TRASERA (misma imagen, espejada) ────────────────
        const backGeo = new THREE.PlaneGeometry(W, H);
        const backMat = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          side: THREE.BackSide,
          roughness: 0.4,
          metalness: 0.05,
        });
        const back = new THREE.Mesh(backGeo, backMat);
        this.productGroup.add(back);

        // ── SOMBRA / GLOW DEBAJO ─────────────────────────────────
        const glowGeo = new THREE.PlaneGeometry(W * 0.85, 0.35);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.12
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = -H / 2 - 0.2;
        this.productGroup.add(glow);

        // ── REFLEJO (imagen invertida con fade) ──────────────────
        const reflGeo = new THREE.PlaneGeometry(W, H * 0.55);
        const reflMat = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          opacity: 0.18,
          side: THREE.FrontSide,
          roughness: 1,
        });
        const refl = new THREE.Mesh(reflGeo, reflMat);
        refl.scale.y = -1;
        refl.position.y = -H / 2 - (H * 0.55) / 2 - 0.05;
        this.productGroup.add(refl);

        this.scene.add(this.productGroup);
        this.imageLoaded = true;

        // Ocultar placeholder
        const ph = document.getElementById('hero-3d-placeholder');
        if (ph) ph.style.display = 'none';
      },
      undefined,
      err => console.warn('No se pudo cargar imagen del producto:', err)
    );
  }

  // Crea objeto de ejemplo (si no hay imagen) — cubo dorado girando
  createFallbackObject() {
    if (this.productGroup) this.scene.remove(this.productGroup);
    this.productGroup = new THREE.Group();

    const geo = new THREE.BoxGeometry(2, 2.8, 0.3, 1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xB08D45,
      metalness: 0.85,
      roughness: 0.12,
    });
    const box = new THREE.Mesh(geo, mat);
    box.castShadow = true;
    this.productGroup.add(box);

    // Bordes blancos
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    this.productGroup.add(wireframe);

    this.scene.add(this.productGroup);
    this.imageLoaded = true;
  }

  createParticles() {
    const count = this.isMobile ? 60 : 160;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xB08D45,
      size: 0.04,
      transparent: true,
      opacity: 0.35
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  onResize() {
    const w = this.canvas.parentElement.clientWidth || window.innerWidth / 2;
    const h = this.canvas.parentElement.clientHeight || window.innerHeight * 0.7;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.isMobile = window.innerWidth < 768;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const t = this.clock.getElapsedTime();

    // Suavizar mouse
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.04;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.04;

    if (this.productGroup) {
      // Rotación 360° continua en Y
      this.productGroup.rotation.y += 0.007;
      // Flotación vertical
      this.productGroup.position.y = Math.sin(t * 0.7) * 0.18;
      // Leve inclinación con mouse en X
      this.productGroup.rotation.x += (this.mouse.y * 0.06 - this.productGroup.rotation.x) * 0.04;
    }

    if (this.particles) {
      this.particles.rotation.y = t * 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Inicializar
function initHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || typeof THREE === 'undefined') return;
  try {
    window.heroScene = new HeroScene(canvas);
  } catch (e) {
    console.warn('Hero 3D error:', e.message);
  }
}
