const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS brands (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        logo TEXT,
        active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
        sku TEXT,
        image TEXT,
        video_url TEXT,
        model_3d TEXT,
        featured INTEGER DEFAULT 0,
        is_new INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS product_sizes (
        id SERIAL PRIMARY KEY,
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
        title TEXT DEFAULT 'IMPERIO',
        subtitle TEXT DEFAULT 'INC.',
        description TEXT DEFAULT 'El mejor estilo lo llevas tú',
        cta_text TEXT DEFAULT 'EXPLORAR COLECCIÓN',
        cta_link TEXT DEFAULT '#coleccion',
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        active INTEGER DEFAULT 1,
        accent_color TEXT DEFAULT '#8A6A32',
        hero_3d_image TEXT
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

    // Admin user
    const adminExists = (await client.query('SELECT id FROM users WHERE username = $1', ['admin'])).rows[0];
    if (!adminExists) {
      const hashed = bcrypt.hashSync(process.env.ADMIN_PASS || 'imperio2024', 10);
      await client.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', hashed]);
      console.log('✓ Admin creado: admin / imperio2024');
    }

    await client.query('INSERT INTO hero_settings (id) VALUES (1) ON CONFLICT DO NOTHING');
    await client.query('INSERT INTO music_settings (id) VALUES (1) ON CONFLICT DO NOTHING');

    // Categories
    const catCount = parseInt((await client.query('SELECT COUNT(*) as c FROM categories')).rows[0].c);
    if (catCount === 0) {
      for (const c of ['Remeras', 'Pantalones', 'Camperas', 'Zapatillas', 'Accesorios', 'Ropa Formal', 'Ropa Deportiva']) {
        await client.query('INSERT INTO categories (name) VALUES ($1)', [c]);
      }
    }

    // Brands
    const brandCount = parseInt((await client.query('SELECT COUNT(*) as c FROM brands')).rows[0].c);
    if (brandCount === 0) {
      for (const b of [
        { name: 'Nike', sort_order: 1 }, { name: 'Adidas', sort_order: 2 },
        { name: 'Puma', sort_order: 3 }, { name: 'The North Face', sort_order: 4 },
        { name: 'New Balance', sort_order: 5 }, { name: 'Vans', sort_order: 6 },
        { name: 'Amiri', sort_order: 7 }, { name: 'Santa Barbera', sort_order: 8 },
      ]) {
        await client.query('INSERT INTO brands (name, sort_order) VALUES ($1, $2)', [b.name, b.sort_order]);
      }
    }

    // Demo products
    const prodCount = parseInt((await client.query('SELECT COUNT(*) as c FROM products')).rows[0].c);
    if (prodCount === 0) {
      const brands = (await client.query('SELECT id, name FROM brands ORDER BY sort_order')).rows;
      const getBrand = (name) => brands.find(b => b.name === name)?.id || null;

      const demos = [
        { name: 'Remera Premium Oversize', desc: 'Remera de algodón premium, corte oversize. Ideal para el día a día.', price: 45000, sku: 'REM-001', featured: 1, is_new: 1, brand: 'Nike', sizes: ['S','M','L','XL'] },
        { name: 'Campera Deportiva Elite', desc: 'Campera con tecnología de secado rápido y diseño moderno.', price: 120000, sku: 'CAM-001', featured: 1, is_new: 0, brand: 'Adidas', sizes: ['S','M','L','XL'] },
        { name: 'Pantalón Cargo Urban', desc: 'Pantalón cargo con múltiples bolsillos, estilo urbano.', price: 85000, sku: 'PAN-001', featured: 0, is_new: 1, brand: 'Puma', sizes: ['S','M','L','XL'] },
        { name: 'Zapatillas Runner Pro', desc: 'Zapatillas de running con suela amortiguada de alto rendimiento.', price: 195000, sku: 'ZAP-001', featured: 1, is_new: 0, brand: 'Nike', sizes: ['38','39','40','41','42','43'] },
        { name: 'Buzo Hoodie Signature', desc: 'Buzo con capucha, interior felpa suave. Perfecto para el invierno.', price: 95000, sku: 'BUZ-001', featured: 1, is_new: 1, brand: 'Adidas', sizes: ['S','M','L','XL'] },
        { name: 'Short Deportivo Tech', desc: 'Short deportivo con tecnología DryFit, máxima comodidad.', price: 55000, sku: 'SHO-001', featured: 0, is_new: 0, brand: 'Puma', sizes: ['S','M','L','XL'] },
        { name: 'Zapatillas Clásicas Vans', desc: 'El clásico de siempre, estilo streetwear icónico.', price: 145000, sku: 'ZAP-002', featured: 1, is_new: 0, brand: 'Vans', sizes: ['38','39','40','41','42','43'] },
        { name: 'Remera Manga Larga Trail', desc: 'Remera técnica para actividades al aire libre.', price: 65000, sku: 'REM-002', featured: 0, is_new: 1, brand: 'The North Face', sizes: ['S','M','L','XL'] },
      ];

      for (let i = 0; i < demos.length; i++) {
        const d = demos[i];
        const r = await client.query(
          `INSERT INTO products (name, description, price, brand_id, sku, featured, is_new, active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8) RETURNING id`,
          [d.name, d.desc, d.price, getBrand(d.brand), d.sku, d.featured, d.is_new, i]
        );
        const pid = r.rows[0].id;
        for (let j = 0; j < d.sizes.length; j++) {
          await client.query(
            'INSERT INTO product_sizes (product_id, size, stock, sort_order) VALUES ($1, $2, $3, $4)',
            [pid, d.sizes[j], Math.floor(Math.random() * 15) + 3, j]
          );
        }
      }
      console.log('✓ Productos demo cargados');
    }

    console.log('✓ Base de datos lista');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
