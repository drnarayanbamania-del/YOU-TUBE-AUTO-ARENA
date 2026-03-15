
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper to mock Vercel's response object
function createVercelResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

// Map /api routes to files in /api directory
app.use('/api', async (req, res) => {
  const parts = req.path.split('/').filter(Boolean);
  
  if (parts.length === 0) {
    return res.status(404).json({ error: 'API route not specified' });
  }

  let filePath = '';
  if (parts.length === 1) {
    filePath = path.join(__dirname, 'api', `${parts[0]}.js`);
  } else {
    filePath = path.join(__dirname, 'api', ...parts.slice(0, -1), `${parts[parts.length - 1]}.js`);
  }

  if (fs.existsSync(filePath)) {
    try {
      const { default: handler } = await import(`file://${filePath}?update=${Date.now()}`);
      if (typeof handler === 'function') {
        const vRes = createVercelResponse(res);
        await handler(req, vRes);
      } else {
        res.status(500).json({ error: 'Handler is not a function' });
      }
    } catch (error) {
      console.error(`Error in API handler ${req.path}:`, error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: `API route not found: ${req.path} (searched at ${filePath})` });
  }
});


// Proxy other requests to Vite during development or serve static files
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // Simple redirect for dev
  app.get('/', (req, res) => {
    res.send('API Server is running. Use Vite dev server for frontend.');
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API routes available at http://localhost:${PORT}/api/*`);
});
