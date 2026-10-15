require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// ==========================================
// Auth middleware
// ==========================================
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

// ==========================================
// Products
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Products');
    res.json(rows);
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM Products';
    let countSql = 'SELECT COUNT(*) AS total FROM Products';
    let params = [];

    if (q) {
      const clause = ' WHERE Name LIKE ? OR Category LIKE ? OR Productcode LIKE ?';
      sql += clause;
      countSql += clause;
      const term = `%${q}%`;
      params = [term, term, term];
    }
    sql += ' LIMIT ? OFFSET ?';

    const [items] = await db.query(sql, [...params, limit, offset]);
    const [totalResult] = await db.query(countSql, params);

    res.json({ items, total: totalResult[0].total, page, limit });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// Only a logged-in admin can create/edit/delete products
app.post('/api/products', verifyToken, requireAdmin, async (req, res) => {
  try {
    const productCode = req.body.Productcode || req.body.productCode || '';
    const name = req.body.Name || req.body.name || '';
    const stock = req.body.Stock ?? req.body.stock ?? 0;
    const category = req.body.Category || req.body.category || '';
    const location = req.body.Location || req.body.location || '';
    const status = req.body.Status || req.body.status || 'Active';
    const image = req.body.Image || req.body.image || '';
    const size = req.body.Size || req.body.size || 'M';
    const price = req.body.Price ?? req.body.price ?? 0;

    const [result] = await db.query(
      `INSERT INTO Products (Productcode, Name, Stock, Category, Location, Status, Image, Size, Price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productCode, name, Number(stock), category, location, status, image, size, Number(price)]
    );
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error('Insert error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/products/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    const productCode = req.body.Productcode || req.body.productCode || '';
    const name = req.body.Name || req.body.name || '';
    const stock = req.body.Stock ?? req.body.stock ?? 0;
    const category = req.body.Category || req.body.category || '';
    const location = req.body.Location || req.body.location || '';
    const status = req.body.Status || req.body.status || 'Active';
    const image = req.body.Image || req.body.image || '';
    const size = req.body.Size || req.body.size || 'M';
    const price = req.body.Price ?? req.body.price ?? 0;

    const [result] = await db.query(
      `UPDATE Products
       SET Productcode = ?, Name = ?, Stock = ?, Category = ?, Location = ?, Status = ?, Image = ?, Size = ?, Price = ?
       WHERE Product_ID = ?`,
      [productCode, name, Number(stock), category, location, status, image, size, Number(price), productId]
    );
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/products/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      'DELETE FROM Products WHERE Product_ID = ? OR Productcode = ?',
      [id, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete product: ' + err.message });
  }
});

// ==========================================
// Nindam Stock — course assignment endpoint.
// Reuses the same db pool and port as everything else above; no separate
// project/.env/port needed for this.
// ==========================================
app.get('/nindam_pro_api', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Nindam_Stock ORDER BY id ASC');
    res.status(200).json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Nindam stock query error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: err.message
    });
  }
});

// ==========================================
// Register — password is hashed before it's stored
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, 'user']
    );

    res.json({ success: true, message: 'User registered successfully', userId: result.insertId });
  } catch (err) {
    console.error('Register error:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to register: ' + err.message });
  }
});

// ==========================================
// Login — compares against the hash and returns a JWT
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id || user.user_id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id || user.user_id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, error: 'Server error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3107;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});