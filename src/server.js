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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

connectDB();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://prototype-to-mvp-frontend.onrender.com',
  credentials: true
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
