require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

const cloudinary = require('cloudinary').v2;
const { pool, initDB } = require('./database');
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'imperio_inc_secret_key_2024_premium';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sin autorización' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// ─── AUTH ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Datos incompletos' });
    const user = (await pool.query('SELECT * FROM users WHERE username = $1', [username])).rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  try {
    const { current, newPass } = req.body;
    const user = (await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0];
    if (!bcrypt.compareSync(current, user.password)) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [bcrypt.hashSync(newPass, 10), req.user.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────
async function enrichProducts(products) {
  for (const p of products) {
    p.sizes = (await pool.query('SELECT * FROM product_sizes WHERE product_id = $1 ORDER BY sort_order', [p.id])).rows;
    p.images = (await pool.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order', [p.id])).rows;
    p.total_stock = p.sizes.reduce((a, s) => a + s.stock, 0);
  }
  return products;
}

app.get('/api/products', async (req, res) => {
  try {
    const { brand, category, size, min_price, max_price, available, featured, is_new, search, limit = 60, offset = 0 } = req.query;
    const params = [];
    let i = 0;
    const p = () => `$${++i}`;

    let q = `SELECT p.*, b.name as brand_name, b.logo as brand_logo FROM products p LEFT JOIN brands b ON p.brand_id = b.id WHERE p.active = 1`;
    if (brand)    { q += ` AND p.brand_id = ${p()}`; params.push(brand); }
    if (featured === '1') q += ` AND p.featured = 1`;
    if (is_new === '1')   q += ` AND p.is_new = 1`;
    if (min_price){ q += ` AND p.price >= ${p()}`; params.push(Number(min_price)); }
    if (max_price){ q += ` AND p.price <= ${p()}`; params.push(Number(max_price)); }
    if (search)   { const s = `%${search}%`; q += ` AND (p.name ILIKE ${p()} OR p.description ILIKE ${p()} OR p.sku ILIKE ${p()})`; params.push(s, s, s); }
    if (category) { q += ` AND p.id IN (SELECT product_id FROM product_categories WHERE category_id = ${p()})`; params.push(category); }
    if (available === '1') q += ` AND p.id IN (SELECT product_id FROM product_sizes WHERE stock > 0)`;
    if (size)     { q += ` AND p.id IN (SELECT product_id FROM product_sizes WHERE size = ${p()} AND stock > 0)`; params.push(size); }

    q += ` ORDER BY p.sort_order ASC, p.created_at DESC LIMIT ${p()} OFFSET ${p()}`;
    params.push(parseInt(limit), parseInt(offset));

    const products = (await pool.query(q, params)).rows;
    res.json(await enrichProducts(products));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/admin/all', auth, async (req, res) => {
  try {
    const products = (await pool.query(`SELECT p.*, b.name as brand_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id ORDER BY p.sort_order ASC, p.created_at DESC`)).rows;
    res.json(await enrichProducts(products));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const p = (await pool.query(`SELECT p.*, b.name as brand_name, b.logo as brand_logo FROM products p LEFT JOIN brands b ON p.brand_id = b.id WHERE p.id = $1`, [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    p.sizes = (await pool.query('SELECT * FROM product_sizes WHERE product_id = $1 ORDER BY sort_order', [p.id])).rows;
    p.images = (await pool.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order', [p.id])).rows;
    p.categories = (await pool.query('SELECT c.* FROM categories c JOIN product_categories pc ON c.id = pc.category_id WHERE pc.product_id = $1', [p.id])).rows;
    p.total_stock = p.sizes.reduce((a, s) => a + s.stock, 0);
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', auth, async (req, res) => {
  try {
    const { name, description, price, brand_id, sku, featured, is_new, active, sort_order, model_3d, image, video_url, sizes, categories } = req.body;
    const r = await pool.query(
      `INSERT INTO products (name, description, price, brand_id, sku, featured, is_new, active, sort_order, model_3d, image, video_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [name, description, price||0, brand_id||null, sku, featured?1:0, is_new?1:0, active!==false?1:0, sort_order||0, model_3d||null, image||null, video_url||null]
    );
    const id = r.rows[0].id;
    if (sizes?.length) for (let j=0;j<sizes.length;j++) await pool.query('INSERT INTO product_sizes (product_id,size,stock,sort_order) VALUES ($1,$2,$3,$4)', [id, sizes[j].size, sizes[j].stock||0, j]);
    if (categories?.length) for (const cid of categories) await pool.query('INSERT INTO product_categories (product_id,category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, cid]);
    res.status(201).json((await pool.query('SELECT * FROM products WHERE id = $1', [id])).rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', auth, async (req, res) => {
  try {
    const { name, description, price, brand_id, sku, featured, is_new, active, sort_order, model_3d, image, video_url, sizes, categories } = req.body;
    const id = req.params.id;
    await pool.query(
      `UPDATE products SET name=$1,description=$2,price=$3,brand_id=$4,sku=$5,featured=$6,is_new=$7,active=$8,sort_order=$9,model_3d=$10,image=$11,video_url=$12,updated_at=CURRENT_TIMESTAMP WHERE id=$13`,
      [name, description, price||0, brand_id||null, sku, featured?1:0, is_new?1:0, active!==false?1:0, sort_order||0, model_3d||null, image||null, video_url||null, id]
    );
    if (sizes) { await pool.query('DELETE FROM product_sizes WHERE product_id=$1',[id]); for(let j=0;j<sizes.length;j++) await pool.query('INSERT INTO product_sizes(product_id,size,stock,sort_order) VALUES($1,$2,$3,$4)',[id,sizes[j].size,sizes[j].stock||0,j]); }
    if (categories) { await pool.query('DELETE FROM product_categories WHERE product_id=$1',[id]); for(const cid of categories) await pool.query('INSERT INTO product_categories(product_id,category_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,cid]); }
    res.json((await pool.query('SELECT * FROM products WHERE id=$1',[id])).rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', auth, async (req, res) => {
  try { await pool.query('DELETE FROM products WHERE id=$1',[req.params.id]); res.json({success:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/products/:id/images', auth, async (req, res) => {
  try {
    const { url, sort_order } = req.body;
    const r = await pool.query('INSERT INTO product_images(product_id,url,sort_order) VALUES($1,$2,$3) RETURNING id',[req.params.id,url,sort_order||0]);
    res.status(201).json((await pool.query('SELECT * FROM product_images WHERE id=$1',[r.rows[0].id])).rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/products/:id/images/:imgId', auth, async (req, res) => {
  try { await pool.query('DELETE FROM product_images WHERE id=$1 AND product_id=$2',[req.params.imgId,req.params.id]); res.json({success:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ─── BRANDS ───────────────────────────────────────────────────────────
app.get('/api/brands', async (req, res) => {
  try {
    const { active } = req.query;
    let q = 'SELECT * FROM brands' + (active==='1' ? ' WHERE active=1' : '') + ' ORDER BY sort_order ASC, name ASC';
    res.json((await pool.query(q)).rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/brands', auth, async (req, res) => {
  try {
    const { name, logo, active, sort_order } = req.body;
    const r = await pool.query('INSERT INTO brands(name,logo,active,sort_order) VALUES($1,$2,$3,$4) RETURNING id',[name,logo||null,active!==false?1:0,sort_order||0]);
    res.status(201).json((await pool.query('SELECT * FROM brands WHERE id=$1',[r.rows[0].id])).rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/brands/:id', auth, async (req, res) => {
  try {
    const { name, logo, active, sort_order } = req.body;
    await pool.query('UPDATE brands SET name=$1,logo=$2,active=$3,sort_order=$4 WHERE id=$5',[name,logo||null,active!==false?1:0,sort_order||0,req.params.id]);
    res.json((await pool.query('SELECT * FROM brands WHERE id=$1',[req.params.id])).rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/brands/:id', auth, async (req, res) => {
  try { await pool.query('DELETE FROM brands WHERE id=$1',[req.params.id]); res.json({success:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM categories ORDER BY name')).rows); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/categories', auth, async (req, res) => {
  try {
    const r = await pool.query('INSERT INTO categories(name) VALUES($1) RETURNING id',[req.body.name]);
    res.status(201).json((await pool.query('SELECT * FROM categories WHERE id=$1',[r.rows[0].id])).rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/categories/:id', auth, async (req, res) => {
  try { await pool.query('DELETE FROM categories WHERE id=$1',[req.params.id]); res.json({success:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ─── HERO ─────────────────────────────────────────────────────────────
app.get('/api/hero', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM hero_settings WHERE id=1')).rows[0]||{}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/hero', auth, async (req, res) => {
  try {
    const { title, subtitle, description, cta_text, cta_link, product_id, active, accent_color, hero_3d_image } = req.body;
    await pool.query(
      `INSERT INTO hero_settings(id,title,subtitle,description,cta_text,cta_link,product_id,active,accent_color,hero_3d_image) VALUES(1,$1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(id) DO UPDATE SET title=$1,subtitle=$2,description=$3,cta_text=$4,cta_link=$5,product_id=$6,active=$7,accent_color=$8,hero_3d_image=$9`,
      [title,subtitle,description,cta_text,cta_link,product_id||null,active!==false?1:0,accent_color||'#8A6A32',hero_3d_image||null]
    );
    res.json((await pool.query('SELECT * FROM hero_settings WHERE id=1')).rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ─── MUSIC ────────────────────────────────────────────────────────────
app.get('/api/music', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM music_settings WHERE id=1')).rows[0]||{}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/music', auth, async (req, res) => {
  try {
    const { track_name, track_url, active } = req.body;
    await pool.query(
      `INSERT INTO music_settings(id,track_name,track_url,active) VALUES(1,$1,$2,$3) ON CONFLICT(id) DO UPDATE SET track_name=$1,track_url=$2,active=$3`,
      [track_name, track_url||null, active?1:0]
    );
    res.json((await pool.query('SELECT * FROM music_settings WHERE id=1')).rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    const rows = (await pool.query('SELECT key,value FROM site_settings')).rows;
    const obj = {}; rows.forEach(r => obj[r.key]=r.value); res.json(obj);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/settings/:key', auth, async (req, res) => {
  try {
    await pool.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2',[req.params.key,req.body.value]);
    res.json({ key: req.params.key, value: req.body.value });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ─── STATS ────────────────────────────────────────────────────────────
app.get('/api/stats', auth, async (req, res) => {
  try {
    const totalProducts    = parseInt((await pool.query('SELECT COUNT(*) as c FROM products')).rows[0].c);
    const activeProducts   = parseInt((await pool.query('SELECT COUNT(*) as c FROM products WHERE active=1')).rows[0].c);
    const totalBrands      = parseInt((await pool.query('SELECT COUNT(*) as c FROM brands WHERE active=1')).rows[0].c);
    const totalCategories  = parseInt((await pool.query('SELECT COUNT(*) as c FROM categories')).rows[0].c);

    const prods = (await pool.query('SELECT id FROM products WHERE active=1')).rows;
    let outOfStock=0, lowStock=0;
    for (const prod of prods) {
      const sizes = (await pool.query('SELECT stock FROM product_sizes WHERE product_id=$1',[prod.id])).rows;
      const total = sizes.reduce((a,s)=>a+s.stock,0);
      if (total===0) outOfStock++; else if (total<=5) lowStock++;
    }

    const recentProducts = (await pool.query(`SELECT p.name,p.price,b.name as brand_name,p.created_at FROM products p LEFT JOIN brands b ON p.brand_id=b.id ORDER BY p.created_at DESC LIMIT 5`)).rows;
    res.json({ totalProducts, activeProducts, totalBrands, totalCategories, outOfStock, lowStock, recentProducts });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ─── UPLOAD ───────────────────────────────────────────────────────────
app.post('/api/upload/:type', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  const isVideo = req.file.mimetype.startsWith('video');
  const folder  = `imperio-inc/${req.params.type || 'general'}`;

  const uploadOptions = {
    folder,
    resource_type: isVideo ? 'video' : 'image',
  };
  if (!isVideo) {
    uploadOptions.transformation = [{ quality: 'auto', fetch_format: 'auto' }];
  }

  const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json({ url: result.secure_url, filename: result.public_id, originalname: req.file.originalname });
  });

  stream.end(req.file.buffer);
});

// ─── SERVE ────────────────────────────────────────────────────────────
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  IMPERIO INC. corriendo en http://localhost:${PORT}`);
    console.log(`  Admin: http://localhost:${PORT}/admin`);
    console.log(`  Creds: admin / imperio2024\n`);
  });
}).catch(err => { console.error('Error DB:', err); process.exit(1); });
