import axios from 'axios';
import fs from 'fs';
import { pipeline } from 'stream/promises';

export class LumaService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.piapi.ai/api/luma/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }
  
  /**
   * Generate a morphing video between two images using keyframes
   */
  async generateMorphVideo(startImagePath, endImagePath, options = {}) {
    try {
      // Convert images to base64
      const startImageBase64 = await this.imageToBase64(startImagePath);
      const endImageBase64 = await this.imageToBase64(endImagePath);
      
      const payload = {
        model: 'ray2', // Latest model with keyframe support
        prompt: options.prompt || 'Smooth cinematic transition between faces, maintaining facial features',
        keyframes: {
          frame0: {
            type: 'image',
            url: `data:image/jpeg;base64,${startImageBase64}`
          },
          frame1: {
            type: 'image', 
            url: `data:image/jpeg;base64,${endImageBase64}`
          }
        },
        aspect_ratio: options.aspectRatio || '16:9',
        duration: options.duration || 5, // 5 seconds
        loop: options.loop || false
      };
      
      const response = await this.client.post('/generations', payload);
      
      if (response.data && response.data.id) {
        console.log(`Video generation started: ${response.data.id}`);
        return response.data.id;
      } else {
        throw new Error('Failed to start video generation');
      }
      
    } catch (error) {
      console.error('Luma generation error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Check video generation status
   */
  async getVideoStatus(videoId) {
    try {
      const response = await this.client.get(`/generations/${videoId}`);
      return response.data;
    } catch (error) {
      console.error('Status check error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Download completed video
   */
  async downloadVideo(videoUrl, outputPath) {
    try {
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream'
      });
      
      const writer = fs.createWriteStream(outputPath);
      await pipeline(response.data, writer);
      
      console.log(`Video downloaded: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      console.error('Download error:', error.message);
      throw error;
    }
  }
  
  /**
   * Convert image file to base64
   */
  async imageToBase64(imagePath) {
    const imageBuffer = await fs.promises.readFile(imagePath);
    return imageBuffer.toString('base64');
  }
  
  /**
   * Generate with custom settings
   */
  async generateCustom(settings) {
    try {
      const response = await this.client.post('/generations', settings);
      return response.data.id;
    } catch (error) {
      console.error('Custom generation error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Extend an existing video
   */
  async extendVideo(videoId, direction = 'forward') {
    try {
      const payload = {
        video_id: videoId,
        prompt: `extend:${direction}`,
        duration: 5
      };
      
      const response = await this.client.post('/generations/extend', payload);
      return response.data.id;
      
    } catch (error) {
      console.error('Extend error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Create a looping video
   */
  async createLoop(videoIds) {
    try {
      const payload = {
        videos: videoIds,
        prompt: 'loop:seamless',
        transition_frames: 15
      };
      
      const response = await this.client.post('/generations/loop', payload);
      return response.data.id;
      
    } catch (error) {
      console.error('Loop creation error:', error.response?.data || error.message);
      throw error;
    }
  }
}