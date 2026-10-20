import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { connectDB } from './config/db.js';
import { seedInitialData } from './seed/demoData.js';
import { initializeBattleSocket } from './socket/battleSocket.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import importRoutes from './routes/importRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import testRoutes from './routes/testRoutes.js';
import revisionRoutes from './routes/revisionRoutes.js';
import socialRoutes from './routes/socialRoutes.js';
import examRoutes from './routes/examRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import docToTestRoutes from './routes/docToTestRoutes.js';
import taxonomyRoutes from './routes/taxonomyRoutes.js';
import savedTestRoutes from './routes/savedTestRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: fs.existsSync('./server/.env') ? './server/.env' : './.env' });

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Uploads Serving
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/import', importRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai/doc-to-test', docToTestRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/revision', revisionRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/taxonomy', taxonomyRoutes);
app.use('/api', taxonomyRoutes);
app.use('/api/saved-tests', savedTestRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    geminiKeyConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')
  });
});

// Initialize Realtime Socket.io Multiplayer Engine
initializeBattleSocket(io);

// Production Static Frontend Serving
if (process.env.NODE_ENV === 'production') {
  const possiblePaths = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(process.cwd(), 'client', 'dist'),
    path.resolve(process.cwd(), '../client/dist')
  ];
  const clientDistPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];

  console.log(`[Production Serving] Serving static frontend from: ${clientDistPath}`);

  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend static assets build missing');
    }
  });
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`  EXAMIQ AI COMPETITIVE EXAM PLATFORM BACKEND STARTED`);
  console.log(`  REST API Server: http://localhost:${PORT}/api/health`);
  console.log(`  Realtime Battle Socket Gateway Active`);
  console.log(`======================================================\n`);

  await connectDB();
  await seedInitialData();
});
