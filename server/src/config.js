import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'one_shot_mahjong',
    // Hosted MySQL providers usually require TLS: set DB_SSL=true
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {}),
  },
};
