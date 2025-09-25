import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class VideoLooper {
  constructor() {
    this.videos = [];
    this.currentLoop = null;
    this.loopVersion = 0;
  }
  
  addVideo(videoPath) {
    this.videos.push({
      path: videoPath,
      addedAt: Date.now()
    });
    
    // Keep max 20 videos in rotation
    if (this.videos.length > 20) {
      this.videos.shift();
    }
  }
  
  async createLoop() {
    if (this.videos.length === 0) {
      throw new Error('No videos to loop');
    }
    
    this.loopVersion++;
    const outputPath = path.join(
      path.dirname(this.videos[0].path),
      `loop-v${this.loopVersion}.mp4`
    );
    
    try {
      if (this.videos.length === 1) {
        // Single video - just copy it
        await fs.copyFile(this.videos[0].path, outputPath);
      } else {
        // Multiple videos - concatenate with ffmpeg
        await this.concatenateVideos(outputPath);
      }
      
      // Clean up old loop
      if (this.currentLoop && this.currentLoop !== outputPath) {
        try {
          await fs.unlink(this.currentLoop);
        } catch (e) {
          // Ignore if file doesn't exist
        }
      }
      
      this.currentLoop = outputPath;
      return outputPath;
      
    } catch (error) {
      console.error('Loop creation error:', error);
      throw error;
    }
  }
  
  async concatenateVideos(outputPath) {
    // Create concat list file
    const listPath = outputPath.replace('.mp4', '.txt');
    const fileList = this.videos
      .map(v => `file '${path.basename(v.path)}'`)
      .join('\n');
    
    await fs.writeFile(listPath, fileList);
    
    // Use ffmpeg to concatenate
    const cwd = path.dirname(outputPath);
    const command = `ffmpeg -f concat -safe 0 -i ${path.basename(listPath)} -c copy ${path.basename(outputPath)} -y`;
    
    try {
      await execAsync(command, { cwd });
      await fs.unlink(listPath); // Clean up list file
    } catch (error) {
      console.error('FFmpeg error:', error);
      // Fallback to simple copy if ffmpeg fails
      await fs.copyFile(this.videos[this.videos.length - 1].path, outputPath);
    }
  }
  
  getCurrentLoop() {
    return this.currentLoop;
  }
  
  getVideos() {
    return [...this.videos];
  }
  
  getStatus() {
    return {
      videoCount: this.videos.length,
      currentLoop: this.currentLoop ? path.basename(this.currentLoop) : null,
      loopVersion: this.loopVersion
    };
  }
  
  clear() {
    this.videos = [];
    this.currentLoop = null;
    this.loopVersion = 0;
  }
}