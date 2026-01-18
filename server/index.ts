import 'dotenv/config';
import express from 'express';
import { registerRoutes } from './routes';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    }
  });
  next();
});

// Start server
(async () => {
  try {
    const server = await registerRoutes(app);

    if (process.env.NODE_ENV !== 'production') {
      // Development: use Vite middleware
      const { setupVite } = await import('./vite');
      await setupVite(app, server);
    } else {
      // Production: serve static files
      const { serveStatic } = await import('./vite');
      serveStatic(app);
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    server.listen(port, '0.0.0.0', () => {
      console.log(`[server] Running on port ${port} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
