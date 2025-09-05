require('dotenv').config();
const mysql = require('mysql2/promise');

const connectionConfig = process.env.JAWSDB_URL 
  ? {
      uri: process.env.JAWSDB_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'bankApp',
      waitForConnections: true,
      connectionLimit: 10
    };

const pool = mysql.createPool(connectionConfig);
module.exports = pool;