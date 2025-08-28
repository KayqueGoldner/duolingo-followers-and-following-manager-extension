import { MY_USER_ID, JWT_TOKEN } from "./variables.js";
import {
  registerNewFollowers,
  registerNewFollowing,
  registerFollow,
  removeFollowing,
  syncFollowingStorage,
  syncFollowersStorage,
  getInactiveUsers,
} from "./follow_date_manager.js";
import { withRetry, rateLimit, batchProcess } from "./utils/retryUtils.js";
import {
  initializeVersionedStorage,
  updateSyncStats,
} from "./utils/storageVersioning.js";

// Enhanced cache with TTL and size limits
class IntelligentCache {
  constructor(maxSize = 1000, defaultTTL = 6 * 60 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.accessOrder = new Map(); // Track access order for LRU
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;

    // Remove expired entries if cache is at capacity
    if (this.cache.size >= this.maxSize) {
      this.cleanup();

      // If still at capacity, remove least recently used
      if (this.cache.size >= this.maxSize) {
        const lruKey = this.accessOrder.keys().next().value;
        this.delete(lruKey);
      }
    }

    this.cache.set(key, { value, expiresAt });
    this.accessOrder.set(key, Date.now());
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access order
    this.accessOrder.set(key, Date.now());
    return entry.value;
  }

  delete(key) {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
      }
    }
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this.cache.size / this.maxSize,
    };
  }
}

const userDetailsCache = new IntelligentCache();
// Cache cleanup is handled on-demand during get/set operations
// No automatic background processing to respect user privacy

// Get user ID from cookies
async function getUserId() {
  if (MY_USER_ID) return MY_USER_ID;

  try {
    const cookie = await chrome.cookies.get({
      url: "https://www.duolingo.com",
      name: "logged_out_uuid",
    });

    if (!cookie || !cookie.value) {
      throw new Error("Could not find logged_out_uuid cookie");
    }

    return cookie.value;
  } catch (error) {
    console.error("Error getting user ID from cookies:", error);
    throw error;
  }
}

// Initialize storage when loading the extension with versioning support
async function initializeStorage() {
  try {
    await initializeVersionedStorage();
    console.log("Versioned storage initialized successfully");
  } catch (error) {
    console.error("Failed to initialize versioned storage:", error);
    // Fallback to basic initialization
    await chrome.storage.local.set({
      followDates: {
        followers: {},
        following: {},
      },
    });
  }
}

// Initialize storage on extension startup
initializeStorage();

// Clear user details cache
function clearUserDetailsCache() {
  userDetailsCache.clear();
  console.log(
    "User details cache cleared, stats:",
    userDetailsCache.getStats()
  );
}

// Enhanced cache management - no automatic clearing, let the intelligent cache handle it
// Cache stats can be monitored through the cache.getStats() method

// Function to notify content scripts about data updates
function notifyContentScripts() {
  chrome.tabs.query({ url: "https://*.duolingo.com/profile/*" }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "refreshInactiveBadge" },
        (response) => {
          // Ignore errors if content script isn't loaded
          if (chrome.runtime.lastError) {
            console.log("Content script not available on tab:", tab.id);
          }
        }
      );
    });
  });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in background:", request);

  if (request.type === "GET_USER_DETAILS") {
    console.log("Getting user details for:", request.userId);

    getUserDetails(request.userId, request.jwtToken)
      .then((result) => {
        console.log("Sending response back to storage_debugger:", result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Error in getUserDetails:", error);
        sendResponse({ error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  // Check if we have both JWT token and user ID
  if (!JWT_TOKEN || !MY_USER_ID) {
    sendResponse({
      error:
        "Authentication not available. Please make sure you are logged in to Duolingo and try again.",
    });
    return true;
  }

  if (request.action === "getFollowers") {
    getFollowers(JWT_TOKEN, MY_USER_ID)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ error }));
  } else if (request.action === "getFollowing") {
    getFollowing(JWT_TOKEN, MY_USER_ID)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ error }));
  } else if (request.action === "unfollow") {
    handleUnfollow(request.userId, JWT_TOKEN, MY_USER_ID)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ error }));
  } else if (request.action === "follow") {
    handleFollow(request.userId, JWT_TOKEN, MY_USER_ID)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ error }));
  } else if (request.action === "getUserDetails") {
    getUserDetails(request.userId, JWT_TOKEN)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ error }));
  } else if (request.action === "updateStoredUsernames") {
    updateStoredUsernames(JWT_TOKEN, MY_USER_ID)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ error }));
  } else if (request.action === "clearCache") {
    clearUserDetailsCache();
    sendResponse({ success: true, message: "Cache cleared successfully" });
  } else if (request.action === "getInactiveUsers") {
    getInactiveUsers()
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ error: error.message }));
  }

  return true; // Indicates that the response will be sent asynchronously
});

// Send progress updates to the popup
function sendProgressUpdate(message, progress) {
  // Send to all open popups
  chrome.runtime
    .sendMessage({
      action: "progressUpdate",
      message,
      progress,
    })
    .catch((err) => {
      // Ignore error if no popup is open to receive the message
      if (!err.message?.includes("Could not establish connection")) {
        console.error("Error sending progress to popup:", err);
      }
    });
}

// Send username update statistics to the popup
function sendUsernameUpdateStats(followersUpdated, followingUpdated) {
  chrome.runtime
    .sendMessage({
      action: "usernameUpdateStats",
      followersUpdated,
      followingUpdated,
    })
    .catch((err) => {
      // Ignore error if no popup is open to receive the message
      if (!err.message?.includes("Could not establish connection")) {
        console.error("Error sending username stats to popup:", err);
      }
    });
}

// Get user details with intelligent caching and retry logic
async function getUserDetails(userId, jwtToken) {
  console.log("Starting getUserDetails for userId:", userId);

  // Check if details are already in cache
  const cacheKey = userId.toString();
  const cachedData = userDetailsCache.get(cacheKey);
  if (cachedData) {
    console.log(`Using cached data for user ${userId}`);
    return cachedData;
  }

  try {
    console.log("Fetching user details from API...");

    const fetchWithRetry = async (url, headers) => {
      return await withRetry(
        async () => {
          const response = await fetch(url, { method: "GET", headers });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        },
        {
          maxAttempts: 3,
          baseDelay: 1000,
          retryOn: ["network", "timeout", "429", "500", "502", "503", "504"],
          onRetry: (error, attempt, delay) => {
            console.warn(
              `Retry ${attempt} for user details ${userId} in ${delay}ms:`,
              error.message
            );
          },
        }
      );
    };

    const headers = {
      authorization: jwtToken,
      "Content-Type": "application/json",
    };

    // Get user details
    const userUrl = `https://www.duolingo.com/2017-06-30/users/${userId}?fields=courses,creationDate,fromLanguage,gemsConfig,globalAmbassadorStatus,hasPlus,id,learningLanguage,location,name,picture,privacySettings,roles,streak,streakData%7BcurrentStreak,previousStreak%7D,subscriberLevel,totalXp,username&_=${Date.now()}`;
    const userData = await fetchWithRetry(userUrl, headers);
    console.log("User data received:", userData);

    // Get followers count
    console.log("Fetching followers count...");
    const followersUrl = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/followers?pageSize=1&_=${Date.now()}`;
    const followersData = await fetchWithRetry(followersUrl, headers);

    // Get following count
    console.log("Fetching following count...");
    const followingUrl = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/following?pageSize=1&_=${Date.now()}`;
    const followingData = await fetchWithRetry(followingUrl, headers);

    console.log("Followers data:", followersData);
    console.log("Following data:", followingData);

    // Create the result object with all user details
    const result = {
      details: {
        ...userData,
        followersCount: followersData.followers?.totalUsers || 0,
        followingCount: followingData.following?.totalUsers || 0,
      },
    };

    console.log("Final result object:", result);

    // Store in cache with longer TTL for detailed user info (12 hours)
    userDetailsCache.set(cacheKey, result, 12 * 60 * 60 * 1000);

    return result;
  } catch (error) {
    console.error("Error in getUserDetails:", error);
    throw error;
  }
}

// Get followers data with enhanced error handling and retry logic
async function getFollowers(jwtToken, userId) {
  const startTime = Date.now();

  const rateLimitedFetch = rateLimit(async (url, headers) => {
    return await withRetry(
      async () => {
        const response = await fetch(url, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch followers: ${response.status}`);
        }

        return response.json();
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryOn: ["network", "timeout", "429", "500", "502", "503", "504"],
        onRetry: (error, attempt, delay) => {
          console.warn(
            `Retry ${attempt} for followers fetch in ${delay}ms:`,
            error.message
          );
          sendProgressUpdate(
            `Retrying followers fetch (attempt ${attempt})...`,
            25
          );
        },
      }
    );
  }, 300);

  let allFollowers = [];
  let cursor = null;
  let page = 1;
  let totalUsers = 0;
  let newFollowersCount = 0;

  try {
    do {
      const url = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/followers?pageSize=500${
        cursor ? `&pageAfter=${cursor}` : ""
      }&viewerId=${userId}&_=${Date.now()}`;

      const headers = {
        authorization: jwtToken,
        "Content-Type": "application/json",
      };

      sendProgressUpdate(`Fetching followers page ${page}...`, 25);

      const { followers } = await rateLimitedFetch(url, headers);
      allFollowers = [...allFollowers, ...followers.users];
      cursor = followers.cursor;
      totalUsers = followers.totalUsers;
      page++;

      // Update progress based on how many users we've fetched vs total
      const progress = Math.min(
        25 + (allFollowers.length / totalUsers) * 25,
        50
      );
      sendProgressUpdate(
        `Fetched ${allFollowers.length} of ${totalUsers} followers...`,
        progress
      );
    } while (cursor !== null);

    sendProgressUpdate("Processing follower data...", 50);

    // Register new followers
    const newFollowers = await registerNewFollowers(allFollowers);
    newFollowersCount = newFollowers.length;
    if (newFollowers.length > 0) {
      console.log(
        `Detected ${newFollowers.length} new followers:`,
        newFollowers
      );
    }

    // Sync storage (mark followers who no longer follow you as inactive and update usernames)
    const syncResults = await syncFollowersStorage(allFollowers);

    if (syncResults.inactivatedRecords.length > 0) {
      console.log(
        `Marked ${syncResults.inactivatedRecords.length} records of ex-followers as inactive in storage`
      );
    }

    if (syncResults.updatedUsernames > 0) {
      console.log(
        `Updated usernames for ${syncResults.updatedUsernames} followers`
      );
      // Send update stats to popup if any usernames were updated
      sendUsernameUpdateStats(syncResults.updatedUsernames, 0);
    }

    // Update sync statistics
    const duration = Date.now() - startTime;
    await updateSyncStats(duration, newFollowersCount, 0);

    // Notify content scripts to refresh inactive badges
    if (
      syncResults.inactivatedRecords.length > 0 ||
      syncResults.updatedUsernames > 0
    ) {
      notifyContentScripts();
    }

    return { followers: { users: allFollowers, totalUsers }, syncResults };
  } catch (error) {
    console.error("Error in getFollowers:", error);
    sendProgressUpdate(`Error fetching followers: ${error.message}`, 0);
    throw error;
  }
}

// Get following data with enhanced error handling and retry logic
async function getFollowing(jwtToken, userId) {
  const startTime = Date.now();

  const rateLimitedFetch = rateLimit(async (url, headers) => {
    return await withRetry(
      async () => {
        const response = await fetch(url, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch following: ${response.status}`);
        }

        return response.json();
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryOn: ["network", "timeout", "429", "500", "502", "503", "504"],
        onRetry: (error, attempt, delay) => {
          console.warn(
            `Retry ${attempt} for following fetch in ${delay}ms:`,
            error.message
          );
          sendProgressUpdate(
            `Retrying following fetch (attempt ${attempt})...`,
            75
          );
        },
      }
    );
  }, 300);

  let allFollowing = [];
  let cursor = null;
  let page = 1;
  let totalUsers = 0;
  let newFollowingCount = 0;

  try {
    do {
      const url = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/following?pageSize=500${
        cursor ? `&pageAfter=${cursor}` : ""
      }&viewerId=${userId}&_=${Date.now()}`;

      const headers = {
        authorization: jwtToken,
        "Content-Type": "application/json",
      };

      sendProgressUpdate(`Fetching followed users page ${page}...`, 75);

      const { following } = await rateLimitedFetch(url, headers);
      allFollowing = [...allFollowing, ...following.users];
      cursor = following.cursor;
      totalUsers = following.totalUsers;
      page++;

      // Update progress based on how many users we've fetched vs total
      const progress = Math.min(
        75 + (allFollowing.length / totalUsers) * 25,
        90
      );
      sendProgressUpdate(
        `Fetched ${allFollowing.length} of ${totalUsers} followed users...`,
        progress
      );
    } while (cursor !== null);

    // Register new followed users
    const newFollowing = await registerNewFollowing(allFollowing);
    newFollowingCount = newFollowing.length;
    if (newFollowing.length > 0) {
      console.log(
        `Detected ${newFollowing.length} new followed users:`,
        newFollowing
      );
    }

    // Sync storage (mark people you no longer follow as inactive and update usernames)
    const syncResults = await syncFollowingStorage(allFollowing);

    if (syncResults.inactivatedRecords.length > 0) {
      console.log(
        `Marked ${syncResults.inactivatedRecords.length} records of users you no longer follow as inactive in storage`
      );
    }

    if (syncResults.updatedUsernames > 0) {
      console.log(
        `Updated usernames for ${syncResults.updatedUsernames} followed users`
      );
      // Send update stats to popup if any usernames were updated
      sendUsernameUpdateStats(0, syncResults.updatedUsernames);
    }

    sendProgressUpdate("Data loaded successfully", 100);

    // Update sync statistics
    const duration = Date.now() - startTime;
    await updateSyncStats(duration, 0, newFollowingCount);

    // Notify content scripts to refresh inactive badges
    if (
      syncResults.inactivatedRecords.length > 0 ||
      syncResults.updatedUsernames > 0
    ) {
      notifyContentScripts();
    }

    return { following: { users: allFollowing, totalUsers }, syncResults };
  } catch (error) {
    console.error("Error in getFollowing:", error);
    sendProgressUpdate(`Error fetching following: ${error.message}`, 0);
    throw error;
  }
}

// Unfollow a user
async function handleUnfollow(targetUserId, jwtToken, userId) {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const url = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/follow/${targetUserId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        authorization: jwtToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to unfollow user: ${response.status}`);
    }

    const data = await response.json();

    // Remove following record
    await removeFollowing(targetUserId);

    // Notify content scripts to refresh inactive badges
    notifyContentScripts();

    return { successful: true, data };
  } catch (error) {
    console.error("Error unfollowing user:", error);
    throw error;
  }
}

// Follow a user
async function handleFollow(targetUserId, jwtToken, userId) {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const url = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/follow/${targetUserId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: jwtToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to follow user: ${response.status}`);
    }

    const data = await response.json();

    // Extract username directly from response, if available
    let username = "Unknown";
    // The response already contains user information, including the username in many cases
    if (data && data.username) {
      username = data.username;
    } else if (data && data.user && data.user.username) {
      username = data.user.username;
    } else {
      // Only make the extra call if the username is not in the response
      try {
        const userDetails = await getUserDetails(targetUserId, jwtToken);
        if (userDetails && userDetails.user && userDetails.user.username) {
          username = userDetails.user.username;
        }
      } catch (error) {
        console.warn(`Could not get username for user ${targetUserId}:`, error);
      }
    }

    // Register follow date with username
    const followInfo = await registerFollow(targetUserId, username);
    console.log(
      `You started following user ${username} (${targetUserId}) on ${followInfo.followDate}`
    );

    // Notify content scripts to refresh inactive badges
    notifyContentScripts();

    return { successful: true, data, followInfo };
  } catch (error) {
    console.error("Error following user:", error);
    throw error;
  }
}

// Function to update stored usernames (legacy support)
async function updateStoredUsernames(jwtToken, userId) {
  sendProgressUpdate("Updating stored usernames...", 50);

  try {
    // Get follower and following data
    const followersResponse = await getFollowers(jwtToken, userId);
    const followingResponse = await getFollowing(jwtToken, userId);

    if (!followersResponse.followers || !followingResponse.following) {
      throw new Error("Failed to fetch followers/following data");
    }

    // Get sync results with updated usernames counts
    let followersUpdated = 0;
    let followingUpdated = 0;

    // Extract the counts from the syncFollowersStorage and syncFollowingStorage functions
    // These functions have already been called in getFollowers and getFollowing
    if (
      followersResponse.syncResults &&
      typeof followersResponse.syncResults.updatedUsernames === "number"
    ) {
      followersUpdated = followersResponse.syncResults.updatedUsernames;
    }

    if (
      followingResponse.syncResults &&
      typeof followingResponse.syncResults.updatedUsernames === "number"
    ) {
      followingUpdated = followingResponse.syncResults.updatedUsernames;
    }

    sendProgressUpdate(`Update completed!`, 100);

    return {
      success: true,
      message: "Usernames were updated during regular data synchronization",
      followersUpdated,
      followingUpdated,
    };
  } catch (error) {
    console.error("Error updating usernames:", error);
    throw error;
  }
}
