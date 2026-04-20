import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'SportShield AI API' });
});

// Root route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to SportShield AI API', health: '/health' });
});

app.listen(PORT, () => {
    console.log(`🛡️  SportShield API running on http://localhost:${PORT}`);
});

export default app;