// Camera capture and photo upload logic
let stream = null;
let capturedPhoto = null;
let ws = null;

const video = document.getElementById('camera');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const captureBtn = document.getElementById('captureBtn');
const countdown = document.getElementById('countdown');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const retakeBtn = document.getElementById('retakeBtn');
const confirmBtn = document.getElementById('confirmBtn');
const queuePosition = document.getElementById('queuePosition');
const queueCount = document.getElementById('queueCount');
const processingCount = document.getElementById('processingCount');

// Initialize camera
async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 960 },
        facingMode: 'user'
      }
    });
    
    video.srcObject = stream;
    await video.play();
    
    // Set canvas size to match video
    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    });
    
  } catch (error) {
    console.error('Camera error:', error);
    alert('Unable to access camera. Please check permissions.');
  }
}

// Initialize WebSocket connection
function initWebSocket() {
  const wsUrl = `ws://${window.location.host}`;
  ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    // Reconnect after 3 seconds
    setTimeout(initWebSocket, 3000);
  };
}

// Handle WebSocket messages
function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'queue_status':
      updateQueueDisplay(message.data);
      break;
      
    case 'new_photo':
      if (message.data.id === capturedPhoto?.id) {
        queuePosition.textContent = `You're #${message.data.position} in queue`;
      }
      break;
      
    case 'processing_started':
      if (message.data.photoId === capturedPhoto?.id) {
        queuePosition.textContent = 'Creating your morph video...';
      }
      break;
      
    case 'processing_completed':
      if (message.data.photoId === capturedPhoto?.id) {
        queuePosition.textContent = 'Your video is ready! Check the display.';
      }
      break;
      
    case 'processing_error':
      if (message.data.photoId === capturedPhoto?.id) {
        queuePosition.textContent = 'Error processing your photo. Please try again.';
      }
      break;
  }
}

// Update queue display
function updateQueueDisplay(status) {
  queueCount.textContent = status.queueLength;
  processingCount.textContent = status.processing;
}

// Capture photo with countdown
captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  
  // Show countdown
  for (let i = 3; i > 0; i--) {
    countdown.textContent = i;
    countdown.style.display = 'block';
    await sleep(1000);
  }
  
  countdown.style.display = 'none';
  
  // Capture photo
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Convert to blob
  canvas.toBlob((blob) => {
    capturedPhoto = {
      blob,
      url: URL.createObjectURL(blob)
    };
    
    // Show preview
    previewImg.src = capturedPhoto.url;
    preview.classList.add('show');
    
    captureBtn.disabled = false;
  }, 'image/jpeg', 0.9);
});

// Retake photo
retakeBtn.addEventListener('click', () => {
  preview.classList.remove('show');
  if (capturedPhoto?.url) {
    URL.revokeObjectURL(capturedPhoto.url);
  }
  capturedPhoto = null;
  queuePosition.textContent = '';
});

// Confirm and upload photo
confirmBtn.addEventListener('click', async () => {
  if (!capturedPhoto) return;
  
  preview.classList.remove('show');
  confirmBtn.disabled = true;
  
  try {
    const formData = new FormData();
    formData.append('photo', capturedPhoto.blob, 'selfie.jpg');
    
    const response = await fetch('/api/capture', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      capturedPhoto.id = result.photoId;
      queuePosition.textContent = `You're #${result.queuePosition} in queue`;
      
      // Show success feedback
      captureBtn.textContent = 'Take Another';
      
    } else {
      throw new Error(result.error || 'Upload failed');
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    alert('Failed to upload photo. Please try again.');
    
  } finally {
    confirmBtn.disabled = false;
    URL.revokeObjectURL(capturedPhoto.url);
  }
});

// Utility function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch initial status
async function fetchStatus() {
  try {
    const response = await fetch('/api/status');
    const status = await response.json();
    updateQueueDisplay(status.queue);
  } catch (error) {
    console.error('Status fetch error:', error);
  }
}

// Initialize
initCamera();
initWebSocket();
fetchStatus();

// Fetch status periodically
setInterval(fetchStatus, 5000);