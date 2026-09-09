import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import passport from 'passport';
import mongoose from 'mongoose';

import { connectDB, disconnectDB } from './config/db.js';
import { assertJwtConfig, verifyAccessToken } from './config/jwt.js';
import './config/passport.js';
import User from './models/User.js';
import CaseSheet from './models/CaseSheet.js';
import authRoutes from './routes/authRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import kbRoutes from './routes/kbRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import ambulanceRoutes from './routes/ambulanceRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
};

const app = express();

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.use((req, _res, next) => {
  if (NODE_ENV !== 'test') console.log(`[api] ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sudha-setu-api', env: NODE_ENV, uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ambulance', ambulanceRoutes);
app.use('/api/ai', aiRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({
    message: status >= 500 && NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(NODE_ENV === 'production' ? {} : { stack: err.stack }),
  });
});

const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

app.set('io', io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) return next(new Error('Authentication required'));

    socket.user = user;
    next();
  } catch {
    next(new Error('Authentication required'));
  }
});

io.on('connection', (socket) => {
  console.log(`[socket] connected ${socket.id} (${socket.user.role})`);

  socket.on('doctors:join', () => {
    if (['doctor', 'support', 'admin'].includes(socket.user.role)) {
      socket.join('doctors');
    } else {
      socket.emit('error', { message: 'Not authorized to join the doctors room' });
    }
  });

  socket.on('support:join', () => {
    if (['support', 'admin'].includes(socket.user.role)) {
      socket.join('support');
    } else {
      socket.emit('error', { message: 'Not authorized to join the support room' });
    }
  });

  socket.on('ambulance:join', () => {
    if (['ambulance', 'admin'].includes(socket.user.role)) {
      socket.join('ambulance');
    } else {
      socket.emit('error', { message: 'Not authorized to join the ambulance room' });
    }
  });

  socket.on('case:join', async (caseId) => {
    try {
      if (typeof caseId !== 'string' || !mongoose.isValidObjectId(caseId)) {
        return socket.emit('error', { message: 'Invalid case id' });
      }

      const caseSheet = await CaseSheet.findById(caseId).select('patientId');
      const canAccessCase =
        caseSheet &&
        (String(caseSheet.patientId) === String(socket.user._id) ||
          ['doctor', 'support', 'admin'].includes(socket.user.role));

      if (!canAccessCase) {
        return socket.emit('error', { message: 'Not authorized to join this case room' });
      }

      socket.join(`case:${caseId}`);
    } catch {
      socket.emit('error', { message: 'Unable to access this case' });
    }
  });

  socket.on('case:leave', (caseId) => {
    if (typeof caseId === 'string' && caseId) socket.leave(`case:${caseId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected ${socket.id} (${reason})`);
  });
});

const start = async () => {
  try {
    
    assertJwtConfig();
    await connectDB();
    server.listen(PORT, () => {
      console.log(`[api] Sudha Setu listening on :${PORT} (${NODE_ENV})`);
    });
  } catch (err) {
    console.error('[api] startup failed:', err.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`[api] ${signal} received, shutting down`);
  io.close();
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandled rejection:', reason);
});

start();

export { app, server };
