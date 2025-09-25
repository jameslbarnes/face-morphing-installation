import { EventEmitter } from 'events';

export class QueueManager extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processed = [];
    this.maxQueueSize = 50;
  }
  
  addToQueue(item) {
    const queueItem = {
      ...item,
      status: 'pending',
      addedAt: Date.now()
    };
    
    this.queue.push(queueItem);
    
    // Maintain max queue size
    if (this.queue.length > this.maxQueueSize) {
      const removed = this.queue.shift();
      this.emit('item_removed', removed);
    }
    
    this.emit('item_added', queueItem);
    return queueItem;
  }
  
  getPrevious(itemId) {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index > 0) {
      return this.queue[index - 1];
    }
    
    // Check processed items if not in queue
    if (this.processed.length > 0) {
      return this.processed[this.processed.length - 1];
    }
    
    return null;
  }
  
  getNext(itemId) {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index >= 0 && index < this.queue.length - 1) {
      return this.queue[index + 1];
    }
    return null;
  }
  
  updateStatus(itemId, status, data = {}) {
    const item = this.queue.find(item => item.id === itemId);
    if (item) {
      item.status = status;
      item.updatedAt = Date.now();
      Object.assign(item, data);
      
      if (status === 'completed') {
        this.moveToProcessed(item);
      }
      
      this.emit('status_updated', { itemId, status, data });
    }
  }
  
  moveToProcessed(item) {
    const index = this.queue.findIndex(i => i.id === item.id);
    if (index >= 0) {
      this.queue.splice(index, 1);
      this.processed.push(item);
      
      // Keep processed list manageable
      if (this.processed.length > 100) {
        this.processed.shift();
      }
    }
  }
  
  getPosition(itemId) {
    const index = this.queue.findIndex(item => item.id === itemId);
    return index >= 0 ? index + 1 : -1;
  }
  
  getQueue() {
    return [...this.queue];
  }
  
  getProcessed() {
    return [...this.processed];
  }
  
  getStatus() {
    const pending = this.queue.filter(i => i.status === 'pending').length;
    const processing = this.queue.filter(i => i.status === 'processing').length;
    const completed = this.processed.length;
    const errors = this.queue.filter(i => i.status === 'error').length;
    
    return {
      queueLength: this.queue.length,
      pending,
      processing,
      completed,
      errors,
      totalProcessed: this.processed.length
    };
  }
  
  clear() {
    this.queue = [];
    this.processed = [];
    this.emit('queue_cleared');
  }
  
  getRecentItems(count = 10) {
    const allItems = [...this.processed, ...this.queue];
    return allItems.slice(-count);
  }
}