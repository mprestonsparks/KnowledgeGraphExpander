import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

console.log('Starting FastAPI server...');
// Start FastAPI server
const pythonProcess = spawn('python', ['-m', 'uvicorn', 'server.app:app', '--host', '0.0.0.0', '--port', '8000']);

pythonProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`FastAPI: ${output}`);
});

pythonProcess.stderr.on('data', (data) => {
  console.error(`FastAPI Error: ${data}`);
});

pythonProcess.on('error', (error) => {
  console.error('Failed to start FastAPI server:', error);
});

// Wait for FastAPI server to be ready
console.log('Waiting for FastAPI server to start...');
const waitForFastAPI = new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => {
    console.warn('FastAPI server startup timeout - proceeding with Express startup');
    resolve(); // Resolve anyway to allow Express to start
  }, 15000); // 15 second timeout

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Application startup complete')) {
      console.log('FastAPI server startup detected');
      clearTimeout(timeout);
      resolve();
    }
  });
});

// Proxy middleware configuration
const proxyConfig = {
  target: 'http://localhost:8000',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '', // Remove /api prefix when forwarding to FastAPI
  },
  onProxyReq: (proxyReq: any, req: Request) => {
    console.log(`Proxying ${req.method} ${req.path} to FastAPI`);
  },
  onProxyRes: (proxyRes: any, req: Request) => {
    console.log(`Received FastAPI response for ${req.method} ${req.path}: ${proxyRes.statusCode}`);
  },
  onError: (err: Error, req: Request, res: Response) => {
    console.error('Proxy error:', err);
    res.status(503).json({ error: 'Graph analysis service temporarily unavailable' });
  }
};

// Add root route handler
app.get('/', (req: Request, res: Response) => {
  res.send({ message: "Knowledge Graph API Server" });
});

// Use proxy for all /api routes
app.use('/api', createProxyMiddleware(proxyConfig));

// Handle /graph route specifically
app.use('/graph', createProxyMiddleware({
  ...proxyConfig,
  pathRewrite: {
    '^/graph': '/graph', // Direct mapping for /graph endpoints
  }
}));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Capture JSON responses for logging
  const originalJson = res.json;
  res.json = function(body) {
    const jsonResponse = body;
    res.json = originalJson;
    return originalJson.call(this, body);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path.startsWith("/graph")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  try {
    console.log('Starting application setup...');

    // Wait for FastAPI but don't block forever
    await Promise.race([
      waitForFastAPI,
      new Promise(resolve => setTimeout(resolve, 15000))
    ]);

    console.log('Configuring Express server...');
    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('Express error:', err);
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start Express server
    const port = 5000;
    console.log(`Starting Express server on port ${port}...`);

    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log(`Express server running on port ${port}`);
      log(`Express server running on port ${port}`);
    });

    // Cleanup handlers
    process.on('exit', () => {
      console.log('Shutting down servers...');
      pythonProcess.kill();
    });

    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down servers...');
      pythonProcess.kill();
      process.exit();
    });

  } catch (error) {
    console.error('Failed to start servers:', error);
    process.exit(1);
  }
})();