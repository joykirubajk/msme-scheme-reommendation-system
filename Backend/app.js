import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import schemeRoutes from './routes/schemes.js';
import businessProfileRoutes from './routes/businessProfile.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Comma-separated list in CORS_ORIGINS; defaults cover CRA (:3000), Vite (:5173) and the deployed site.
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  'http://localhost:3000,http://localhost:5173,https://msme-scheme-recommender-systems.vercel.app'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

//Middleware
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/business-profile', businessProfileRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
