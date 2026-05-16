require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const migrate = require('./src/migrate');
const { initMinio } = require('./src/config/minio');
const authRouter = require('./src/routes/auth');
const usersRouter = require('./src/routes/users');
const messagesRouter = require('./src/routes/messages');
const uploadRouter = require('./src/routes/upload');
const proxyRouter = require('./src/routes/proxy');
const registerChatHandlers = require('./src/socket/chatHandler');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost,http://localhost:5173').split(',');

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB — needed for PDF/image payloads
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/proxy', proxyRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

registerChatHandlers(io);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

migrate()
  .then(() => initMinio())
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 ChitChat backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
