// Imperio Inc. — Admin Panel

const API = '';
let token = localStorage.getItem('imperio_token');
let adminProducts = [];
let adminBrands = [];
let adminCategories = [];

// ── INIT ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showAdminPanel();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'none';
  }

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    const btn = e.target.querySelector('button');
    btn.textContent = 'Ingresando...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      token = data.token;
      localStorage.setItem('imperio_token', token);
      localStorage.setItem('imperio_user', data.user.username);
      showAdminPanel();
    } catch (err) {
      const errEl = document.getElementById('login-error');
      errEl.textContent = err.message || 'Error al iniciar sesión';
      errEl.style.display = 'block';
    } finally {
      btn.textContent = 'Ingresar';
      btn.disabled = false;
    }
  });

  // Nav items
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', e => {
    e.preventDefault();
    localStorage.removeItem('imperio_token');
    localStorage.removeItem('imperio_user');
    token = null;
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  });

  // Drag & drop on upload zones
  document.querySelectorAll('.upload-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const input = zone.querySelector('input[type=file]');
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
    });
  });
});

// ── PANEL SHOW ────────────────────────────────────────────────────────
function showAdminPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'flex';
  const user = localStorage.getItem('imperio_user') || 'admin';
  const badge = document.getElementById('admin-user-badge');
  if (badge) badge.textContent = user;
  loadDashboard();
  loadAdminBrands();
  loadAdminCategories();
}

// ── API HELPER ────────────────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (res.status === 401) {
    localStorage.removeItem('imperio_token');
    location.reload();
    return;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// ── VIEW SWITCHING ────────────────────────────────────────────────────
const viewTitles = { dashboard: 'Dashboard', products: 'Productos', brands: 'Marcas', categories: 'Categorías', hero: 'Configuración del Hero', music: 'Música Ambiental', branding: 'Logo & Identidad de Marca' };

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add('active');
  const title = document.getElementById('page-title');
  if (title) title.textContent = viewTitles[view] || view;

  if (view === 'dashboard') loadDashboard();
  if (view === 'products') loadAdminProducts();
  if (view === 'brands') renderAdminBrands();
  if (view === 'categories') renderAdminCategories();
  if (view === 'hero') loadHeroSettings();
  if (view === 'music') loadMusicSettings();
  if (view === 'branding') loadBrandingSettings();
}

// ── DASHBOARD ─────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const stats = await api('/api/stats');
    const grid = document.getElementById('stats-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="stat-card"><div class="stat-inner"><span class="stat-num">${stats.activeProducts}</span><span class="stat-lbl">Productos activos</span></div></div>
        <div class="stat-card"><div class="stat-inner"><span class="stat-num">${stats.totalBrands}</span><span class="stat-lbl">Marcas activas</span></div></div>
        <div class="stat-card"><div class="stat-inner"><span class="stat-num">${stats.outOfStock}</span><span class="stat-lbl">Sin stock</span></div></div>
        <div class="stat-card"><div class="stat-inner"><span class="stat-num">${stats.lowStock}</span><span class="stat-lbl">Poco stock</span></div></div>
      `;
    }
    const recent = document.getElementById('recent-products');
    if (recent && stats.recentProducts) {
      if (!stats.recentProducts.length) {
        recent.innerHTML = '<div class="recent-item"><span class="recent-name" style="color:var(--gray)">No hay productos aún. Crea el primero desde el menú Productos.</span></div>';
        return;
      }
      recent.innerHTML = stats.recentProducts.map(p => `
        <div class="recent-item">
          <div>
            <span class="recent-name">${p.name}</span>
            ${p.brand_name ? `<span class="recent-brand"> — ${p.brand_name}</span>` : ''}
          </div>
          <span class="recent-price">${Number(p.price).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })}</span>
          <span class="recent-date">${new Date(p.created_at).toLocaleDateString('es-AR')}</span>
        </div>
      `).join('');
    }
  } catch (e) {
    console.warn('Dashboard load error:', e.message);
  }
}

// ── PRODUCTS ──────────────────────────────────────────────────────────
async function loadAdminProducts() {
  try {
    adminProducts = await api('/api/products/admin/all');
    renderProductsTable(adminProducts);
  } catch (e) {
    showToast('Error al cargar productos', 'error');
  }
}

function filterAdminProducts() {
  const q = document.getElementById('product-search')?.value.toLowerCase() || '';
  const filtered = adminProducts.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.brand_name || '').toLowerCase().includes(q) ||
    (p.sku || '').toLowerCase().includes(q)
  );
  renderProductsTable(filtered);
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:32px">No hay productos. ¡Crea el primero!</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => {
    const img = p.image || (p.images && p.images[0]?.url);
    const stock = p.total_stock || 0;
    const stockColor = stock === 0 ? 'var(--danger)' : stock <= 5 ? 'var(--warning)' : 'var(--success)';
    return `
      <tr>
        <td>
          ${img
            ? `<img src="${img}" alt="${p.name}" class="table-thumb" onerror="this.style.display='none'">`
            : `<div class="table-thumb-placeholder"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
          }
        </td>
        <td>
          <div style="font-weight:400">${p.name}</div>
          ${p.sku ? `<div style="font-size:0.72rem;color:var(--gray)">${p.sku}</div>` : ''}
        </td>
        <td style="color:var(--gold-2)">${p.brand_name || '—'}</td>
        <td style="font-family:var(--font-serif)">${Number(p.price).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })}</td>
        <td style="color:${stockColor};font-weight:500">${stock} uds.</td>
        <td>
          <span class="status-badge ${p.active ? 'status-active' : 'status-inactive'}">${p.active ? 'Activo' : 'Inactivo'}</span>
          ${p.featured ? '<span class="status-badge status-active" style="margin-left:4px;background:var(--gold-dim);color:var(--gold-2);border-color:var(--gold)">★</span>' : ''}
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-icon edit" title="Editar" onclick="editProduct(${p.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" title="${p.active ? 'Desactivar' : 'Activar'}" onclick="toggleProduct(${p.id}, ${p.active ? 0 : 1})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/>${p.active ? '<line x1="8" y1="18" x2="8" y2="6"/><line x1="16" y1="18" x2="16" y2="6"/>' : '<polygon points="5,3 19,12 5,21"/>'}</svg>
            </button>
            <button class="btn-icon delete" title="Eliminar" onclick="confirmDelete('producto', '${p.name}', () => deleteProduct(${p.id}))">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── PRODUCT MODAL ─────────────────────────────────────────────────────
function openProductModal(product = null) {
  document.getElementById('product-modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('edit-product-id').value = product?.id || '';
  document.getElementById('p-name').value = product?.name || '';
  document.getElementById('p-sku').value = product?.sku || '';
  document.getElementById('p-description').value = product?.description || '';
  document.getElementById('p-price').value = product?.price || '';
  document.getElementById('p-active').value = product?.active !== undefined ? String(product.active) : '1';
  document.getElementById('p-featured').value = String(product?.featured || 0);
  document.getElementById('p-new').value = String(product?.is_new || 0);
  document.getElementById('p-image-url').value = product?.image || '';
  document.getElementById('p-video-url').value = product?.video_url || '';

  // Image preview
  const preview = document.getElementById('p-image-preview');
  if (product?.image && preview) {
    preview.innerHTML = `<img src="${product.image}" alt="">`;
  } else if (preview) {
    preview.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Subir imagen (JPG, PNG, WebP)</span>`;
  }

  // Video preview
  const videoPreview = document.getElementById('p-video-preview');
  const videoCurrent = document.getElementById('p-video-current');
  if (product?.video_url && videoPreview) {
    videoPreview.innerHTML = `
      <video src="${product.video_url}" style="max-height:90px;border-radius:6px;object-fit:cover" muted loop autoplay playsinline></video>
      <span style="color:var(--success);font-size:0.78rem">✓ Video cargado</span>`;
    if (videoCurrent) videoCurrent.style.display = 'block';
  } else {
    if (videoPreview) videoPreview.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg><span>Subir video del producto (MP4, MOV — máx 100MB)</span>`;
    if (videoCurrent) videoCurrent.style.display = 'none';
  }

  // Brand select
  const brandSel = document.getElementById('p-brand');
  brandSel.innerHTML = '<option value="">Sin marca</option>' +
    adminBrands.map(b => `<option value="${b.id}" ${product?.brand_id === b.id ? 'selected' : ''}>${b.name}</option>`).join('');

  // Sizes
  const sizesList = document.getElementById('sizes-list');
  sizesList.innerHTML = '';
  if (product?.sizes?.length) {
    product.sizes.forEach(s => addSizeRow(s.size, s.stock));
  }

  // Categories checkboxes
  const checkboxWrap = document.getElementById('categories-checkboxes');
  const productCatIds = product?.categories?.map(c => c.id) || [];
  checkboxWrap.innerHTML = adminCategories.map(c => `
    <label class="checkbox-item">
      <input type="checkbox" value="${c.id}" ${productCatIds.includes(c.id) ? 'checked' : ''}>
      ${c.name}
    </label>
  `).join('');

  document.getElementById('product-modal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
}

async function editProduct(id) {
  try {
    const p = await fetch(`/api/products/${id}`).then(r => r.json());
    openProductModal(p);
  } catch (e) {
    showToast('Error al cargar producto', 'error');
  }
}

async function saveProduct() {
  const id = document.getElementById('edit-product-id').value;
  const name = document.getElementById('p-name').value.trim();
  if (!name) { showToast('El nombre es obligatorio', 'error'); return; }

  const sizes = [...document.querySelectorAll('.size-row')].map(row => ({
    size: row.querySelector('.size-input').value.trim(),
    stock: parseInt(row.querySelector('.stock-input').value) || 0
  })).filter(s => s.size);

  const categories = [...document.querySelectorAll('#categories-checkboxes input:checked')].map(i => parseInt(i.value));

  const data = {
    name,
    sku: document.getElementById('p-sku').value.trim(),
    description: document.getElementById('p-description').value.trim(),
    price: parseFloat(document.getElementById('p-price').value) || 0,
    brand_id: parseInt(document.getElementById('p-brand').value) || null,
    active: parseInt(document.getElementById('p-active').value),
    featured: parseInt(document.getElementById('p-featured').value),
    is_new: parseInt(document.getElementById('p-new').value),
    image: document.getElementById('p-image-url').value || null,
    video_url: document.getElementById('p-video-url').value || null,
    sizes,
    categories
  };

  try {
    if (id) {
      await api(`/api/products/${id}`, 'PUT', data);
      showToast('Producto actualizado', 'success');
    } else {
      await api('/api/products', 'POST', data);
      showToast('Producto creado', 'success');
    }
    closeProductModal();
    loadAdminProducts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteProduct(id) {
  try {
    await api(`/api/products/${id}`, 'DELETE');
    showToast('Producto eliminado');
    loadAdminProducts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function toggleProduct(id, active) {
  const p = adminProducts.find(pr => pr.id === id);
  if (!p) return;
  try {
    await api(`/api/products/${id}`, 'PUT', { ...p, active, sizes: p.sizes, categories: [] });
    showToast(active ? 'Producto activado' : 'Producto desactivado');
    loadAdminProducts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function addSizeRow(size = '', stock = 0) {
  const list = document.getElementById('sizes-list');
  const row = document.createElement('div');
  row.className = 'size-row';
  row.innerHTML = `
    <input type="text" class="size-input" placeholder="XS, S, M, L, 42..." value="${size}">
    <input type="number" class="stock-input" placeholder="0" min="0" value="${stock}">
    <button type="button" class="size-remove" onclick="this.closest('.size-row').remove()">✕</button>
  `;
  list.appendChild(row);
  list.querySelector('.size-row:last-child .size-input').focus();
}

// ── UPLOAD HELPER ─────────────────────────────────────────────────────
async function uploadFile(file, type) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/upload/${type}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── PRODUCT VIDEO UPLOAD ───────────────────────────────────────────────
async function uploadProductVideo(input) {
  const file = input.files[0];
  if (!file) return;
  const errEl = document.getElementById('p-video-error');
  if (errEl) errEl.style.display = 'none';
  showToast('Subiendo video...');
  try {
    const data = await uploadFile(file, 'products');
    document.getElementById('p-video-url').value = data.url;
    const preview = document.getElementById('p-video-preview');
    if (preview) {
      preview.innerHTML = `
        <video src="${data.url}" style="max-height:90px;border-radius:6px;object-fit:cover" muted loop autoplay playsinline></video>
        <span style="color:var(--success);font-size:0.78rem">✓ ${data.originalname}</span>`;
    }
    document.getElementById('p-video-current').style.display = 'block';
    showToast('Video subido', 'success');
  } catch (e) {
    if (errEl) { errEl.textContent = '✕ Error: ' + e.message; errEl.style.display = 'block'; }
    showToast('Error al subir video: ' + e.message, 'error');
  }
}

function clearProductVideo() {
  document.getElementById('p-video-url').value = '';
  document.getElementById('p-video-input').value = '';
  document.getElementById('p-video-preview').innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
    <span>Tocá para subir video (MP4, MOV — máx 100MB)</span>`;
  document.getElementById('p-video-current').style.display = 'none';
}

// ── PRODUCT IMAGE UPLOAD ───────────────────────────────────────────────
async function uploadProductImage(input) {
  const file = input.files[0];
  if (!file) return;
  const errEl = document.getElementById('p-image-error');
  if (errEl) errEl.style.display = 'none';
  const preview = document.getElementById('p-image-preview');
  if (preview) preview.innerHTML = '<span style="color:var(--gold-2)">Subiendo...</span>';
  try {
    const data = await uploadFile(file, 'products');
    document.getElementById('p-image-url').value = data.url;
    if (preview) preview.innerHTML = `<img src="${data.url}" alt="" style="max-height:120px;border-radius:6px">`;
    showToast('Imagen subida ✓', 'success');
  } catch (e) {
    if (errEl) { errEl.textContent = '✕ Error: ' + e.message; errEl.style.display = 'block'; }
    if (preview) preview.innerHTML = `<span>Tocá para subir imagen (JPG, PNG, WebP)</span>`;
    showToast('Error al subir imagen: ' + e.message, 'error');
  }
}

// ── BRANDS ────────────────────────────────────────────────────────────
async function loadAdminBrands() {
  try {
    adminBrands = await fetch('/api/brands').then(r => r.json());
  } catch (e) {}
}

function renderAdminBrands() {
  const grid = document.getElementById('brands-admin-grid');
  if (!grid) return;
  if (!adminBrands.length) {
    grid.innerHTML = '<p style="color:var(--gray);font-size:0.88rem">No hay marcas aún. Crea la primera.</p>';
    return;
  }
  grid.innerHTML = adminBrands.map(b => `
    <div class="brand-admin-card">
      <div class="brand-admin-logo">
        ${b.logo ? `<img src="${b.logo}" alt="${b.name}">` : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20"/></svg>`}
      </div>
      <div class="brand-admin-name">${b.name}</div>
      <div style="font-size:0.72rem;text-align:center">
        <span class="status-badge ${b.active ? 'status-active' : 'status-inactive'}">${b.active ? 'Activa' : 'Inactiva'}</span>
      </div>
      <div class="brand-admin-actions">
        <button class="btn-icon edit" title="Editar" onclick="editBrand(${b.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon delete" title="Eliminar" onclick="confirmDelete('marca', '${b.name}', () => deleteBrand(${b.id}))">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function openBrandModal(brand = null) {
  document.getElementById('brand-modal-title').textContent = brand ? 'Editar Marca' : 'Nueva Marca';
  document.getElementById('edit-brand-id').value = brand?.id || '';
  document.getElementById('b-name').value = brand?.name || '';
  document.getElementById('b-active').value = String(brand?.active !== undefined ? brand.active : 1);
  document.getElementById('b-order').value = brand?.sort_order || 0;
  document.getElementById('b-logo-url').value = brand?.logo || '';

  const preview = document.getElementById('b-logo-preview');
  if (brand?.logo && preview) {
    preview.innerHTML = `<img src="${brand.logo}" alt="">`;
  } else if (preview) {
    preview.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><span>Subir logo</span>`;
  }

  document.getElementById('brand-modal').classList.add('open');
}

function closeBrandModal() {
  document.getElementById('brand-modal').classList.remove('open');
}

async function editBrand(id) {
  const brand = adminBrands.find(b => b.id === id);
  if (brand) openBrandModal(brand);
}

async function saveBrand() {
  const id = document.getElementById('edit-brand-id').value;
  const name = document.getElementById('b-name').value.trim();
  if (!name) { showToast('El nombre es obligatorio', 'error'); return; }

  const data = {
    name,
    logo: document.getElementById('b-logo-url').value || null,
    active: parseInt(document.getElementById('b-active').value),
    sort_order: parseInt(document.getElementById('b-order').value) || 0
  };

  try {
    if (id) {
      await api(`/api/brands/${id}`, 'PUT', data);
      showToast('Marca actualizada', 'success');
    } else {
      await api('/api/brands', 'POST', data);
      showToast('Marca creada', 'success');
    }
    closeBrandModal();
    adminBrands = await fetch('/api/brands').then(r => r.json());
    renderAdminBrands();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteBrand(id) {
  try {
    await api(`/api/brands/${id}`, 'DELETE');
    showToast('Marca eliminada');
    adminBrands = await fetch('/api/brands').then(r => r.json());
    renderAdminBrands();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function uploadBrandLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('b-logo-preview');
  if (preview) preview.innerHTML = '<span style="color:var(--gold-2)">Subiendo...</span>';
  try {
    const data = await uploadFile(file, 'brands');
    document.getElementById('b-logo-url').value = data.url;
    if (preview) preview.innerHTML = `<img src="${data.url}" alt="" style="max-height:80px">`;
    showToast('Logo subido ✓', 'success');
  } catch (e) {
    if (preview) preview.innerHTML = '<span>Subir logo</span>';
    showToast('Error: ' + e.message, 'error');
  }
}

// ── CATEGORIES ────────────────────────────────────────────────────────
async function loadAdminCategories() {
  try {
    adminCategories = await fetch('/api/categories').then(r => r.json());
  } catch (e) {}
}

function renderAdminCategories() {
  const list = document.getElementById('categories-list');
  if (!list) return;
  if (!adminCategories.length) {
    list.innerHTML = '<div class="category-item"><span style="color:var(--gray)">No hay categorías aún.</span></div>';
    return;
  }
  list.innerHTML = adminCategories.map(c => `
    <div class="category-item">
      <span>${c.name}</span>
      <button class="btn-icon delete" onclick="confirmDelete('categoría', '${c.name}', () => deleteCategory(${c.id}))">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>
    </div>
  `).join('');
}

async function addCategory() {
  const input = document.getElementById('new-category-name');
  const name = input?.value.trim();
  if (!name) return;
  try {
    await api('/api/categories', 'POST', { name });
    input.value = '';
    adminCategories = await fetch('/api/categories').then(r => r.json());
    renderAdminCategories();
    showToast('Categoría creada', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteCategory(id) {
  try {
    await api(`/api/categories/${id}`, 'DELETE');
    adminCategories = await fetch('/api/categories').then(r => r.json());
    renderAdminCategories();
    showToast('Categoría eliminada');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── HERO SETTINGS ─────────────────────────────────────────────────────
async function loadHeroSettings() {
  try {
    const h = await fetch('/api/hero').then(r => r.json());
    document.getElementById('hero-title').value = h.title || '';
    document.getElementById('hero-subtitle').value = h.subtitle || '';
    document.getElementById('hero-description').value = h.description || '';
    document.getElementById('hero-cta-text').value = h.cta_text || '';
    document.getElementById('hero-cta-link').value = h.cta_link || '';
    document.getElementById('hero-accent-color').value = h.accent_color || '#8A6A32';
    document.getElementById('hero-accent-color-text').value = h.accent_color || '#8A6A32';
    document.getElementById('hero-active').value = String(h.active !== undefined ? h.active : 1);
    if (h.hero_3d_image) {
      document.getElementById('hero-3d-image-url').value = h.hero_3d_image;
      const preview = document.getElementById('hero-3d-preview');
      if (preview) preview.innerHTML = `<img src="${h.hero_3d_image}" alt="Producto 3D" style="max-height:120px">`;
    }
  } catch (e) {}
}

async function uploadHero3DImage(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('hero-3d-preview');
  if (preview) preview.innerHTML = '<span style="color:var(--gold-2)">Subiendo...</span>';
  try {
    const data = await uploadFile(file, 'products');
    document.getElementById('hero-3d-image-url').value = data.url;
    if (preview) preview.innerHTML = `<img src="${data.url}" alt="Producto 3D" style="max-height:120px">`;
    showToast('Imagen subida. Guardá el hero para aplicar.', 'success');
  } catch (e) {
    if (preview) preview.innerHTML = '<span>Subir imagen del producto</span>';
    showToast('Error: ' + e.message, 'error');
  }
}

async function saveHero() {
  const data = {
    title: document.getElementById('hero-title').value,
    subtitle: document.getElementById('hero-subtitle').value,
    description: document.getElementById('hero-description').value,
    cta_text: document.getElementById('hero-cta-text').value,
    cta_link: document.getElementById('hero-cta-link').value,
    accent_color: document.getElementById('hero-accent-color').value,
    active: parseInt(document.getElementById('hero-active').value),
    hero_3d_image: document.getElementById('hero-3d-image-url')?.value || null
  };
  try {
    await api('/api/hero', 'PUT', data);
    showToast('Hero actualizado', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function syncColor() {
  const text = document.getElementById('hero-accent-color-text').value;
  if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
    document.getElementById('hero-accent-color').value = text;
  }
}

// ── MUSIC SETTINGS ────────────────────────────────────────────────────
async function loadMusicSettings() {
  try {
    const m = await fetch('/api/music').then(r => r.json());
    document.getElementById('music-active').value = String(m.active || 0);
    document.getElementById('music-name').value = m.track_name || '';
    if (m.track_url) {
      const urlInput = document.getElementById('music-url-input');
      if (urlInput) urlInput.value = m.track_url;
      const trackEl = document.getElementById('music-current-track');
      if (trackEl) {
        trackEl.style.display = 'flex';
        trackEl.textContent = '♪ ' + (m.track_name || m.track_url.split('/').pop());
      }
    }
  } catch (e) {}
}


async function uploadMusicFile(input) {
  const file = input.files[0];
  if (!file) return;
  showToast('Subiendo audio...');
  try {
    const data = await uploadFile(file, 'music');
    const trackEl = document.getElementById('music-current-track');
    if (trackEl) {
      trackEl.style.display = 'flex';
      trackEl.textContent = '♪ ' + data.originalname;
    }
    // Save track URL to music settings automatically
    const name = document.getElementById('music-name').value || file.name.replace(/\.[^.]+$/, '');
    await api('/api/music', 'PUT', {
      track_name: name,
      track_url: data.url,
      active: parseInt(document.getElementById('music-active').value)
    });
    showToast('Audio subido y guardado', 'success');
  } catch (e) {
    showToast('Error al subir audio: ' + e.message, 'error');
  }
}

async function saveMusic() {
  const urlField = document.getElementById('music-url-input');
  const data = {
    track_name: document.getElementById('music-name').value,
    track_url: urlField?.value?.trim() || null,
    active: parseInt(document.getElementById('music-active').value)
  };
  try {
    await api('/api/music', 'PUT', data);
    showToast('Música actualizada', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── BRANDING (LOGO) ───────────────────────────────────────────────────
async function loadBrandingSettings() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();
    if (s.logo_url) {
      document.getElementById('logo-url-hidden').value = s.logo_url;
      const preview = document.getElementById('logo-preview');
      if (preview) preview.innerHTML = `<img src="${s.logo_url}" alt="Logo" style="max-height:80px">`;
      const liveImg = document.getElementById('logo-preview-img');
      if (liveImg) { liveImg.src = s.logo_url; document.getElementById('logo-live-preview').style.display = 'block'; }
    }
    if (s.logo_color) {
      document.getElementById('logo-color-picker').value = s.logo_color;
      document.getElementById('logo-color-text').value = s.logo_color;
      applyLogoColorPreview(s.logo_color);
    }
  } catch (e) {}
}

async function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('logo-preview');
  if (preview) preview.innerHTML = '<span style="color:var(--gold-2)">Subiendo...</span>';
  try {
    const data = await uploadFile(file, 'logos');
    document.getElementById('logo-url-hidden').value = data.url;
    if (preview) preview.innerHTML = `<img src="${data.url}" alt="Logo" style="max-height:80px">`;
    const liveImg = document.getElementById('logo-preview-img');
    if (liveImg) { liveImg.src = data.url; document.getElementById('logo-live-preview').style.display = 'block'; }
    showToast('Logo subido. Guardá para aplicar.', 'success');
  } catch (e) {
    if (preview) preview.innerHTML = '<span>Subir logo (SVG, PNG con fondo transparente)</span>';
    showToast('Error al subir logo: ' + e.message, 'error');
  }
}

function syncLogoColor() {
  const text = document.getElementById('logo-color-text').value;
  if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
    document.getElementById('logo-color-picker').value = text;
    applyLogoColorPreview(text);
  }
}

function applyLogoColorPreview(color) {
  const liveImg = document.getElementById('logo-preview-img');
  if (liveImg) liveImg.style.filter = `brightness(0) saturate(100%) invert(1) sepia(1) saturate(3) hue-rotate(${hexToHueDeg(color)}deg)`;
}

function hexToHueDeg(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  if (max === min) return 0;
  let h = max === r ? ((g-b)/(max-min)) : max === g ? 2+(b-r)/(max-min) : 4+(r-g)/(max-min);
  return Math.round(((h * 60) + 360) % 360);
}

async function saveBranding() {
  const logoUrl = document.getElementById('logo-url-hidden').value;
  const logoColor = document.getElementById('logo-color-picker').value;
  try {
    const opts = { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, method: 'PUT' };
    if (logoUrl) await fetch('/api/settings/logo_url', { ...opts, body: JSON.stringify({ value: logoUrl }) });
    await fetch('/api/settings/logo_color', { ...opts, body: JSON.stringify({ value: logoColor }) });
    showToast('Logo y color guardados', 'success');
  } catch (e) {
    showToast('Error al guardar: ' + e.message, 'error');
  }
}

// ── CONFIRM DELETE ────────────────────────────────────────────────────
let confirmCallback = null;

function confirmDelete(type, name, callback) {
  document.getElementById('confirm-title').textContent = `Eliminar ${type}`;
  document.getElementById('confirm-message').textContent = `¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`;
  confirmCallback = callback;
  document.getElementById('confirm-dialog').classList.add('open');
  document.getElementById('confirm-ok-btn').onclick = () => {
    closeConfirm();
    if (confirmCallback) confirmCallback();
  };
}

function closeConfirm() {
  document.getElementById('confirm-dialog').classList.remove('open');
  confirmCallback = null;
}

// ── TOAST ─────────────────────────────────────────────────────────────
let toastTimeout;

function showToast(msg, type = '') {
  const toast = document.getElementById('admin-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `admin-toast show ${type}`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── KEY HANDLERS ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.admin-modal.open').forEach(m => m.classList.remove('open'));
  }
  if (e.key === 'Enter' && document.getElementById('new-category-name') === document.activeElement) {
    addCategory();
  }
});

// Close modals on backdrop click
document.querySelectorAll('.admin-modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });
});
