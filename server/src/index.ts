import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  PlayerManager,
  SessionManager,
  SkillManager,
  ItemManager,
  GuildManager,
} from './game/index.js';
import { SocketHandlers } from './socket/handlers.js';
import { connectRedis, disconnectRedis, getRedis, RedisStore } from './redis/client.js';
import { PubSubManager } from './redis/pubsub.js';

const PORT = process.env.PORT || 3001;

async function main() {
  // Initialize Express
  const app = express();
  app.use(cors());
  app.use(express.json());

  const httpServer = createServer(app);

  // Initialize Socket.io
  const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Try to connect to Redis (optional)
  const redisConnected = await connectRedis();
  const redis = getRedis();
  const redisStore = redis ? new RedisStore(redis) : null;
  const pubsub = new PubSubManager(redis);

  if (redisConnected) {
    await pubsub.initialize();
    console.log('Redis connected and PubSub initialized');
  } else {
    console.log('Running without Redis - data will not persist');
  }

  // Initialize game managers
  const playerManager = new PlayerManager();
  const guildManager = new GuildManager(playerManager);
  const sessionManager = new SessionManager(playerManager, guildManager);

  // Start first session
  const session = sessionManager.startNewSession();
  console.log(`Session started: ${session.id}`);

  const gameMap = sessionManager.getGameMap()!;
  const skillManager = new SkillManager(gameMap, playerManager);
  const itemManager = new ItemManager(playerManager);

  // Initialize socket handlers
  const socketHandlers = new SocketHandlers(
    io,
    playerManager,
    sessionManager,
    skillManager,
    itemManager,
    guildManager
  );

  socketHandlers.setupSessionCallbacks();

  // Socket connection handling
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socketHandlers.setupSocketHandlers(socket);
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      session: sessionManager.getSession(),
      players: playerManager.getPlayerCount(),
      redis: redisConnected,
    });
  });

  // API endpoints
  app.get('/api/session', (_req, res) => {
    res.json(sessionManager.getSession());
  });

  app.get('/api/leaderboard', (_req, res) => {
    const players = playerManager.getLeaderboard(100);
    res.json(players.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      score: p.score,
      cellsRevealed: p.stats.cellsRevealed,
    })));
  });

  app.get('/api/guilds', (_req, res) => {
    res.json(guildManager.getAllGuilds());
  });

  // Start server
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Map size: ${session.mapWidth}x${session.mapHeight}`);
    console.log(`💣 Total mines: ${session.totalMines}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    socketHandlers.cleanup();
    await disconnectRedis();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    socketHandlers.cleanup();
    await disconnectRedis();
    process.exit(0);
  });
}

main().catch(console.error);
