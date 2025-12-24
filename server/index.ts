import express, { Express, Request, Response, NextFunction } from 'express';
import auctionRoutes from './routes/auction';
import projectionsRoutes from './routes/projections';
import { closeBrowser } from './services/couchManagersScraper';

export function createServer(): Express {
  const app = express();

  // Middleware - increase JSON body limit for large player lists
  app.use(express.json({ limit: '5mb' }));

  // CORS headers for development
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Auction routes
  app.use('/api/auction', auctionRoutes);

  // Projections routes
  app.use('/api/projections', projectionsRoutes);

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}

// Cleanup on process exit
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await closeBrowser();
  process.exit(0);
});
