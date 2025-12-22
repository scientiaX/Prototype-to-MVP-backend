import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/database.js';

import profileRoutes from './routes/profileRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import arenaRoutes from './routes/arenaRoutes.js';
import mentorRoutes from './routes/mentorRoutes.js';
import userDataRoutes from './routes/userDataRoutes.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

connectDB();

app.use(helmet());

// CORS configuration with multiple origins support
const allowedOrigins = [
  'https://prototype-to-mvp-frontend-production.up.railway.app',
  'https://prototype-to-mvp-frontend-staging.up.railway.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

// Add any additional origins from environment variable
if (process.env.CORS_ORIGIN) {
  const envOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
  envOrigins.forEach(origin => {
    if (origin && !allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Prototype to MVP Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      profiles: '/api/profiles',
      problems: '/api/problems',
      arena: '/api/arena',
      mentor: '/api/mentor',
      user: '/api/user'
    }
  });
});

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    message: 'Prototype to MVP Backend API',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/arena', arenaRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/user', userDataRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server for both Express and WebSocket
import { createServer } from 'http';
import { initWebSocketServer } from './services/websocketService.js';

const server = createServer(app);

// Initialize WebSocket
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws/arena`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
