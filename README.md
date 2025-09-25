# Face Morphing Installation

An interactive art installation that captures selfies and creates smooth morphing transitions between faces using Luma Dream Machine's AI video generation.

## Features

- 📸 Web-based selfie capture interface
- 🎥 AI-powered face morphing using Luma Dream Machine keyframes
- 🔄 Automatic video loop creation
- 🎭 Projection mapping ready output
- ⚡ Real-time video queue management

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Kiosk/    │────▶│   Backend    │────▶│    Luma     │
│  Web App    │     │   Server     │     │   Dream     │
│             │     │              │     │   Machine   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Video Loop  │
                    │   Display    │
                    └──────────────┘
```

## Setup

### Prerequisites

- Node.js 18+
- PiAPI account for Luma Dream Machine access
- Modern web browser with camera access

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/face-morphing-installation.git
cd face-morphing-installation
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Run development server:
```bash
npm run dev
```

### Production Deployment

```bash
npm run build
npm start
```

## API Integration

This project uses [PiAPI](https://piapi.ai) to access Luma Dream Machine's keyframe functionality. 

### Getting API Access

1. Sign up at [PiAPI](https://piapi.ai)
2. Subscribe to Luma Dream Machine API
3. Get your API key from dashboard
4. Add to `.env` file

## Usage

### For Visitors

1. Stand in front of the kiosk
2. Press "Take Selfie" button
3. Smile! Your photo is captured
4. Watch as your face morphs into others on the display

### For Operators

- Access admin panel at `/admin`
- Monitor queue status
- Clear/reset video loops
- Adjust morphing parameters

## Configuration

### Morphing Settings

Edit `server/config.js` to adjust:
- Transition duration
- Queue size limits
- Video resolution
- Loop behavior

### Display Output

- Supports multiple display modes:
  - Web browser fullscreen
  - HDMI output to projector
  - Network streaming via WebSocket

## Project Structure

```
face-morphing-installation/
├── server/              # Backend API server
│   ├── index.js        # Express server
│   ├── luma.js         # Luma API integration
│   ├── queue.js        # Video queue management
│   └── config.js       # Server configuration
├── public/             # Frontend files
│   ├── index.html      # Selfie capture interface
│   ├── display.html    # Video display page
│   └── admin.html      # Admin panel
├── src/                # Frontend source
│   ├── capture.js      # Camera handling
│   ├── display.js      # Video playback
│   └── styles.css      # UI styles
└── uploads/            # Temporary photo storage
```

## Technical Details

### Face Morphing Process

1. **Capture**: Webcam photo saved as JPEG
2. **Queue**: Added to morphing queue
3. **Keyframe Setup**: Current + previous photo as start/end frames
4. **Generation**: Luma creates 5-second transition
5. **Loop**: Videos combined into seamless loop
6. **Display**: Continuous playback on output

### Performance

- Handles 100+ photos per day
- 5-10 second generation time per transition
- Automatic cleanup of old files
- WebSocket for real-time updates

## Troubleshooting

### Common Issues

- **Camera not working**: Check browser permissions
- **API errors**: Verify PiAPI key and quota
- **Slow generation**: Normal for high-quality mode
- **Display sync issues**: Adjust buffer settings

## License

MIT

## Credits

- Built with Luma Dream Machine AI
- Powered by PiAPI
- Created for interactive art installations