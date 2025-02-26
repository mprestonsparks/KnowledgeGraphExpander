import express from 'express';
import { registerRoutes } from './routes';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize routes and websocket server
const server = await registerRoutes(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log('WebSocket server ready for connections');
});