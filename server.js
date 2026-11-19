const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// PostgreSQL connection pool (supports Render / DATABASE_URL and SSL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
});

// Helper to compute distance in km (Haversine formula)
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Initialize tables and seed data strictly before listening
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS salons (
        salon_id TEXT PRIMARY KEY,
        salon_name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        branch_id TEXT PRIMARY KEY,
        salon_id TEXT NOT NULL REFERENCES salons(salon_id) ON DELETE CASCADE,
        branch_name TEXT NOT NULL,
        location TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        service_id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
        service_name TEXT NOT NULL,
        price_ugx INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        client_id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        loyalty_points INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        appointment_id TEXT PRIMARY KEY,
        client_id TEXT REFERENCES clients(client_id) ON DELETE SET NULL,
        client_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        branch_id TEXT NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
        service_id TEXT REFERENCES services(service_id) ON DELETE SET NULL,
        service_name TEXT NOT NULL,
        appointment_date TEXT NOT NULL,
        appointment_time TEXT NOT NULL,
        status TEXT DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
        client_name TEXT NOT NULL,
        service_name TEXT NOT NULL,
        amount_ugx INTEGER NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Default salon owner credentials
    await client.query(`
      INSERT INTO salons (salon_id, salon_name, username, password_hash)
      VALUES ('salon-uuid-001', 'Rudi Executive Grooming', 'owner', 'password123')
      ON CONFLICT (salon_id) DO NOTHING;
    `);

    // Seed 50 sister branches (mix of familiar Kampala areas & fictional names)
    await client.query(`
      INSERT INTO branches (branch_id, salon_id, branch_name, location, latitude, longitude) VALUES
      ('branch-001', 'salon-uuid-001', 'Acacia Mall Branch', 'Kololo / Acacia, Kampala', 0.334200, 32.588800),
      ('branch-002', 'salon-uuid-001', 'Garden City Branch', 'Yusuf Lule Rd, Kampala', 0.313600, 32.581200),
      ('branch-003', 'salon-uuid-001', 'Oasis Mall Executive Lounge', 'Kampala Rd, Kampala', 0.315400, 32.583100),
      ('branch-004', 'salon-uuid-001', 'Forest Mall Grooming Studio', 'Lugogo, Kampala', 0.328900, 32.601400),
      ('branch-005', 'salon-uuid-001', 'Village Mall Beauty & Barber', 'Bugolobi, Kampala', 0.317800, 32.615200),
      ('branch-006', 'salon-uuid-001', 'Metroplex Salon & Spa', 'Naalya, Kampala', 0.372500, 32.634800),
      ('branch-007', 'salon-uuid-001', 'Freedom City Styling Hub', 'Entebbe Rd, Kampala', 0.284500, 32.553900),
      ('branch-008', 'salon-uuid-001', 'Africana Executive Cuts', 'Wampewo Ave, Kampala', 0.322800, 32.589500),
      ('branch-009', 'salon-uuid-001', 'Sheraton Wellness & Grooming', 'Ternan Ave, Kampala', 0.319200, 32.586700),
      ('branch-010', 'salon-uuid-001', 'Serena Crown Salon', 'Kintu Rd, Kampala', 0.318100, 32.581900),
      ('branch-011', 'salon-uuid-001', 'Velvet Crown Parlour', 'Nakasero, Kampala', 0.326400, 32.578200),
      ('branch-012', 'salon-uuid-001', 'Golden Scissors Lounge', 'Ntinda, Kampala', 0.351800, 32.613500),
      ('branch-013', 'salon-uuid-001', 'Kireka Prime Fade Bar', 'Kireka, Kampala', 0.347900, 32.652100),
      ('branch-014', 'salon-uuid-001', 'Banda Royal Hair Studio', 'Banda, Kampala', 0.336700, 32.631900),
      ('branch-015', 'salon-uuid-001', 'Kabalagala Glam & Trim', 'Kabalagala, Kampala', 0.304200, 32.602800),
      ('branch-016', 'salon-uuid-001', 'Muyenga Hill Luxury Salon', 'Muyenga, Kampala', 0.295600, 32.616400),
      ('branch-017', 'salon-uuid-001', 'Kansanga Campus Cuts', 'Kansanga, Kampala', 0.291800, 32.605100),
      ('branch-018', 'salon-uuid-001', 'Makindye Crest Grooming', 'Makindye, Kampala', 0.279400, 32.587300),
      ('branch-019', 'salon-uuid-001', 'Nsambya Classic Barber', 'Nsambya, Kampala', 0.298700, 32.589100),
      ('branch-020', 'salon-uuid-001', 'Kibuli Heritage Salon', 'Kibuli, Kampala', 0.305900, 32.594600),
      ('branch-021', 'salon-uuid-001', 'Mengo Royal Crown Studio', 'Mengo, Kampala', 0.306800, 32.564200),
      ('branch-022', 'salon-uuid-001', 'Rubaga Summit Beauty Bar', 'Rubaga, Kampala', 0.309500, 32.551800),
      ('branch-023', 'salon-uuid-001', 'Nateete Hub Clippers', 'Nateete, Kampala', 0.298100, 32.528400),
      ('branch-024', 'salon-uuid-001', 'Kasubi Tombs View Salon', 'Kasubi, Kampala', 0.331200, 32.554900),
      ('branch-025', 'salon-uuid-001', 'Makerere Hill Sharp Cuts', 'Makerere, Kampala', 0.333500, 32.568300),
      ('branch-026', 'salon-uuid-001', 'Wandegeya Express Grooming', 'Wandegeya, Kampala', 0.331800, 32.573600),
      ('branch-027', 'salon-uuid-001', 'Mulago Ridge Hair Lounge', 'Mulago, Kampala', 0.338900, 32.576100),
      ('branch-028', 'salon-uuid-001', 'Kamwokya Modern Fade House', 'Kamwokya, Kampala', 0.341500, 32.587400),
      ('branch-029', 'salon-uuid-001', 'Bukoto Street Styling Loft', 'Bukoto, Kampala', 0.346200, 32.596800),
      ('branch-030', 'salon-uuid-001', 'Kisaasi Green Beauty Hub', 'Kisaasi, Kampala', 0.375400, 32.604200),
      ('branch-031', 'salon-uuid-001', 'Kyanja Oasis Grooming', 'Kyanja, Kampala', 0.384900, 32.608700),
      ('branch-032', 'salon-uuid-001', 'Komamboga Crest Salon', 'Komamboga, Kampala', 0.391200, 32.617300),
      ('branch-033', 'salon-uuid-001', 'Bweyogerere Junction Cuts', 'Bweyogerere, Wakiso', 0.354100, 32.664800),
      ('branch-034', 'salon-uuid-001', 'Namugongo Shrine View Salon', 'Namugongo, Wakiso', 0.388600, 32.659200),
      ('branch-035', 'salon-uuid-001', 'Kiira Town Elegance Studio', 'Kiira, Wakiso', 0.392800, 32.638500),
      ('branch-036', 'salon-uuid-001', 'Kira Road Silk & Fade', 'Kira Rd, Kampala', 0.335600, 32.582400),
      ('branch-037', 'salon-uuid-001', 'Jinja Road Executive Parlour', 'Jinja Rd, Kampala', 0.321900, 32.594100),
      ('branch-038', 'salon-uuid-001', 'Nakasero Heights Lounge', 'Hill Ln, Kampala', 0.324700, 32.584600),
      ('branch-039', 'salon-uuid-001', 'Kololo Terrace Beauty Bar', 'Akii Bua Rd, Kampala', 0.331900, 32.593200),
      ('branch-040', 'salon-uuid-001', 'Naguru Summit Grooming Club', 'Naguru, Kampala', 0.336400, 32.606800),
      ('branch-041', 'salon-uuid-001', 'Luzira Port Bell Hair Studio', 'Luzira, Kampala', 0.303400, 32.643700),
      ('branch-042', 'salon-uuid-001', 'Mutungo Hill Crown Salon', 'Mutungo, Kampala', 0.312700, 32.636200),
      ('branch-043', 'salon-uuid-001', 'Kitintale Link Barber Lounge', 'Kitintale, Kampala', 0.314900, 32.625800),
      ('branch-044', 'salon-uuid-001', 'Namuwongo Park Styling Hub', 'Namuwongo, Kampala', 0.301500, 32.607900),
      ('branch-045', 'salon-uuid-001', 'Gaba Beachfront Grooming', 'Gaba, Kampala', 0.268900, 32.637100),
      ('branch-046', 'salon-uuid-001', 'Munyonyo Lakeview Salon', 'Munyonyo, Kampala', 0.246200, 32.614500),
      ('branch-047', 'salon-uuid-001', 'Salaama Road Trend Cuts', 'Salaama Rd, Kampala', 0.281600, 32.573400),
      ('branch-048', 'salon-uuid-001', 'Lungujja West Beauty Studio', 'Lungujja, Kampala', 0.311400, 32.536900),
      ('branch-049', 'salon-uuid-001', 'Nansana Highway Fade Bar', 'Nansana, Wakiso', 0.365200, 32.527800),
      ('branch-050', 'salon-uuid-001', 'Kawempe North Crown Parlour', 'Kawempe, Kampala', 0.363800, 32.559400)
      ON CONFLICT (branch_id) DO NOTHING;
    `);

    // Seed default services if empty
    const serviceCheck = await client.query('SELECT COUNT(*) FROM services');
    if (parseInt(serviceCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO services (service_id, branch_id, service_name, price_ugx) VALUES
        ('serv-01', 'branch-001', 'Executive Haircut & Styling', 35000),
        ('serv-02', 'branch-001', 'Beard Grooming & Trim', 15000),
        ('serv-03', 'branch-001', 'Hair Treatment & Wash', 50000),
        ('serv-04', 'branch-002', 'Executive Haircut & Styling', 35000),
        ('serv-05', 'branch-002', 'Beard Grooming & Trim', 15000)
        ON CONFLICT (service_id) DO NOTHING;
      `);
    }

    // Seed sample client if empty
    await client.query(`
      INSERT INTO clients (client_id, full_name, phone, email, loyalty_points)
      VALUES ('client-001', 'Alex Mukasa', '+256700000000', 'alex@example.com', 120)
      ON CONFLICT (client_id) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('Database initialized and seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database initialization error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Root & Health Routes
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Rudi Salon Backend API',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/v1/branches',
      '/api/v1/branches/nearby',
      '/api/v1/services',
      '/api/v1/appointments',
      '/api/v1/owner/login',
    ],
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// Owner Login
app.post('/api/v1/owner/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT salon_id, salon_name, username FROM salons WHERE username = $1 AND password_hash = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({
      success: true,
      salon: result.rows[0],
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// All Branches
app.get('/api/v1/branches', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM branches ORDER BY branch_id ASC');
    res.json({ branches: result.rows, data: result.rows });
  } catch (err) {
    console.error('Error fetching branches:', err);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// Nearby Branches (?lat=...&lng=...&limit=10)
app.get('/api/v1/branches/nearby', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const limit = parseInt(req.query.limit || '15', 10);

  try {
    const result = await pool.query('SELECT * FROM branches ORDER BY branch_id ASC');
    let branches = result.rows;

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      branches = branches
        .map((b) => ({
          ...b,
          distance_km: Number(haversineKm(lat, lng, b.latitude, b.longitude).toFixed(2)),
        }))
        .sort((a, b) => a.distance_km - b.distance_km);
    }

    res.json({ branches: branches.slice(0, limit), data: branches.slice(0, limit) });
  } catch (err) {
    console.error('Error fetching nearby branches:', err);
    res.status(500).json({ error: 'Failed to fetch nearby branches' });
  }
});

// Services (optional ?branch_id=...)
app.get('/api/v1/services', async (req, res) => {
  const { branch_id } = req.query;
  try {
    const result = branch_id
      ? await pool.query('SELECT * FROM services WHERE branch_id = $1 ORDER BY service_id ASC', [branch_id])
      : await pool.query('SELECT * FROM services ORDER BY service_id ASC');
    res.json({ services: result.rows, data: result.rows });
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Appointments List & Create
app.get('/api/v1/appointments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM appointments ORDER BY created_at DESC');
    res.json({ appointments: result.rows, data: result.rows });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.post('/api/v1/appointments', async (req, res) => {
  const {
    client_name,
    phone,
    branch_id,
    service_id,
    service_name,
    appointment_date,
    appointment_time,
  } = req.body || {};

  if (!client_name || !phone || !branch_id || !service_name || !appointment_date || !appointment_time) {
    return res.status(400).json({ error: 'Missing required appointment fields' });
  }

  const appointmentId = `appt-${Date.now()}`;
  try {
    const result = await pool.query(
      `INSERT INTO appointments
        (appointment_id, client_name, phone, branch_id, service_id, service_name, appointment_date, appointment_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')
       RETURNING *`,
      [
        appointmentId,
        client_name,
        phone,
        branch_id,
        service_id || null,
        service_name,
        appointment_date,
        appointment_time,
      ]
    );
    res.status(201).json({ appointment: result.rows[0], data: result.rows[0] });
  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Transactions List & Create
app.get('/api/v1/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
    res.json({ transactions: result.rows, data: result.rows });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/v1/transactions', async (req, res) => {
  const { branch_id, client_name, service_name, amount_ugx, payment_method } = req.body || {};
  if (!branch_id || !client_name || !service_name || amount_ugx === undefined) {
    return res.status(400).json({ error: 'Missing required transaction fields' });
  }

  const transactionId = `txn-${Date.now()}`;
  try {
    const result = await pool.query(
      `INSERT INTO transactions
        (transaction_id, branch_id, client_name, service_name, amount_ugx, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [transactionId, branch_id, client_name, service_name, Number(amount_ugx), payment_method || 'cash']
    );
    res.status(201).json({ transaction: result.rows[0], data: result.rows[0] });
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ error: 'Failed to record transaction' });
  }
});

// Start server only after DB tables & seeds are ready
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Rudi backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server due to DB init error:', err);
    process.exit(1);
  });