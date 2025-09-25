// Video display and loop playback
const videoDisplay = document.getElementById('videoDisplay');
const noVideo = document.getElementById('noVideo');
const overlay = document.getElementById('overlay');
const status = document.getElementById('status');
const videoCount = document.getElementById('videoCount');
const loopVersion = document.getElementById('loopVersion');

let ws = null;
let currentLoopPath = null;
let reconnectAttempts = 0;

// Show/hide overlay with keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'i' || e.key === 'I') {
    overlay.classList.toggle('show');
  }
  
  // Fullscreen with F key
  if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  }
});

// Toggle fullscreen
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Fullscreen error:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// Initialize WebSocket connection
function initWebSocket() {
  const wsUrl = `ws://${window.location.host}`;
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    status.textContent = 'Connected';
    reconnectAttempts = 0;
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    status.textContent = 'Connection error';
  };
  
  ws.onclose = () => {
    status.textContent = 'Disconnected';
    reconnectAttempts++;
    
    // Exponential backoff for reconnection
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    setTimeout(initWebSocket, delay);
  };
}

// Handle WebSocket messages
function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'queue_status':
      updateStatus(message.data);
      break;
      
    case 'loop_updated':
      loadNewLoop(message.data.loopPath);
      break;
      
    case 'processing_completed':
      console.log('New video added to loop:', message.data.photoId);
      break;
      
    case 'system_cleared':
      clearDisplay();
      break;
  }
}

// Update status display
function updateStatus(queueStatus) {
  if (overlay.classList.contains('show')) {
    videoCount.textContent = queueStatus.completed || 0;
  }
}

// Load new loop video
function loadNewLoop(path) {
  if (path && path !== currentLoopPath) {
    currentLoopPath = path;
    
    // Update version number
    const versionMatch = path.match(/loop-v(\d+)/);
    if (versionMatch) {
      loopVersion.textContent = versionMatch[1];
    }
    
    // Load video with smooth transition
    const newVideo = document.createElement('video');
    newVideo.src = path;
    newVideo.loop = true;
    newVideo.muted = true;
    newVideo.autoplay = true;
    
    newVideo.oncanplay = () => {
      // Hide no video message
      noVideo.style.display = 'none';
      
      // Smooth transition to new video
      videoDisplay.style.opacity = '0';
      
      setTimeout(() => {
        videoDisplay.src = path;
        videoDisplay.play();
        videoDisplay.style.opacity = '1';
      }, 300);
    };
    
    newVideo.onerror = () => {
      console.error('Failed to load video:', path);
    };
  }
}

// Clear display
function clearDisplay() {
  videoDisplay.src = '';
  currentLoopPath = null;
  noVideo.style.display = 'block';
  videoCount.textContent = '0';
  loopVersion.textContent = '0';
}

// Fetch current loop on load
async function fetchCurrentLoop() {
  try {
    const response = await fetch('/api/loop/current');
    
    if (response.ok) {
      const data = await response.json();
      if (data.loopPath) {
        loadNewLoop(data.loopPath);
      }
    }
  } catch (error) {
    console.error('Failed to fetch current loop:', error);
  }
}

// Video display styling for smooth transitions
videoDisplay.style.transition = 'opacity 0.3s ease-in-out';

// Ensure video keeps playing
videoDisplay.addEventListener('ended', () => {
  videoDisplay.play();
});

// Handle video errors
videoDisplay.addEventListener('error', (e) => {
  console.error('Video playback error:', e);
  // Try to reload after a delay
  setTimeout(() => {
    if (currentLoopPath) {
      videoDisplay.src = currentLoopPath;
      videoDisplay.play();
    }
  }, 3000);
});

// Initialize
initWebSocket();
fetchCurrentLoop();

// Periodic status check
setInterval(async () => {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    updateStatus(data.queue);
  } catch (error) {
    console.error('Status check error:', error);
  }
}, 10000);

// Auto-fullscreen after 30 seconds of inactivity
let inactivityTimer;
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (!document.fullscreenElement) {
      toggleFullscreen();
    }
  }, 30000);
}

document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keydown', resetInactivityTimer);
resetInactivityTimer();