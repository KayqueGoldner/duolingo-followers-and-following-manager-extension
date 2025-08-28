/**
 * Utility functions for implementing robust retry mechanisms with exponential backoff
 */

/**
 * Execute a function with exponential backoff retry
 * @param {Function} fn - Function to execute
 * @param {Object} options - Retry configuration
 * @returns {Promise} - Result of the function execution
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryOn = ["network", "timeout", "429", "500", "502", "503", "504"],
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Check if error should trigger a retry
      const shouldRetry =
        attempt < maxAttempts && isRetryableError(error, retryOn);

      if (shouldRetry) {
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt - 1),
          maxDelay
        );

        // Call retry callback if provided
        if (onRetry) {
          onRetry(error, attempt, delay);
        }

        console.warn(
          `Attempt ${attempt} failed, retrying in ${delay}ms:`,
          error.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Check if an error should trigger a retry
 * @param {Error} error - The error to check
 * @param {Array} retryOn - Array of error types/codes to retry on
 * @returns {boolean} - Whether to retry
 */
function isRetryableError(error, retryOn) {
  // Network errors
  if (
    retryOn.includes("network") &&
    (error.name === "NetworkError" || error.message.includes("fetch"))
  ) {
    return true;
  }

  // Timeout errors
  if (
    retryOn.includes("timeout") &&
    (error.name === "TimeoutError" || error.message.includes("timeout"))
  ) {
    return true;
  }

  // HTTP status codes
  if (error.message.includes("Failed to fetch")) {
    const statusMatch = error.message.match(/(\d{3})/);
    if (statusMatch) {
      const status = statusMatch[1];
      return retryOn.includes(status);
    }
  }

  return false;
}

/**
 * Create a rate-limited function wrapper
 * @param {Function} fn - Function to rate limit
 * @param {number} minInterval - Minimum interval between calls in ms
 * @returns {Function} - Rate-limited function
 */
export function rateLimit(fn, minInterval = 300) {
  let lastCall = 0;

  return async function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall < minInterval) {
      const delay = minInterval - timeSinceLastCall;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    lastCall = Date.now();
    return fn.apply(this, args);
  };
}

/**
 * Batch process items with rate limiting and error handling
 * @param {Array} items - Items to process
 * @param {Function} processor - Function to process each item
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Results array
 */
export async function batchProcess(items, processor, options = {}) {
  const {
    batchSize = 5,
    batchDelay = 1000,
    onProgress = null,
    stopOnError = false,
  } = options;

  const results = [];
  const errors = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const batchPromises = batch.map(async (item, index) => {
      try {
        const result = await processor(item, i + index);
        return { success: true, result, item };
      } catch (error) {
        const errorInfo = { success: false, error, item, index: i + index };
        errors.push(errorInfo);

        if (stopOnError) {
          throw error;
        }

        return errorInfo;
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults.map((r) => r.value || r.reason));

    // Call progress callback
    if (onProgress) {
      onProgress({
        processed: Math.min(i + batchSize, items.length),
        total: items.length,
        errors: errors.length,
        successCount: results.filter((r) => r.success).length,
      });
    }

    // Add delay between batches (except for the last batch)
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }

  return {
    results: results.filter((r) => r.success).map((r) => r.result),
    errors,
    totalProcessed: items.length,
    successCount: results.filter((r) => r.success).length,
    errorCount: errors.length,
  };
}
