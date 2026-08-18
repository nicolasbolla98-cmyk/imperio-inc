// Imperio Inc. - Main Application

const API = '';
const WHATSAPP_NUMBER = '59896960187';
let cart = JSON.parse(localStorage.getItem('imperio_cart') || '[]');
let allProducts = [];
let allBrands = [];
let categories = [];
let activeFilters = { brand: '', category: '', size: '', search: '', min_price: '', max_price: '' };
let musicPlayer = null;
let heroData = {};

// ── INIT ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initCart();       // primero para que botones funcionen siempre
  updateCartBadge();
  initHeader();
  initHero();
  initWhatsApp();
  await loadSettings();
  await loadHero();
  await loadBrands();
  await loadCategories();
  await loadProducts();
  initMusicPlayer();
  initScrollAnimations();
});

// ── SETTINGS (logo, branding) ─────────────────────────────────────────
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();
    if (s.logo_url) {
      const logoUrl = s.logo_url;
      ['logo-img', 'about-logo', 'footer-logo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = logoUrl;
      });
    }
    if (s.logo_color) {
      document.documentElement.style.setProperty('--logo-color', s.logo_color);
      // Apply CSS filter to tint SVG logos
      const filter = svgColorFilter(s.logo_color);
      ['logo-img', 'about-logo', 'footer-logo'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.src && el.src.endsWith('.svg')) el.style.filter = filter;
      });
    }
  } catch (e) {
    console.warn('Settings load failed:', e.message);
  }
}

function svgColorFilter(hex) {
  // Map hex to approximate CSS hue-rotate+sepia for gold tones
  // For gold (#B08D45) we use sepia + saturate + hue-rotate
  return 'brightness(0) saturate(100%) invert(61%) sepia(39%) saturate(500%) hue-rotate(5deg) brightness(95%)';
}

// ── HEADER ────────────────────────────────────────────────────────────
function initHeader() {
  const header = document.getElementById('main-header');
  const menuBtn = document.getElementById('menu-toggle');
  const navLinks = document.getElementById('nav-links');

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
  });

  menuBtn?.addEventListener('click', () => {
    navLinks?.classList.toggle('open');
    menuBtn.classList.toggle('open');
  });

  // Smooth close on nav link click
  navLinks?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// ── HERO ──────────────────────────────────────────────────────────────
async function loadHero() {
  try {
    const res = await fetch('/api/hero');
    heroData = await res.json();
    if (!heroData.active) return;

    const titleEl = document.getElementById('hero-title');
    const descEl  = document.getElementById('hero-description');
    const ctaEl   = document.getElementById('hero-cta');

    if (heroData.title && titleEl) titleEl.innerHTML = heroData.title.replace(' ', '<br>');
    if (heroData.description && descEl) descEl.innerHTML = heroData.description;
    if (heroData.cta_text && ctaEl) {
      ctaEl.textContent = heroData.cta_text;
      if (heroData.cta_link) ctaEl.href = heroData.cta_link;
    }
    if (heroData.accent_color) {
      document.documentElement.style.setProperty('--gold', heroData.accent_color);
    }

    // Cargar imagen 3D del producto hero
    if (heroData.hero_3d_image && window.heroScene) {
      window.heroScene.loadProductImage(heroData.hero_3d_image);
    } else if (window.heroScene) {
      window.heroScene.createFallbackObject();
    }
  } catch (e) {
    console.warn('Hero load failed:', e.message);
    if (window.heroScene) window.heroScene.createFallbackObject();
  }
}

// ── BRANDS ────────────────────────────────────────────────────────────
async function loadBrands() {
  try {
    const res = await fetch('/api/brands?active=1');
    allBrands = await res.json();
    renderHeroBrandPills(allBrands);
    renderBrandsMarquee(allBrands);
    renderBrandsSection(allBrands);
    populateBrandFilter(allBrands);
  } catch (e) {
    console.warn('Brands load failed:', e.message);
  }
}

function renderBrandsMarquee(brands) {
  const track = document.getElementById('brands-track');
  if (!track || !brands.length) return;

  const makeItem = b => {
    const div = document.createElement('div');
    div.className = 'brand-item';
    if (b.logo) {
      const img = document.createElement('img');
      img.src = b.logo;
      img.alt = b.name;
      img.loading = 'lazy';
      div.appendChild(img);
    } else {
      div.innerHTML = `<span class="brand-name-text">${b.name}</span>`;
    }
    return div;
  };

  // Duplicate for infinite marquee
  [...brands, ...brands].forEach(b => track.appendChild(makeItem(b)));
}

function renderHeroBrandPills(brands) {
  const container = document.getElementById('hero-brand-pills');
  if (!container || !brands.length) return;
  container.innerHTML = brands.slice(0, 6).map(b => `
    <span class="hero-brand-pill" onclick="filterByBrand(${b.id})">${b.name}</span>
  `).join('');
}

function renderHeroBrandsGrid(brands) {
  const bg = document.getElementById('hero-brands-bg');
  if (!bg || !brands.length) return;

  // Fill a 5x5 = 25 cell grid, repeating brands as needed
  const totalCells = 25;
  const cells = [];
  while (cells.length < totalCells) cells.push(...brands);

  bg.innerHTML = cells.slice(0, totalCells).map(b => `
    <div class="hero-brand-cell">
      ${b.logo
        ? `<img src="${b.logo}" alt="${b.name}" loading="lazy">`
        : `<span class="brand-cell-text">${b.name}</span>`
      }
    </div>
  `).join('');
}

function renderBrandsSection(brands) {
  const grid = document.getElementById('brands-grid');
  if (!grid) return;
  grid.innerHTML = brands.map(b => `
    <div class="brand-card" data-brand-id="${b.id}" onclick="filterByBrand(${b.id})">
      ${b.logo ? `<img src="${b.logo}" alt="${b.name}" loading="lazy">` : `<span class="brand-name-text">${b.name}</span>`}
    </div>
  `).join('');
}

function populateBrandFilter(brands) {
  const sel = document.getElementById('filter-brand');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todas las marcas</option>' +
    brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
}

function filterByBrand(brandId) {
  activeFilters.brand = brandId;
  document.getElementById('filter-brand').value = brandId;
  document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth' });
  applyFilters();
}

// ── CATEGORIES ────────────────────────────────────────────────────────
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    categories = await res.json();
    const sel = document.getElementById('filter-category');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas las categorías</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch (e) {}
}

// ── PRODUCTS ──────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    showProductsSkeleton();
    const params = new URLSearchParams();
    Object.entries(activeFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await fetch('/api/products?' + params);
    allProducts = await res.json();
    renderProducts(allProducts);
  } catch (e) {
    showProductsError();
  }
}

function showProductsSkeleton() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="product-card skeleton">
      <div class="product-image-wrap skeleton-img"></div>
      <div class="product-info">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `).join('');
}

function showProductsError() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="products-empty"><p>Error al cargar productos.</p></div>';
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  destroyCatalog3D();

  if (!products.length) {
    grid.innerHTML = '<div class="products-empty"><p>No se encontraron productos.</p></div>';
    return;
  }

  grid.innerHTML = products.map(p => createProductCard(p)).join('');
  grid.querySelectorAll('.product-card').forEach(card => {
    observeElement(card);
  });

  initCatalog3D();
}

function createProductCard(p) {
  const totalStock = p.total_stock || 0;
  const isLowStock = totalStock > 0 && totalStock <= 5;
  const isOutOfStock = totalStock === 0;
  const img = p.image || (p.images && p.images[0]?.url) || '/assets/placeholder.svg';
  const videoUrl = p.video_url || null;
  const price = Number(p.price).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });

  const sizes = p.sizes?.length ? `
    <div class="product-sizes">
      ${p.sizes.map(s => `<span class="size-tag ${s.stock === 0 ? 'no-stock' : ''}">${s.size}</span>`).join('')}
    </div>
  ` : '';

  const badges = [
    p.is_new ? '<span class="badge badge-new">Nuevo</span>' : '',
    p.featured ? '<span class="badge badge-featured">Destacado</span>' : '',
    isLowStock ? '<span class="badge badge-low">Últimas unidades</span>' : '',
    isOutOfStock ? '<span class="badge badge-out">Sin stock</span>' : '',
  ].filter(Boolean).join('');

  return `
    <div class="product-card fade-in" data-id="${p.id}" onclick="openProduct(${p.id})">
      <div class="product-image-wrap ${videoUrl ? 'has-video' : 'is-3d'}">
        ${videoUrl
          ? `<video class="product-video" src="${videoUrl}" muted loop playsinline autoplay></video>`
          : `<img src="${img}" alt="${p.name}" loading="lazy" onerror="this.src='/assets/placeholder.svg'">
        <canvas class="product-3d-canvas" data-img="${img}"></canvas>`
        }
        <div class="product-overlay">
          <button class="btn-view" onclick="event.stopPropagation(); openProduct(${p.id})">Ver Producto</button>
          ${!isOutOfStock ? `<button class="btn-cart" onclick="event.stopPropagation(); quickAddCart(${p.id})">Agregar al Carrito</button>` : ''}
        </div>
        ${badges ? `<div class="product-badges">${badges}</div>` : ''}
      </div>
      <div class="product-info">
        ${p.brand_name ? `<span class="product-brand">${p.brand_name}</span>` : ''}
        <h3 class="product-name">${p.name}</h3>
        ${sizes}
        <div class="product-footer">
          <span class="product-price">${price}</span>
          ${isOutOfStock ? '<span class="stock-label out">Sin stock</span>' : isLowStock ? `<span class="stock-label low">${totalStock} disponibles</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ── PRODUCT MODAL ─────────────────────────────────────────────────────
async function openProduct(id) {
  try {
    const res = await fetch(`/api/products/${id}`);
    const p = await res.json();
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    const price = Number(p.price).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
    const allImages = [p.image, ...(p.images || []).map(i => i.url)].filter(Boolean);
    const img = allImages[0] || '/assets/placeholder.svg';

    content.innerHTML = `
      <div class="modal-grid">
        <div class="modal-images">
          <div class="modal-main-img">
            <img id="modal-img-main" src="${img}" alt="${p.name}">
          </div>
          ${allImages.length > 1 ? `
            <div class="modal-thumbs">
              ${allImages.map((u, i) => `<img src="${u}" class="thumb ${i === 0 ? 'active' : ''}" onclick="switchModalImg('${u}', this)" loading="lazy">`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="modal-details">
          ${p.brand_name ? `<span class="modal-brand">${p.brand_name}</span>` : ''}
          <h2 class="modal-title">${p.name}</h2>
          ${p.sku ? `<span class="modal-sku">SKU: ${p.sku}</span>` : ''}
          <div class="modal-price">${price}</div>
          ${p.description ? `<p class="modal-description">${p.description}</p>` : ''}
          ${p.sizes?.length ? `
            <div class="modal-sizes">
              <label>Talle</label>
              <div class="size-selector">
                ${p.sizes.map(s => `
                  <button class="size-btn ${s.stock === 0 ? 'disabled' : ''}"
                    ${s.stock === 0 ? 'disabled' : ''}
                    onclick="selectSize(this, '${s.size}')"
                    data-size="${s.size}" data-stock="${s.stock}">
                    ${s.size}
                    ${s.stock === 0 ? '<span class="size-no-stock">✕</span>' : ''}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}
          <div class="modal-actions">
            <button class="btn-primary" onclick="addToCartFromModal(${p.id}, '${p.name}', ${p.price}, '${img}')">
              Agregar al Carrito
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (e) {
    console.warn('Product modal error:', e.message);
  }
}

function switchModalImg(url, thumb) {
  document.getElementById('modal-img-main').src = url;
  document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

let selectedSize = null;
function selectSize(btn, size) {
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSize = size;
}

function closeModal() {
  document.getElementById('product-modal')?.classList.remove('open');
  document.body.style.overflow = '';
  selectedSize = null;
}

// ── CART ──────────────────────────────────────────────────────────────
function initCart() {
  document.getElementById('cart-icon')?.addEventListener('click', openCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
  document.getElementById('cart-close')?.addEventListener('click', closeCart);
}

function quickAddCart(productId) {
  const p = allProducts.find(pr => pr.id === productId);
  if (!p) return;
  addToCart(p.id, p.name, p.price, p.image || (p.images?.[0]?.url));
}

function addToCartFromModal(id, name, price, image) {
  addToCart(id, name, price, image, selectedSize);
}

function addToCart(id, name, price, image, size = null) {
  const key = `${id}_${size}`;
  const existing = cart.find(i => i.key === key);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ key, id, name, price, image, size, qty: 1 });
  }
  saveCart();
  updateCartBadge();
  showCartToast(name);
}

function removeFromCart(key) {
  cart = cart.filter(i => i.key !== key);
  saveCart();
  updateCartBadge();
  renderCart();
}

function saveCart() {
  localStorage.setItem('imperio_cart', JSON.stringify(cart));
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const total = cart.reduce((a, i) => a + i.qty, 0);
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  }
}

function openCart() {
  renderCart();
  document.getElementById('cart-sidebar')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
}

function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
}

function renderCart() {
  const list = document.getElementById('cart-list');
  const total = document.getElementById('cart-total');
  if (!list) return;

  if (!cart.length) {
    list.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
    if (total) total.textContent = '';
    return;
  }

  list.innerHTML = cart.map(i => `
    <div class="cart-item">
      <img src="${i.image || '/assets/placeholder.svg'}" alt="${i.name}">
      <div class="cart-item-info">
        <span class="cart-item-name">${i.name}</span>
        ${i.size ? `<span class="cart-item-size">Talle: ${i.size}</span>` : ''}
        <span class="cart-item-qty">x${i.qty}</span>
      </div>
      <div class="cart-item-right">
        <span class="cart-item-price">${(i.price * i.qty).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })}</span>
        <button class="cart-remove" onclick="removeFromCart('${i.key}')">✕</button>
      </div>
    </div>
  `).join('');

  const totalAmt = cart.reduce((a, i) => a + i.price * i.qty, 0);
  if (total) total.textContent = `Total: ${totalAmt.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })}`;
}

function showCartToast(name) {
  const toast = document.getElementById('cart-toast');
  if (!toast) return;
  toast.textContent = `"${name}" agregado al carrito`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── FILTERS ───────────────────────────────────────────────────────────
function applyFilters() {
  activeFilters.brand = document.getElementById('filter-brand')?.value || '';
  activeFilters.category = document.getElementById('filter-category')?.value || '';
  activeFilters.size = document.getElementById('filter-size')?.value || '';
  activeFilters.search = document.getElementById('search-input')?.value || '';
  activeFilters.min_price = document.getElementById('filter-min-price')?.value || '';
  activeFilters.max_price = document.getElementById('filter-max-price')?.value || '';
  loadProducts();
}

function clearFilters() {
  activeFilters = { brand: '', category: '', size: '', search: '', min_price: '', max_price: '' };
  ['filter-brand', 'filter-category', 'filter-size', 'search-input', 'filter-min-price', 'filter-max-price'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  loadProducts();
}

// ── MUSIC PLAYER ──────────────────────────────────────────────────────
async function initMusicPlayer() {
  try {
    const res = await fetch('/api/music');
    const music = await res.json();
    if (!music.active || !music.track_url) return;

    const player = document.getElementById('music-player');
    if (!player) return;

    const playBtn  = player.querySelector('.music-play');
    const trackName = player.querySelector('.music-track-name');
    const volSlider = player.querySelector('.music-volume');

    if (trackName) trackName.textContent = music.track_name || 'Imperio Ambient';
    player.style.display = 'flex';
    player.classList.add('visible');

    const savedVol = parseFloat(localStorage.getItem('imperio_volume') || '0.35');
    if (volSlider) volSlider.value = savedVol * 100;

    if (isYouTubeUrl(music.track_url)) {
      initYouTubePlayer(music.track_url, savedVol, playBtn, volSlider);
    } else {
      initAudioPlayer(music.track_url, savedVol, playBtn, volSlider);
    }
  } catch (e) {
    console.warn('Music init failed:', e.message);
  }
}

function isYouTubeUrl(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

function getYouTubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function initYouTubePlayer(url, volume, playBtn, volSlider) {
  const videoId = getYouTubeId(url);
  if (!videoId) return;

  // Contenedor oculto para el iframe de YouTube
  const container = document.createElement('div');
  container.id = 'yt-player-container';
  container.style.cssText = 'position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;';
  const div = document.createElement('div');
  div.id = 'yt-player';
  container.appendChild(div);
  document.body.appendChild(container);

  let ytPlayer = null;
  let isPlaying = false;

  // Cargar la API de YouTube
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    ytPlayer = new YT.Player('yt-player', {
      videoId,
      playerVars: { autoplay: 0, loop: 1, playlist: videoId, controls: 0, mute: 0 },
      events: {
        onReady: () => {
          ytPlayer.setVolume(volume * 100);
          // Reproducir al primer clic del usuario
          if (localStorage.getItem('imperio_music') !== 'off') {
            document.addEventListener('click', function firstClick() {
              ytPlayer.playVideo();
              playBtn?.classList.add('playing');
              isPlaying = true;
              document.removeEventListener('click', firstClick);
            }, { once: true });
          }
        }
      }
    });
  };

  playBtn?.addEventListener('click', () => {
    if (!ytPlayer) return;
    if (isPlaying) {
      ytPlayer.pauseVideo();
      playBtn.classList.remove('playing');
      isPlaying = false;
      localStorage.setItem('imperio_music', 'off');
    } else {
      ytPlayer.playVideo();
      playBtn.classList.add('playing');
      isPlaying = true;
      localStorage.setItem('imperio_music', 'on');
    }
  });

  volSlider?.addEventListener('input', () => {
    if (ytPlayer) ytPlayer.setVolume(volSlider.value);
    localStorage.setItem('imperio_volume', volSlider.value / 100);
  });

  musicPlayer = { yt: true };
}

function initAudioPlayer(url, volume, playBtn, volSlider) {
  const audio = new Audio(url);
  audio.loop = true;
  audio.volume = volume;

  if (localStorage.getItem('imperio_music') !== 'off') {
    document.addEventListener('click', function firstClick() {
      audio.play().then(() => playBtn?.classList.add('playing')).catch(() => {});
      document.removeEventListener('click', firstClick);
    }, { once: true });
  }

  playBtn?.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      playBtn.classList.add('playing');
      localStorage.setItem('imperio_music', 'on');
    } else {
      audio.pause();
      playBtn.classList.remove('playing');
      localStorage.setItem('imperio_music', 'off');
    }
  });

  volSlider?.addEventListener('input', () => {
    audio.volume = volSlider.value / 100;
    localStorage.setItem('imperio_volume', audio.volume);
  });

  musicPlayer = { audio };
}

// ── SCROLL ANIMATIONS ─────────────────────────────────────────────────
function initScrollAnimations() {
  observeElements('.section-title', 'fade-in-up');
  observeElements('.brand-card', 'fade-in-up');
}

function observeElement(el) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  io.observe(el);
}

function observeElements(selector, className) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.08}s`;
    observeElement(el);
  });
}

// ── WHATSAPP ──────────────────────────────────────────────────────────
function initWhatsApp() {
  const btn = document.getElementById('whatsapp-float');
  if (!btn) return;
  if (WHATSAPP_NUMBER) {
    btn.href = `https://wa.me/${WHATSAPP_NUMBER}`;
  } else {
    btn.style.display = 'none';
  }
}

function sendCartToWhatsApp() {
  if (!WHATSAPP_NUMBER) {
    alert('WhatsApp no configurado. Agregá el número en main.js → WHATSAPP_NUMBER.');
    return;
  }
  if (!cart.length) {
    showCartToast('El carrito está vacío');
    return;
  }
  const lines = cart.map(i => {
    const price = (i.price * i.qty).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
    return `• ${i.name}${i.size ? ` (Talle: ${i.size})` : ''} x${i.qty} — ${price}`;
  });
  const total = cart.reduce((a, i) => a + i.price * i.qty, 0)
    .toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });

  const msg = `🛍️ *Pedido - Imperio Inc.*\n\n${lines.join('\n')}\n\n*Total: ${total}*\n\n¡Hola! Quiero realizar este pedido.`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ── MODAL CLOSE ON BACKDROP ───────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeCart(); }
});
document.getElementById('product-modal')?.addEventListener('click', e => {
  if (e.target.id === 'product-modal') closeModal();
});
