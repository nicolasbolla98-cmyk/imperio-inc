const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'imperio.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo TEXT,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    sku TEXT,
    image TEXT,
    model_3d TEXT,
    featured INTEGER DEFAULT 0,
    is_new INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS product_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS product_categories (
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS hero_settings (
    id INTEGER PRIMARY KEY,
    title TEXT DEFAULT 'El Mejor Estilo',
    subtitle TEXT DEFAULT 'Lo Llevas Tú',
    description TEXT DEFAULT 'Indumentaria deportiva y formal. Accesorios de hombre premium.',
    cta_text TEXT DEFAULT 'Explorar Colección',
    cta_link TEXT DEFAULT '#productos',
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    active INTEGER DEFAULT 1,
    accent_color TEXT DEFAULT '#8A6A32'
  );

  CREATE TABLE IF NOT EXISTS music_settings (
    id INTEGER PRIMARY KEY,
    track_name TEXT DEFAULT 'Imperio Ambient',
    track_url TEXT,
    active INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Default admin user
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hashed = bcrypt.hashSync(process.env.ADMIN_PASS || 'imperio2024', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hashed);
  console.log('✓ Admin creado: admin / imperio2024');
}

// Default hero settings
const heroExists = db.prepare('SELECT id FROM hero_settings WHERE id = 1').get();
if (!heroExists) {
  db.prepare('INSERT INTO hero_settings (id) VALUES (1)').run();
}

// Default music settings
const musicExists = db.prepare('SELECT id FROM music_settings WHERE id = 1').get();
if (!musicExists) {
  db.prepare('INSERT INTO music_settings (id) VALUES (1)').run();
}

// Default categories
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
if (catCount === 0) {
  const cats = ['Remeras', 'Pantalones', 'Camperas', 'Zapatillas', 'Accesorios', 'Ropa Formal', 'Ropa Deportiva'];
  const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
  cats.forEach(c => stmt.run(c));
}

// Default demo brands
const brandCount = db.prepare('SELECT COUNT(*) as c FROM brands').get().c;
if (brandCount === 0) {
  const brands = [
    { name: 'Nike', sort_order: 1 },
    { name: 'Adidas', sort_order: 2 },
    { name: 'Puma', sort_order: 3 },
    { name: 'The North Face', sort_order: 4 },
    { name: 'New Balance', sort_order: 5 },
    { name: 'Vans', sort_order: 6 },
    { name: 'Amiri', sort_order: 7 },
    { name: 'Santa Barbera', sort_order: 8 },
  ];
  const stmt = db.prepare('INSERT INTO brands (name, sort_order) VALUES (?, ?)');
  brands.forEach(b => stmt.run(b.name, b.sort_order));
}

// Migrations for new columns
try { db.exec('ALTER TABLE products ADD COLUMN video_url TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE hero_settings ADD COLUMN hero_3d_image TEXT'); } catch(e) {}

module.exports = db;
