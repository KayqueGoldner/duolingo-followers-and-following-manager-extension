/**
 * Performance monitoring and analytics module
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.sessionStart = Date.now();
    this.apiCallCount = 0;
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
  }

  // Start timing an operation
  startTimer(operationName) {
    this.metrics.set(operationName, {
      startTime: performance.now(),
      endTime: null,
      duration: null,
    });
  }

  // End timing an operation
  endTimer(operationName) {
    const metric = this.metrics.get(operationName);
    if (metric && !metric.endTime) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;

      console.log(`⏱️ ${operationName}: ${metric.duration.toFixed(2)}ms`);
    }
    return metric?.duration || 0;
  }

  // Record API call
  recordApiCall(endpoint, duration, success = true) {
    this.apiCallCount++;

    const key = `api_${endpoint}`;
    const existing = this.metrics.get(key) || {
      calls: 0,
      totalDuration: 0,
      successCount: 0,
      errorCount: 0,
      averageDuration: 0,
    };

    existing.calls++;
    existing.totalDuration += duration;

    if (success) {
      existing.successCount++;
    } else {
      existing.errorCount++;
    }

    existing.averageDuration = existing.totalDuration / existing.calls;
    this.metrics.set(key, existing);
  }

  // Record cache performance
  recordCacheHit(key) {
    this.cacheHitCount++;
    console.log(`🎯 Cache hit for: ${key}`);
  }

  recordCacheMiss(key) {
    this.cacheMissCount++;
    console.log(`❌ Cache miss for: ${key}`);
  }

  // Get cache hit rate
  getCacheHitRate() {
    const total = this.cacheHitCount + this.cacheMissCount;
    return total > 0 ? (this.cacheHitCount / total) * 100 : 0;
  }

  // Get performance summary
  getSummary() {
    const sessionDuration = Date.now() - this.sessionStart;
    const apiMetrics = Array.from(this.metrics.entries())
      .filter(([key]) => key.startsWith("api_"))
      .map(([key, metrics]) => ({
        endpoint: key.replace("api_", ""),
        ...metrics,
      }));

    return {
      sessionDuration,
      totalApiCalls: this.apiCallCount,
      cacheHitRate: this.getCacheHitRate(),
      cacheStats: {
        hits: this.cacheHitCount,
        misses: this.cacheMissCount,
      },
      apiMetrics,
      operationTimings: Array.from(this.metrics.entries())
        .filter(([key]) => !key.startsWith("api_"))
        .map(([key, metrics]) => ({
          operation: key,
          duration: metrics.duration,
        }))
        .filter((m) => m.duration !== null),
    };
  }

  // Log performance summary
  logSummary() {
    const summary = this.getSummary();

    console.group("📊 Performance Summary");
    console.log(
      `Session Duration: ${(summary.sessionDuration / 1000).toFixed(1)}s`
    );
    console.log(`Total API Calls: ${summary.totalApiCalls}`);
    console.log(`Cache Hit Rate: ${summary.cacheHitRate.toFixed(1)}%`);

    if (summary.apiMetrics.length > 0) {
      console.group("🌐 API Performance");
      summary.apiMetrics.forEach((api) => {
        console.log(
          `${api.endpoint}: ${
            api.calls
          } calls, avg ${api.averageDuration.toFixed(2)}ms, ${
            api.successCount
          }/${api.calls} success`
        );
      });
      console.groupEnd();
    }

    if (summary.operationTimings.length > 0) {
      console.group("⚡ Operation Timings");
      summary.operationTimings.forEach((op) => {
        console.log(`${op.operation}: ${op.duration.toFixed(2)}ms`);
      });
      console.groupEnd();
    }

    console.groupEnd();
  }

  // Reset metrics
  reset() {
    this.metrics.clear();
    this.sessionStart = Date.now();
    this.apiCallCount = 0;
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
  }

  // Export metrics for analysis
  exportMetrics() {
    return {
      timestamp: Date.now(),
      summary: this.getSummary(),
      rawMetrics: Object.fromEntries(this.metrics),
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Helper function to wrap API calls with monitoring
export function monitorApiCall(endpoint, apiFunction) {
  return async (...args) => {
    const startTime = performance.now();
    let success = true;

    try {
      const result = await apiFunction(...args);
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      performanceMonitor.recordApiCall(endpoint, duration, success);
    }
  };
}

// Helper function to wrap operations with timing
export function timeOperation(operationName, operationFunction) {
  return async (...args) => {
    performanceMonitor.startTimer(operationName);
    try {
      const result = await operationFunction(...args);
      return result;
    } finally {
      performanceMonitor.endTimer(operationName);
    }
  };
}

// Storage quota monitoring
export async function getStorageQuotaInfo() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate) {
      return {
        quota: estimate.quota,
        usage: estimate.usage,
        usagePercentage: (estimate.usage / estimate.quota) * 100,
        available: estimate.quota - estimate.usage,
      };
    }
  } catch (error) {
    console.warn("Could not get storage quota info:", error);
  }

  // Fallback for Chrome extension storage
  const data = await chrome.storage.local.get(null);
  const dataSize = new Blob([JSON.stringify(data)]).size;
  const chromeLimit = 5 * 1024 * 1024; // 5MB

  return {
    quota: chromeLimit,
    usage: dataSize,
    usagePercentage: (dataSize / chromeLimit) * 100,
    available: chromeLimit - dataSize,
  };
}
