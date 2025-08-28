/**
 * Incremental sync strategy for efficient data updates
 */

import { performanceMonitor, timeOperation } from "./performanceMonitor.js";

/**
 * Incremental sync manager for optimizing data fetching
 */
export class IncrementalSyncManager {
  constructor() {
    this.lastSyncTimes = new Map();
    this.syncIntervals = {
      full: 24 * 60 * 60 * 1000, // Full sync every 24 hours
      incremental: 4 * 60 * 60 * 1000, // Incremental sync every 4 hours
      quick: 30 * 60 * 1000, // Quick check every 30 minutes
    };
  }

  /**
   * Determine sync strategy based on last sync time and data size
   */
  async determineSyncStrategy(dataType) {
    const lastSync = await this.getLastSyncTime(dataType);
    const now = Date.now();
    const timeSinceLastSync = now - (lastSync || 0);

    // Get current data size to help determine strategy
    const currentData = await this.getCurrentDataSize(dataType);

    if (!lastSync || timeSinceLastSync > this.syncIntervals.full) {
      return {
        type: "full",
        reason: "First sync or full sync interval reached",
        estimatedDuration: this.estimateFullSyncDuration(currentData.count),
      };
    }

    if (timeSinceLastSync > this.syncIntervals.incremental) {
      return {
        type: "incremental",
        reason: "Incremental sync interval reached",
        estimatedDuration: this.estimateIncrementalSyncDuration(
          currentData.count
        ),
      };
    }

    if (timeSinceLastSync > this.syncIntervals.quick) {
      return {
        type: "quick",
        reason: "Quick check interval reached",
        estimatedDuration: this.estimateQuickSyncDuration(),
      };
    }

    return {
      type: "skip",
      reason: "Recent sync, skipping",
      estimatedDuration: 0,
    };
  }

  /**
   * Perform incremental sync by checking only recent changes
   */
  async performIncrementalSync(dataType, apiFunction, lastKnownCount) {
    performanceMonitor.startTimer(`incremental_sync_${dataType}`);

    try {
      // First, get just the count to see if there are changes
      const quickCheck = await this.quickCountCheck(dataType, apiFunction);

      if (quickCheck.count === lastKnownCount) {
        console.log(`No changes detected for ${dataType}, skipping full fetch`);
        return {
          hasChanges: false,
          data: null,
          newCount: quickCheck.count,
        };
      }

      console.log(
        `Changes detected for ${dataType}: ${lastKnownCount} -> ${quickCheck.count}`
      );

      // If there are changes, fetch the full data
      // In the future, this could be optimized to fetch only new/changed entries
      const fullData = await apiFunction();

      return {
        hasChanges: true,
        data: fullData,
        newCount: quickCheck.count,
        changeType: quickCheck.count > lastKnownCount ? "increase" : "decrease",
        changeAmount: Math.abs(quickCheck.count - lastKnownCount),
      };
    } finally {
      performanceMonitor.endTimer(`incremental_sync_${dataType}`);
    }
  }

  /**
   * Quick count check to detect changes without full data fetch
   */
  async quickCountCheck(dataType, apiFunction) {
    // This would ideally use a lighter API endpoint that just returns counts
    // For now, we'll fetch just the first page with minimal page size
    const sampleData = await apiFunction(1); // Fetch just first page

    return {
      count: sampleData.totalUsers || sampleData[dataType]?.totalUsers || 0,
      sampleSize: sampleData.users?.length || 0,
    };
  }

  /**
   * Get last sync time for a data type
   */
  async getLastSyncTime(dataType) {
    try {
      const result = await chrome.storage.local.get(["syncTimes"]);
      return result.syncTimes?.[dataType] || null;
    } catch (error) {
      console.error("Error getting last sync time:", error);
      return null;
    }
  }

  /**
   * Update last sync time for a data type
   */
  async updateLastSyncTime(dataType, timestamp = Date.now()) {
    try {
      const result = await chrome.storage.local.get(["syncTimes"]);
      const syncTimes = result.syncTimes || {};
      syncTimes[dataType] = timestamp;
      await chrome.storage.local.set({ syncTimes });
    } catch (error) {
      console.error("Error updating last sync time:", error);
    }
  }

  /**
   * Get current data size for estimation
   */
  async getCurrentDataSize(dataType) {
    try {
      const result = await chrome.storage.local.get(["followDates"]);
      const followDates = result.followDates || {};
      const data = followDates[dataType] || {};

      return {
        count: Object.keys(data).length,
        sizeBytes: new Blob([JSON.stringify(data)]).size,
      };
    } catch (error) {
      console.error("Error getting current data size:", error);
      return { count: 0, sizeBytes: 0 };
    }
  }

  /**
   * Estimate sync durations based on data size
   */
  estimateFullSyncDuration(recordCount) {
    // Base estimation: ~100ms per 100 records plus overhead
    const baseTime = 2000; // 2 seconds base overhead
    const perRecordTime = 1; // 1ms per record
    return baseTime + recordCount * perRecordTime;
  }

  estimateIncrementalSyncDuration(recordCount) {
    // Incremental sync is typically faster
    return this.estimateFullSyncDuration(recordCount) * 0.3;
  }

  estimateQuickSyncDuration() {
    // Quick sync just checks counts
    return 1000; // 1 second
  }

  /**
   * Smart sync that chooses the best strategy
   */
  async smartSync(dataType, fullSyncFunction, progressCallback = null) {
    const strategy = await this.determineSyncStrategy(dataType);

    if (progressCallback) {
      progressCallback({
        phase: "planning",
        strategy: strategy.type,
        estimatedDuration: strategy.estimatedDuration,
        reason: strategy.reason,
      });
    }

    console.log(
      `Sync strategy for ${dataType}: ${strategy.type} (${strategy.reason})`
    );

    if (strategy.type === "skip") {
      return { skipped: true, reason: strategy.reason };
    }

    const syncFunction = timeOperation(`smart_sync_${dataType}`, async () => {
      switch (strategy.type) {
        case "quick":
          return await this.performQuickSync(
            dataType,
            fullSyncFunction,
            progressCallback
          );

        case "incremental":
          const currentData = await this.getCurrentDataSize(dataType);
          return await this.performIncrementalSync(
            dataType,
            fullSyncFunction,
            currentData.count
          );

        case "full":
        default:
          return await this.performFullSync(
            dataType,
            fullSyncFunction,
            progressCallback
          );
      }
    });

    const result = await syncFunction();

    // Update last sync time
    await this.updateLastSyncTime(dataType);

    return {
      ...result,
      strategy: strategy.type,
      duration: performanceMonitor.endTimer(`smart_sync_${dataType}`),
    };
  }

  /**
   * Perform quick sync (just check for major changes)
   */
  async performQuickSync(dataType, apiFunction, progressCallback) {
    if (progressCallback) {
      progressCallback({ phase: "quick_check", progress: 50 });
    }

    const currentData = await this.getCurrentDataSize(dataType);
    const quickCheck = await this.quickCountCheck(dataType, apiFunction);

    if (progressCallback) {
      progressCallback({ phase: "complete", progress: 100 });
    }

    return {
      type: "quick",
      hasChanges: quickCheck.count !== currentData.count,
      currentCount: currentData.count,
      newCount: quickCheck.count,
      changeAmount: Math.abs(quickCheck.count - currentData.count),
    };
  }

  /**
   * Perform full sync
   */
  async performFullSync(dataType, apiFunction, progressCallback) {
    if (progressCallback) {
      progressCallback({ phase: "full_sync", progress: 0 });
    }

    const result = await apiFunction();

    if (progressCallback) {
      progressCallback({ phase: "complete", progress: 100 });
    }

    return {
      type: "full",
      hasChanges: true,
      data: result,
    };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    try {
      const result = await chrome.storage.local.get(["syncTimes", "metadata"]);
      const syncTimes = result.syncTimes || {};
      const metadata = result.metadata || {};

      return {
        lastSyncTimes: syncTimes,
        syncIntervals: this.syncIntervals,
        nextRecommendedSync: {
          followers: this.getNextSyncTime("followers", syncTimes.followers),
          following: this.getNextSyncTime("following", syncTimes.following),
        },
        syncHistory: metadata.syncStats || {},
      };
    } catch (error) {
      console.error("Error getting sync stats:", error);
      return null;
    }
  }

  /**
   * Calculate next recommended sync time
   */
  getNextSyncTime(dataType, lastSync) {
    if (!lastSync) return Date.now(); // Sync now if never synced

    const nextIncremental = lastSync + this.syncIntervals.incremental;
    const nextFull = lastSync + this.syncIntervals.full;
    const nextQuick = lastSync + this.syncIntervals.quick;

    const now = Date.now();

    if (now >= nextFull) return { type: "full", time: now };
    if (now >= nextIncremental) return { type: "incremental", time: now };
    if (now >= nextQuick) return { type: "quick", time: now };

    return {
      type: "quick",
      time: nextQuick,
      timeUntil: nextQuick - now,
    };
  }
}
