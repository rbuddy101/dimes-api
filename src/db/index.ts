import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Parse DATABASE_URL to extract connection details
const DATABASE_URL = process.env.DATABASE_URL || '';

// More flexible regex to handle complex hostnames
const urlParts = DATABASE_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);

if (!urlParts) {
  console.error('DATABASE_URL:', DATABASE_URL);
  throw new Error('Invalid DATABASE_URL format');
}

const [, user, password, hostWithPort, databaseWithParams] = urlParts;

// Split host and port
const hostParts = hostWithPort.match(/(.+):(\d+)/);
if (!hostParts) {
  throw new Error('Invalid host:port format in DATABASE_URL');
}

const [, host, port] = hostParts;
const database = databaseWithParams.split('?')[0]; // Remove query params

// console.log('Connecting to MySQL:', { host, port, user, database });

// Create MySQL connection pool with SSL support
const pool = mysql.createPool({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false // For DigitalOcean managed databases
  }
});

// Create drizzle database instance
export const db = drizzle(pool, { 
  schema,
  mode: 'default'
  // logger: process.env.NODE_ENV === 'development' // Removed SQL logging
});

export default db;