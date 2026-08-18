require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

const db = require('./database');
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'imperio_inc_secret_key_2024_premium';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sin autorización' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'general';
    const dir = path.join(__dirname, 'uploads', type);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// ─── AUTH ────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Datos incompletos' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.post('/api/auth/change-password', auth, (req, res) => {
  const { current, newPass } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current, user.password)) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPass, 10), req.user.id);
  res.json({ success: true });
});

// ─── PRODUCTS ────────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const { brand, category, size, min_price, max_price, available, featured, is_new, search, limit = 60, offset = 0 } = req.query;
  let q = `
    SELECT p.*, b.name as brand_name, b.logo as brand_logo
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.active = 1
  `;
  const params = [];
  if (brand) { q += ' AND p.brand_id = ?'; params.push(brand); }
  if (featured === '1') { q += ' AND p.featured = 1'; }
  if (is_new === '1') { q += ' AND p.is_new = 1'; }
  if (min_price) { q += ' AND p.price >= ?'; params.push(Number(min_price)); }
  if (max_price) { q += ' AND p.price <= ?'; params.push(Number(max_price)); }
  if (search) { q += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  if (category) {
    q += ' AND p.id IN (SELECT product_id FROM product_categories WHERE category_id = ?)';
    params.push(category);
  }

  if (available === '1') {
    q += ' AND p.id IN (SELECT product_id FROM product_sizes WHERE stock > 0)';
  }

  if (size) {
    q += ' AND p.id IN (SELECT product_id FROM product_sizes WHERE size = ? AND stock > 0)';
    params.push(size);
  }

  q += ' ORDER BY p.sort_order ASC, p.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const products = db.prepare(q).all(...params);
  products.forEach(p => {
    p.sizes = db.prepare('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order').all(p.id);
    p.images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order').all(p.id);
    p.total_stock = p.sizes.reduce((acc, s) => acc + s.stock, 0);
  });
  res.json(products);
});

app.get('/api/products/admin/all', auth, (req, res) => {
  const products = db.prepare(`
    SELECT p.*, b.name as brand_name FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    ORDER BY p.sort_order ASC, p.created_at DESC
  `).all();
  products.forEach(p => {
    p.sizes = db.prepare('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order').all(p.id);
    p.images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order').all(p.id);
    p.total_stock = p.sizes.reduce((acc, s) => acc + s.stock, 0);
  });
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, b.name as brand_name, b.logo as brand_logo
    FROM products p LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  p.sizes = db.prepare('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order').all(p.id);
  p.images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order').all(p.id);
  p.categories = db.prepare('SELECT c.* FROM categories c JOIN product_categories pc ON c.id = pc.category_id WHERE pc.product_id = ?').all(p.id);
  p.total_stock = p.sizes.reduce((acc, s) => acc + s.stock, 0);
  res.json(p);
});

app.post('/api/products', auth, (req, res) => {
  const { name, description, price, brand_id, sku, featured, is_new, active, sort_order, model_3d, image, video_url, sizes, categories } = req.body;
  const result = db.prepare(`
    INSERT INTO products (name, description, price, brand_id, sku, featured, is_new, active, sort_order, model_3d, image, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description, price || 0, brand_id || null, sku, featured ? 1 : 0, is_new ? 1 : 0, active !== false ? 1 : 0, sort_order || 0, model_3d || null, image || null, video_url || null);
  const id = result.lastInsertRowid;
  if (sizes?.length) {
    const stmt = db.prepare('INSERT INTO product_sizes (product_id, size, stock, sort_order) VALUES (?, ?, ?, ?)');
    sizes.forEach((s, i) => stmt.run(id, s.size, s.stock || 0, i));
  }
  if (categories?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)');
    categories.forEach(cid => stmt.run(id, cid));
  }
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

app.put('/api/products/:id', auth, (req, res) => {
  const { name, description, price, brand_id, sku, featured, is_new, active, sort_order, model_3d, image, video_url, sizes, categories } = req.body;
  const id = req.params.id;
  db.prepare(`
    UPDATE products SET name=?, description=?, price=?, brand_id=?, sku=?, featured=?, is_new=?, active=?, sort_order=?, model_3d=?, image=?, video_url=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, description, price || 0, brand_id || null, sku, featured ? 1 : 0, is_new ? 1 : 0, active !== false ? 1 : 0, sort_order || 0, model_3d || null, image || null, video_url || null, id);
  if (sizes) {
    db.prepare('DELETE FROM product_sizes WHERE product_id = ?').run(id);
    const stmt = db.prepare('INSERT INTO product_sizes (product_id, size, stock, sort_order) VALUES (?, ?, ?, ?)');
    sizes.forEach((s, i) => stmt.run(id, s.size, s.stock || 0, i));
  }
  if (categories) {
    db.prepare('DELETE FROM product_categories WHERE product_id = ?').run(id);
    const stmt = db.prepare('INSERT OR IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)');
    categories.forEach(cid => stmt.run(id, cid));
  }
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

app.delete('/api/products/:id', auth, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/products/:id/images', auth, (req, res) => {
  const { url, sort_order } = req.body;
  const result = db.prepare('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)').run(req.params.id, url, sort_order || 0);
  res.status(201).json(db.prepare('SELECT * FROM product_images WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/products/:id/images/:imgId', auth, (req, res) => {
  db.prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?').run(req.params.imgId, req.params.id);
  res.json({ success: true });
});

// ─── BRANDS ──────────────────────────────────────────────────────────
app.get('/api/brands', (req, res) => {
  const { active } = req.query;
  let q = 'SELECT * FROM brands';
  if (active === '1') q += ' WHERE active = 1';
  q += ' ORDER BY sort_order ASC, name ASC';
  res.json(db.prepare(q).all());
});

app.post('/api/brands', auth, (req, res) => {
  const { name, logo, active, sort_order } = req.body;
  const result = db.prepare('INSERT INTO brands (name, logo, active, sort_order) VALUES (?, ?, ?, ?)').run(name, logo || null, active !== false ? 1 : 0, sort_order || 0);
  res.status(201).json(db.prepare('SELECT * FROM brands WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/brands/:id', auth, (req, res) => {
  const { name, logo, active, sort_order } = req.body;
  db.prepare('UPDATE brands SET name=?, logo=?, active=?, sort_order=? WHERE id=?').run(name, logo || null, active !== false ? 1 : 0, sort_order || 0, req.params.id);
  res.json(db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id));
});

app.delete('/api/brands/:id', auth, (req, res) => {
  db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── CATEGORIES ──────────────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

app.post('/api/categories', auth, (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/categories/:id', auth, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── HERO ─────────────────────────────────────────────────────────────
app.get('/api/hero', (req, res) => {
  res.json(db.prepare('SELECT * FROM hero_settings WHERE id = 1').get() || {});
});

app.put('/api/hero', auth, (req, res) => {
  const { title, subtitle, description, cta_text, cta_link, product_id, active, accent_color, hero_3d_image } = req.body;
  db.prepare(`
    INSERT OR REPLACE INTO hero_settings (id, title, subtitle, description, cta_text, cta_link, product_id, active, accent_color, hero_3d_image)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, subtitle, description, cta_text, cta_link, product_id || null, active !== false ? 1 : 0, accent_color || '#8A6A32', hero_3d_image || null);
  res.json(db.prepare('SELECT * FROM hero_settings WHERE id = 1').get());
});

// ─── MUSIC ─────────────────────────────────────────────────────────────
app.get('/api/music', (req, res) => {
  res.json(db.prepare('SELECT * FROM music_settings WHERE id = 1').get() || {});
});

app.put('/api/music', auth, (req, res) => {
  const { track_name, track_url, active } = req.body;
  db.prepare('INSERT OR REPLACE INTO music_settings (id, track_name, track_url, active) VALUES (1, ?, ?, ?)').run(track_name, track_url || null, active ? 1 : 0);
  res.json(db.prepare('SELECT * FROM music_settings WHERE id = 1').get());
});

// ─── SITE SETTINGS (logo, branding) ──────────────────────────────────
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

app.put('/api/settings/:key', auth, (req, res) => {
  const { value } = req.body;
  db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(req.params.key, value);
  res.json({ key: req.params.key, value });
});

// ─── STATS ────────────────────────────────────────────────────────────
app.get('/api/stats', auth, (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const activeProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE active = 1').get().c;
  const totalBrands = db.prepare('SELECT COUNT(*) as c FROM brands WHERE active = 1').get().c;
  const totalCategories = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;

  const products = db.prepare('SELECT id FROM products WHERE active = 1').all();
  let outOfStock = 0, lowStock = 0;
  products.forEach(p => {
    const sizes = db.prepare('SELECT stock FROM product_sizes WHERE product_id = ?').all(p.id);
    const total = sizes.reduce((a, s) => a + s.stock, 0);
    if (total === 0) outOfStock++;
    else if (total <= 5) lowStock++;
  });

  const recentProducts = db.prepare(`
    SELECT p.name, p.price, b.name as brand_name, p.created_at
    FROM products p LEFT JOIN brands b ON p.brand_id = b.id
    ORDER BY p.created_at DESC LIMIT 5
  `).all();

  res.json({ totalProducts, activeProducts, totalBrands, totalCategories, outOfStock, lowStock, recentProducts });
});

// ─── FILE UPLOAD ──────────────────────────────────────────────────────
app.post('/api/upload/:type', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
  const url = `/uploads/${req.params.type}/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, originalname: req.file.originalname });
});

// ─── SERVE ────────────────────────────────────────────────────────────
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ██████  IMPERIO INC.`);
  console.log(`  Servidor: http://localhost:${PORT}`);
  console.log(`  Admin:    http://localhost:${PORT}/admin`);
  console.log(`  Creds:    admin / imperio2024\n`);
});
