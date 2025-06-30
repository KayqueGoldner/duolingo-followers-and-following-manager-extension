import { MY_USER_ID, JWT_TOKEN } from "./variables.js";
import {
  registerNewFollowers,
  registerNewFollowing,
  registerFollow,
  removeFollowing,
  syncFollowingStorage,
  syncFollowersStorage,
} from "./follow_date_manager.js";

// Cache to store user details and avoid repeated requests
const userDetailsCache = new Map();
// Cache expiration time (6 hours in milliseconds)
const CACHE_EXPIRATION = 6 * 60 * 60 * 1000;

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

// Initialize storage when loading the extension and check if data already exists
async function testAndInitializeStorage() {
  // Check current storage
  const storageData = await chrome.storage.local.get(["followDates"]);
  console.log("Current storage state:", storageData);

  if (!storageData.followDates) {
    console.log("Initializing storage with empty structure");
    await chrome.storage.local.set({
      followDates: {
        followers: {},
        following: {},
      },
    });

    // Check if initialization worked
    const updatedStorage = await chrome.storage.local.get(["followDates"]);
    console.log("Storage after initialization:", updatedStorage);
  } else {
    console.log("Storage is already initialized with data");
  }
}

// Call test function at initialization
testAndInitializeStorage();

// Clear user details cache
function clearUserDetailsCache() {
  userDetailsCache.clear();
  console.log("User details cache cleared");
}

// Clear cache every 6 hours to ensure up-to-date data
setInterval(clearUserDetailsCache, CACHE_EXPIRATION);

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

// Get user details
async function getUserDetails(userId, jwtToken) {
  console.log("Starting getUserDetails for userId:", userId);

  // Check if details are already in cache
  const cacheKey = userId.toString();
  if (userDetailsCache.has(cacheKey)) {
    const cachedData = userDetailsCache.get(cacheKey);
    // Check if cache is still valid (not expired)
    if (cachedData.timestamp > Date.now() - CACHE_EXPIRATION) {
      console.log(`Using cached data for user ${userId}`);
      return cachedData.data;
    } else {
      // If expired, remove from cache
      userDetailsCache.delete(cacheKey);
    }
  }

  try {
    console.log("Fetching user details from API...");
    // Get user details
    const userUrl = `https://www.duolingo.com/2017-06-30/users/${userId}?fields=courses,creationDate,fromLanguage,gemsConfig,globalAmbassadorStatus,hasPlus,id,learningLanguage,location,name,picture,privacySettings,roles,streak,streakData%7BcurrentStreak,previousStreak%7D,subscriberLevel,totalXp,username&_=${Date.now()}`;
    const userResponse = await fetch(userUrl, {
      method: "GET",
      headers: {
        authorization: jwtToken,
        "Content-Type": "application/json",
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user details: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    console.log("User data received:", userData);

    // Get followers count
    console.log("Fetching followers count...");
    const followersUrl = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/followers?pageSize=1&_=${Date.now()}`;
    const followersResponse = await fetch(followersUrl, {
      method: "GET",
      headers: {
        authorization: jwtToken,
        "Content-Type": "application/json",
      },
    });

    // Get following count
    console.log("Fetching following count...");
    const followingUrl = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/following?pageSize=1&_=${Date.now()}`;
    const followingResponse = await fetch(followingUrl, {
      method: "GET",
      headers: {
        authorization: jwtToken,
        "Content-Type": "application/json",
      },
    });

    if (!followersResponse.ok || !followingResponse.ok) {
      throw new Error("Failed to fetch followers/following counts");
    }

    const followersData = await followersResponse.json();
    const followingData = await followingResponse.json();

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

    // Store in cache with current timestamp
    userDetailsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error("Error in getUserDetails:", error);
    throw error;
  }
}

// Get followers data
async function getFollowers(jwtToken, userId) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  let allFollowers = [];
  let cursor = null;
  let page = 1;
  let totalUsers = 0;

  do {
    const url = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/followers?pageSize=500${
      cursor ? `&pageAfter=${cursor}` : ""
    }&viewerId=${userId}&_=${Date.now()}`;

    try {
      sendProgressUpdate(`Fetching followers page ${page}...`, 25);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: jwtToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch followers: ${response.status}`);
      }

      const { followers } = await response.json();
      allFollowers = [...allFollowers, ...followers.users];
      cursor = followers.cursor;
      totalUsers = followers.totalUsers;
      page++;

      // Add a small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Update progress based on how many users we've fetched vs total
      const progress = Math.min(
        25 + (allFollowers.length / totalUsers) * 25,
        50
      );
      sendProgressUpdate(
        `Fetched ${allFollowers.length} of ${totalUsers} followers...`,
        progress
      );
    } catch (error) {
      console.error("Error fetching followers:", error);
      throw error;
    }
  } while (cursor !== null);

  sendProgressUpdate("Processing follower data...", 50);

  // Register new followers
  const newFollowers = await registerNewFollowers(allFollowers);
  if (newFollowers.length > 0) {
    console.log(`Detected ${newFollowers.length} new followers:`, newFollowers);
  }

  // Sync storage (remove followers who no longer follow you and update usernames)
  const syncResults = await syncFollowersStorage(allFollowers);

  if (syncResults.orphanedRecords.length > 0) {
    console.log(
      `Removed ${syncResults.orphanedRecords.length} records of ex-followers from storage`
    );
  }

  if (syncResults.updatedUsernames > 0) {
    console.log(
      `Updated usernames for ${syncResults.updatedUsernames} followers`
    );
    // Send update stats to popup if any usernames were updated
    sendUsernameUpdateStats(syncResults.updatedUsernames, 0);
  }

  return { followers: { users: allFollowers, totalUsers }, syncResults };
}

// Get following data
async function getFollowing(jwtToken, userId) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  let allFollowing = [];
  let cursor = null;
  let page = 1;
  let totalUsers = 0;

  do {
    const url = `https://www.duolingo.com/2017-06-30/friends/users/${userId}/following?pageSize=500${
      cursor ? `&pageAfter=${cursor}` : ""
    }&viewerId=${userId}&_=${Date.now()}`;

    try {
      sendProgressUpdate(`Fetching followed users page ${page}...`, 75);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: jwtToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch following: ${response.status}`);
      }

      const { following } = await response.json();
      allFollowing = [...allFollowing, ...following.users];
      cursor = following.cursor;
      totalUsers = following.totalUsers;
      page++;

      // Add a small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Update progress based on how many users we've fetched vs total
      const progress = Math.min(
        75 + (allFollowing.length / totalUsers) * 25,
        90
      );
      sendProgressUpdate(
        `Fetched ${allFollowing.length} of ${totalUsers} followed users...`,
        progress
      );
    } catch (error) {
      console.error("Error fetching following:", error);
      throw error;
    }
  } while (cursor !== null);

  // Register new followed users
  const newFollowing = await registerNewFollowing(allFollowing);
  if (newFollowing.length > 0) {
    console.log(
      `Detected ${newFollowing.length} new followed users:`,
      newFollowing
    );
  }

  // Sync storage (remove people you no longer follow and update usernames)
  const syncResults = await syncFollowingStorage(allFollowing);

  if (syncResults.orphanedRecords.length > 0) {
    console.log(
      `Removed ${syncResults.orphanedRecords.length} records of users you no longer follow from storage`
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
  return { following: { users: allFollowing, totalUsers }, syncResults };
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
