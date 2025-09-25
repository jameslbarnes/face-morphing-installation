import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { LumaService } from './luma.js';
import { QueueManager } from './queue.js';
import { VideoLooper } from './looper.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize services
const lumaService = new LumaService(process.env.PIAPI_API_KEY);
const queueManager = new QueueManager();
const videoLooper = new VideoLooper();

// Setup upload directories
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const VIDEO_DIR = path.join(__dirname, '..', 'videos');

async function ensureDirectories() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(VIDEO_DIR, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const uniqueName = `selfie-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/videos', express.static(VIDEO_DIR));

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New WebSocket client connected');
  
  // Send current queue status
  ws.send(JSON.stringify({
    type: 'queue_status',
    data: queueManager.getStatus()
  }));
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

// Broadcast to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

// Routes
app.post('/api/capture', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }
    
    const photoPath = req.file.path;
    const photoId = path.basename(photoPath, '.jpg');
    
    // Add to queue
    const queueItem = await queueManager.addToQueue({
      id: photoId,
      photoPath,
      timestamp: Date.now()
    });
    
    // Process morphing with previous photo
    processMorphing(queueItem);
    
    // Broadcast update
    broadcast({
      type: 'new_photo',
      data: { id: photoId, position: queueManager.getPosition(photoId) }
    });
    
    res.json({
      success: true,
      photoId,
      queuePosition: queueManager.getPosition(photoId)
    });
    
  } catch (error) {
    console.error('Capture error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process morphing between photos
async function processMorphing(currentItem) {
  try {
    const previousItem = queueManager.getPrevious(currentItem.id);
    
    if (!previousItem) {
      console.log('First photo in queue, waiting for next one');
      return;
    }
    
    console.log(`Creating morph: ${previousItem.id} -> ${currentItem.id}`);
    
    // Generate video with Luma
    const videoId = await lumaService.generateMorphVideo(
      previousItem.photoPath,
      currentItem.photoPath
    );
    
    // Update queue status
    queueManager.updateStatus(currentItem.id, 'processing', { videoId });
    
    broadcast({
      type: 'processing_started',
      data: { photoId: currentItem.id, videoId }
    });
    
    // Poll for completion
    pollVideoStatus(videoId, currentItem.id);
    
  } catch (error) {
    console.error('Morphing error:', error);
    queueManager.updateStatus(currentItem.id, 'error', { error: error.message });
    
    broadcast({
      type: 'processing_error',
      data: { photoId: currentItem.id, error: error.message }
    });
  }
}

// Poll Luma for video status
async function pollVideoStatus(videoId, photoId) {
  const checkStatus = async () => {
    try {
      const status = await lumaService.getVideoStatus(videoId);
      
      if (status.state === 'completed') {
        const videoPath = path.join(VIDEO_DIR, `${photoId}.mp4`);
        await lumaService.downloadVideo(status.video_url, videoPath);
        
        // Add to loop
        videoLooper.addVideo(videoPath);
        
        // Update queue
        queueManager.updateStatus(photoId, 'completed', { videoPath });
        
        broadcast({
          type: 'processing_completed',
          data: { photoId, videoPath: `/videos/${photoId}.mp4` }
        });
        
        // Update main display loop
        updateDisplayLoop();
        
      } else if (status.state === 'failed') {
        throw new Error(status.failure_reason || 'Video generation failed');
        
      } else {
        // Still processing, check again
        setTimeout(checkStatus, 3000);
      }
      
    } catch (error) {
      console.error('Status check error:', error);
      queueManager.updateStatus(photoId, 'error', { error: error.message });
      
      broadcast({
        type: 'processing_error',
        data: { photoId, error: error.message }
      });
    }
  };
  
  checkStatus();
}

// Update the main display loop
async function updateDisplayLoop() {
  try {
    const loopPath = await videoLooper.createLoop();
    
    broadcast({
      type: 'loop_updated',
      data: { loopPath: `/videos/${path.basename(loopPath)}` }
    });
    
  } catch (error) {
    console.error('Loop update error:', error);
  }
}

// API status endpoints
app.get('/api/status', (req, res) => {
  res.json({
    queue: queueManager.getStatus(),
    loop: videoLooper.getStatus()
  });
});

app.get('/api/queue', (req, res) => {
  res.json(queueManager.getQueue());
});

app.get('/api/loop/current', (req, res) => {
  const loopPath = videoLooper.getCurrentLoop();
  if (loopPath) {
    res.json({ loopPath: `/videos/${path.basename(loopPath)}` });
  } else {
    res.status(404).json({ error: 'No loop available' });
  }
});

// Admin endpoints
app.post('/api/admin/clear', async (req, res) => {
  try {
    queueManager.clear();
    videoLooper.clear();
    
    // Clean up files
    const uploads = await fs.readdir(UPLOAD_DIR);
    const videos = await fs.readdir(VIDEO_DIR);
    
    await Promise.all([
      ...uploads.map(file => fs.unlink(path.join(UPLOAD_DIR, file))),
      ...videos.map(file => fs.unlink(path.join(VIDEO_DIR, file)))
    ]);
    
    broadcast({ type: 'system_cleared' });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook for Luma callbacks (if using webhooks)
app.post('/webhook/luma', (req, res) => {
  const { videoId, state, video_url } = req.body;
  console.log('Luma webhook:', { videoId, state });
  
  // Handle webhook data if configured
  res.json({ received: true });
});

// Start server
async function start() {
  await ensureDirectories();
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server ready`);
  });
}

start().catch(console.error);