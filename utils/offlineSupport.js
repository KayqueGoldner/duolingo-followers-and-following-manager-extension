/**
 * Offline support and data persistence utilities
 */

/**
 * Network status monitor
 */
class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.setupEventListeners();
    this.lastOnlineTime = this.isOnline ? Date.now() : null;
    this.lastOfflineTime = !this.isOnline ? Date.now() : null;
  }

  setupEventListeners() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.lastOnlineTime = Date.now();
      this.notifyListeners("online");
      console.log("🌐 Network connection restored");
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.lastOfflineTime = Date.now();
      this.notifyListeners("offline");
      console.log("📴 Network connection lost");
    });
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyListeners(status) {
    this.listeners.forEach((callback) => {
      try {
        callback(status, this.isOnline);
      } catch (error) {
        console.error("Error in network status listener:", error);
      }
    });
  }

  getStatus() {
    return {
      isOnline: this.isOnline,
      lastOnlineTime: this.lastOnlineTime,
      lastOfflineTime: this.lastOfflineTime,
      timeSinceLastChange:
        Date.now() -
        (this.isOnline ? this.lastOnlineTime : this.lastOfflineTime),
    };
  }
}

/**
 * Offline queue for storing failed operations
 */
export class OfflineQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxQueueSize = 100;
    this.retryDelays = [1000, 5000, 15000, 30000, 60000]; // Progressive delays
  }

  /**
   * Add operation to offline queue
   */
  async enqueue(operation) {
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest operation
      this.queue.shift();
      console.warn("Offline queue full, removing oldest operation");
    }

    const queueItem = {
      id: this.generateId(),
      operation,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.retryDelays.length - 1,
      nextRetry: Date.now() + this.retryDelays[0],
    };

    this.queue.push(queueItem);
    await this.persistQueue();

    console.log(`Added operation to offline queue: ${operation.type}`);
    return queueItem.id;
  }

  /**
   * Process offline queue when back online
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`Processing offline queue: ${this.queue.length} operations`);

    const results = [];

    while (this.queue.length > 0) {
      const item = this.queue[0]; // Process in order

      try {
        const result = await this.executeOperation(item.operation);

        // Success - remove from queue
        this.queue.shift();
        results.push({ id: item.id, success: true, result });

        console.log(`✅ Offline operation completed: ${item.operation.type}`);
      } catch (error) {
        item.retryCount++;

        if (item.retryCount > item.maxRetries) {
          // Max retries reached - remove from queue
          this.queue.shift();
          results.push({
            id: item.id,
            success: false,
            error: error.message,
            maxRetriesReached: true,
          });

          console.error(
            `❌ Offline operation failed permanently: ${item.operation.type}`,
            error
          );
        } else {
          // Schedule retry
          const delay =
            this.retryDelays[item.retryCount] ||
            this.retryDelays[this.retryDelays.length - 1];
          item.nextRetry = Date.now() + delay;

          console.warn(
            `🔄 Offline operation retry ${item.retryCount}/${item.maxRetries} in ${delay}ms: ${item.operation.type}`
          );

          // Move to end of queue for retry
          this.queue.push(this.queue.shift());
          break; // Wait for next processing cycle
        }
      }
    }

    await this.persistQueue();
    this.isProcessing = false;

    return results;
  }

  /**
   * Execute a queued operation
   */
  async executeOperation(operation) {
    switch (operation.type) {
      case "follow":
        return await this.executeFollow(operation.data);
      case "unfollow":
        return await this.executeUnfollow(operation.data);
      case "sync_data":
        return await this.executeSyncData(operation.data);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  async executeFollow(data) {
    // Implement follow operation
    const response = await fetch(
      `https://www.duolingo.com/2017-06-30/friends/users/${data.userId}/follow/${data.targetUserId}`,
      {
        method: "POST",
        headers: {
          authorization: data.jwtToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Follow operation failed: ${response.status}`);
    }

    return response.json();
  }

  async executeUnfollow(data) {
    // Implement unfollow operation
    const response = await fetch(
      `https://www.duolingo.com/2017-06-30/friends/users/${data.userId}/follow/${data.targetUserId}`,
      {
        method: "DELETE",
        headers: {
          authorization: data.jwtToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Unfollow operation failed: ${response.status}`);
    }

    return response.json();
  }

  async executeSyncData(data) {
    // Implement data sync operation
    // This would call the appropriate sync function
    throw new Error("Sync data operation not implemented yet");
  }

  /**
   * Persist queue to storage
   */
  async persistQueue() {
    try {
      await chrome.storage.local.set({
        offlineQueue: this.queue.map((item) => ({
          ...item,
          // Don't persist sensitive data like JWT tokens
          operation: {
            ...item.operation,
            data: {
              ...item.operation.data,
              jwtToken: undefined, // Remove JWT token for security
            },
          },
        })),
      });
    } catch (error) {
      console.error("Error persisting offline queue:", error);
    }
  }

  /**
   * Load queue from storage
   */
  async loadQueue() {
    try {
      const result = await chrome.storage.local.get(["offlineQueue"]);
      if (result.offlineQueue) {
        this.queue = result.offlineQueue;
        console.log(
          `Loaded ${this.queue.length} operations from offline queue`
        );
      }
    } catch (error) {
      console.error("Error loading offline queue:", error);
    }
  }

  /**
   * Clear the queue
   */
  async clearQueue() {
    this.queue = [];
    await this.persistQueue();
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      oldestOperation: this.queue.length > 0 ? this.queue[0].timestamp : null,
      operations: this.queue.map((item) => ({
        id: item.id,
        type: item.operation.type,
        timestamp: item.timestamp,
        retryCount: item.retryCount,
        nextRetry: item.nextRetry,
      })),
    };
  }

  generateId() {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Data persistence manager
 */
export class DataPersistenceManager {
  constructor() {
    this.compressionEnabled = true;
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Create a backup of current data
   */
  async createBackup() {
    try {
      const allData = await chrome.storage.local.get(null);

      const backup = {
        timestamp: Date.now(),
        version: "1.0",
        data: allData,
        checksum: this.calculateChecksum(JSON.stringify(allData)),
      };

      // Compress if enabled
      const backupData = this.compressionEnabled
        ? await this.compressData(backup)
        : backup;

      // Store with timestamp
      const backupKey = `backup_${backup.timestamp}`;
      await chrome.storage.local.set({ [backupKey]: backupData });

      // Clean old backups (keep last 7 days)
      await this.cleanOldBackups();

      console.log(`✅ Data backup created: ${backupKey}`);
      return backupKey;
    } catch (error) {
      console.error("Error creating backup:", error);
      throw error;
    }
  }

  /**
   * Restore data from backup
   */
  async restoreFromBackup(backupKey) {
    try {
      const result = await chrome.storage.local.get([backupKey]);
      const backupData = result[backupKey];

      if (!backupData) {
        throw new Error(`Backup not found: ${backupKey}`);
      }

      // Decompress if needed
      const backup = this.compressionEnabled
        ? await this.decompressData(backupData)
        : backupData;

      // Verify checksum
      const currentChecksum = this.calculateChecksum(
        JSON.stringify(backup.data)
      );
      if (currentChecksum !== backup.checksum) {
        throw new Error("Backup data integrity check failed");
      }

      // Restore data (excluding backup keys)
      const restoreData = {};
      for (const [key, value] of Object.entries(backup.data)) {
        if (!key.startsWith("backup_")) {
          restoreData[key] = value;
        }
      }

      await chrome.storage.local.clear();
      await chrome.storage.local.set(restoreData);

      console.log(`✅ Data restored from backup: ${backupKey}`);
      return true;
    } catch (error) {
      console.error("Error restoring from backup:", error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const allData = await chrome.storage.local.get(null);
      const backups = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith("backup_")) {
          const timestamp = parseInt(key.replace("backup_", ""));
          backups.push({
            key,
            timestamp,
            date: new Date(timestamp),
            size: new Blob([JSON.stringify(value)]).size,
          });
        }
      }

      return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error("Error listing backups:", error);
      return [];
    }
  }

  /**
   * Clean old backups
   */
  async cleanOldBackups() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = Date.now() - maxAge;

    const backups = await this.listBackups();
    const toDelete = backups.filter((backup) => backup.timestamp < cutoff);

    for (const backup of toDelete) {
      await chrome.storage.local.remove([backup.key]);
      console.log(`🗑️ Deleted old backup: ${backup.key}`);
    }
  }

  /**
   * Calculate simple checksum
   */
  calculateChecksum(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Compress data (basic implementation)
   */
  async compressData(data) {
    // In a real implementation, you might use compression libraries
    // For now, just return the data (compression can be added later)
    return {
      compressed: false,
      data: data,
    };
  }

  /**
   * Decompress data
   */
  async decompressData(compressedData) {
    if (compressedData.compressed) {
      // Implement decompression
      return compressedData.data;
    }
    return compressedData.data || compressedData;
  }
}

// Global instances
export const networkMonitor = new NetworkMonitor();
export const offlineQueue = new OfflineQueue();
export const dataPersistence = new DataPersistenceManager();

// Initialize offline support
export async function initializeOfflineSupport() {
  await offlineQueue.loadQueue();

  // Set up automatic queue processing when back online
  networkMonitor.addListener(async (status, isOnline) => {
    if (isOnline && offlineQueue.queue.length > 0) {
      console.log("Back online, processing offline queue...");
      await offlineQueue.processQueue();
    }
  });

  // Note: Automatic backups removed for privacy - backups are user-triggered only
  console.log("Offline support initialized");
}
