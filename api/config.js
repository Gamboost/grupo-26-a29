const mysql = require('mysql2/promise');

const {
  MYSQL_HOST,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE,
  MYSQL_PORT,
  MYSQL_CONTACTS_TABLE,
  ADMIN_USERNAME: ENV_ADMIN_USERNAME,
  ADMIN_PASSWORD: ENV_ADMIN_PASSWORD,
} = process.env;

const TABLE_NAME = MYSQL_CONTACTS_TABLE || 'site_contacts';
const MAX_CONTACTS = parseInt(process.env.MAX_CONTACTS || '10', 10);

let pool;
let tableEnsured = false;

function ensureEnv(res) {
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
    res.status(500).json({ error: 'Configuracion de MySQL incompleta en las variables de entorno.' });
    return false;
  }
  if (!ENV_ADMIN_USERNAME || !ENV_ADMIN_PASSWORD) {
    res.status(500).json({ error: 'Configura ADMIN_USERNAME y ADMIN_PASSWORD en las variables de entorno.' });
    return false;
  }
  return true;
}

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      port: MYSQL_PORT ? Number(MYSQL_PORT) : 3306,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0,
    });
  }
  return pool;
}

async function ensureTable(connection) {
  if (tableEnsured) {
    return;
  }
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      site_prefix VARCHAR(191) NOT NULL,
      payload JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (site_prefix)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
  tableEnsured = true;
}

function parseBasicAuth(header) {
  if (!header || typeof header !== 'string') {
    return null;
  }
  if (!header.startsWith('Basic ')) {
    return null;
  }
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString();
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      return null;
    }
    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return { username, password };
  } catch (error) {
    return null;
  }
}

function isAuthorized(req) {
  const credentials = parseBasicAuth(req.headers.authorization || req.headers.Authorization);
  if (!credentials) {
    return false;
  }
  return credentials.username === ENV_ADMIN_USERNAME && credentials.password === ENV_ADMIN_PASSWORD;
}

function slugify(value) {
  if (value === undefined || value === null) {
    return '';
  }
  let output = String(value).toLowerCase();
  if (typeof output.normalize === 'function') {
    output = output.normalize('NFD');
  }
  output = output.replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return output;
}

function normalizeContacts(list = []) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((contact) => {
      if (!contact) {
        return null;
      }
      const label = contact.label || contact.name || 'Contacto';
      const phoneRaw = contact.phone || contact.number || '';
      const phone = String(phoneRaw).replace(/\D+/g, '');
      if (!phone) {
        return null;
      }
      const display = contact.display || contact.displayName || '';
      return {
        label: String(label).trim() || 'Contacto',
        phone,
        display: String(display || '').trim(),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_CONTACTS);
}

function resolvePrefix(req, bodyPrefix) {
  const query = req.query || {};
  let prefix =
    bodyPrefix ||
    query.prefix ||
    query.site ||
    query.id ||
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    'default';

  if (Array.isArray(prefix)) {
    prefix = prefix[0];
  }

  const slug = slugify(prefix);
  return slug || 'default';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!ensureEnv(res)) {
    return;
  }

  const poolConnection = await getPool();
  await ensureTable(poolConnection);

  if (req.method === 'GET') {
    try {
      const prefix = resolvePrefix(req);
      const [rows] = await poolConnection.query(
        `SELECT payload FROM \`${TABLE_NAME}\` WHERE site_prefix = ? LIMIT 1`,
        [prefix]
      );

      if (!rows || rows.length === 0) {
        res.status(404).json({ error: 'Configuracion no encontrada' });
        return;
      }

      const row = rows[0];
      const payload =
        typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;

      res.status(200).json({
        messageTemplate: payload.messageTemplate || '',
        contacts: normalizeContacts(payload.contacts || []),
      });
    } catch (error) {
      console.error('Error al obtener configuracion:', error);
      res.status(500).json({ error: 'Error interno al recuperar la configuracion.' });
    }
    return;
  }

  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body || '{}');
      }
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Cuerpo de solicitud invalido.' });
        return;
      }

      const messageTemplate =
        typeof body.messageTemplate === 'string' ? body.messageTemplate.trim() : '';
      const contacts = normalizeContacts(body.contacts);
      if (!contacts.length) {
        res.status(400).json({ error: 'Se requiere al menos un numero valido.' });
        return;
      }

      const prefix = resolvePrefix(req, body.prefix);
      const payload = JSON.stringify({
        messageTemplate,
        contacts,
      });

      await poolConnection.query(
        `INSERT INTO \`${TABLE_NAME}\` (site_prefix, payload) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP`,
        [prefix, payload]
      );

      res.status(200).json({
        messageTemplate,
        contacts,
      });
    } catch (error) {
      console.error('Error al guardar configuracion:', error);
      res.status(500).json({ error: 'Error interno al guardar la configuracion.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET,POST,OPTIONS');
  res.status(405).json({ error: 'Metodo no permitido.' });
};
