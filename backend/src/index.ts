import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import './config/redis'; // initialize Redis connection on startup

import checkRouter from './routes/check';
import sourcesRouter from './routes/sources';
import {
    checkLimiter,
    sourcesLimiter,
} from './middleware/rateLimiter';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('dev'));

// Root route
app.get('/', (req, res) => {
    res.json({
        service: 'SportShield AI API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: 'GET /health',
            check: 'POST /api/v1/check',
            sources: 'GET /api/v1/sources',
        },
    });
});

// Health check (no rate limit)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'SportShield AI API' });
});

// Routes with rate limiters
app.use('/api/v1/check', checkLimiter, checkRouter);

// Routes — fully wired
app.use('/api/v1/sources', sourcesLimiter, sourcesRouter);

app.listen(PORT, () => {
    console.log(`🛡️  SportShield API running on http://localhost:${PORT}`);
});

export default app;