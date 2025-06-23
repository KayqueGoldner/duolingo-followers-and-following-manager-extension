/**
 * Module for managing follower/following relationship start dates
 * Since the Duolingo API doesn't provide these dates, we'll save them in chrome.storage.local
 * starting from the moment we begin tracking.
 */

/**
 * Storage structure:
 * followDates = {
 *   followers: { userId: { timestamp: number, username: string }, ... },
 *   following: { userId: { timestamp: number, username: string }, ... }
 * }
 */

/**
 * Initialize storage if it doesn't exist
 * @returns {Promise} Promise that resolves when storage is initialized
 */
async function initializeStorage() {
  const result = await chrome.storage.local.get(["followDates"]);
  if (!result.followDates) {
    await chrome.storage.local.set({
      followDates: {
        followers: {},
        following: {},
      },
    });
  } else {
    // Check if we need to migrate data from old format to new format
    await migrateDataIfNeeded(result.followDates);
  }
}

/**
 * Migrate data from old format (userId: timestamp) to new format (userId: {timestamp, username})
 * @param {Object} followDates - Current follow dates object
 * @returns {Promise} Promise that resolves when migration is complete
 */
async function migrateDataIfNeeded(followDates) {
  let needsMigration = false;

  // Check followers
  for (const userId in followDates.followers) {
    if (typeof followDates.followers[userId] === "number") {
      needsMigration = true;
      const timestamp = followDates.followers[userId];
      followDates.followers[userId] = {
        timestamp: timestamp,
        username: "Unknown",
      };
    }
  }

  // Check following
  for (const userId in followDates.following) {
    if (typeof followDates.following[userId] === "number") {
      needsMigration = true;
      const timestamp = followDates.following[userId];
      followDates.following[userId] = {
        timestamp: timestamp,
        username: "Unknown",
      };
    }
  }

  // Save changes if needed
  if (needsMigration) {
    console.log("Migrating follow dates from old format to new format");
    await saveFollowDates(followDates);
  }
}

/**
 * Get stored data
 * @returns {Promise<Object>} Promise that resolves with the dates object
 */
async function getFollowDates() {
  await initializeStorage();
  const result = await chrome.storage.local.get(["followDates"]);
  return result.followDates;
}

/**
 * Save data to chrome.storage.local
 * @param {Object} followDates - Object with follow dates
 * @returns {Promise} Promise that resolves when data is saved
 */
async function saveFollowDates(followDates) {
  await chrome.storage.local.set({ followDates });
}

/**
 * Register new followers by comparing old and new lists
 * @param {Array} currentFollowers - Current list of followers
 * @returns {Promise<Array>} Promise that resolves with list of new followers
 */
export async function registerNewFollowers(currentFollowers) {
  await initializeStorage();
  const followDates = await getFollowDates();
  const storedFollowers = followDates.followers;

  const newFollowers = [];

  // For each current follower, check if already registered
  currentFollowers.forEach((follower) => {
    const userId = follower.userId;

    if (!storedFollowers[userId]) {
      // If not registered, add with current date and username
      storedFollowers[userId] = {
        timestamp: Date.now(),
        username: follower.username || "Unknown",
      };
      newFollowers.push({
        ...follower,
        followDate: new Date(storedFollowers[userId].timestamp),
      });
    }
  });

  // Save changes
  await saveFollowDates(followDates);

  return newFollowers;
}

/**
 * Register new people you started following
 * @param {Array} currentFollowing - Current list of people you follow
 * @returns {Promise<Array>} Promise that resolves with list of people you just followed
 */
export async function registerNewFollowing(currentFollowing) {
  await initializeStorage();
  const followDates = await getFollowDates();
  const storedFollowing = followDates.following;

  const newFollowing = [];

  // For each person you follow, check if already registered
  currentFollowing.forEach((following) => {
    const userId = following.userId;
    if (!storedFollowing[userId]) {
      // If not registered, add with current date and username
      storedFollowing[userId] = {
        timestamp: Date.now(),
        username: following.username || "Unknown",
      };
      newFollowing.push({
        ...following,
        followDate: new Date(storedFollowing[userId].timestamp),
      });
    }
  });

  // Save changes
  await saveFollowDates(followDates);

  return newFollowing;
}

/**
 * Explicitly register that you followed someone
 * @param {number} userId - ID of the user you followed
 * @param {string} username - Username of the user you followed
 * @returns {Promise<Object>} Promise that resolves with updated information
 */
export async function registerFollow(userId, username = "Unknown") {
  await initializeStorage();
  const followDates = await getFollowDates();

  // Register current date for the follow
  followDates.following[userId] = {
    timestamp: Date.now(),
    username: username,
  };

  // Save changes
  await saveFollowDates(followDates);

  return {
    userId,
    username,
    followDate: new Date(followDates.following[userId].timestamp),
  };
}

/**
 * Explicitly register that someone followed you
 * @param {number} userId - ID of the user who followed you
 * @param {string} username - Username of the user who followed you
 * @returns {Promise<Object>} Promise that resolves with updated information
 */
export async function registerFollower(userId, username = "Unknown") {
  await initializeStorage();
  const followDates = await getFollowDates();

  // Register current date for the follower
  followDates.followers[userId] = {
    timestamp: Date.now(),
    username: username,
  };

  // Save changes
  await saveFollowDates(followDates);

  return {
    userId,
    username,
    followDate: new Date(followDates.followers[userId].timestamp),
  };
}

/**
 * Remove record when you unfollow someone
 * @param {number} userId - ID of the user you unfollowed
 * @returns {Promise<void>} Promise that resolves when removal is complete
 */
export async function removeFollowing(userId) {
  await initializeStorage();
  const followDates = await getFollowDates();

  // Remove record
  delete followDates.following[userId];

  // Save changes
  await saveFollowDates(followDates);
}

/**
 * Remove record when someone unfollows you
 * @param {number} userId - ID of the user who unfollowed you
 * @returns {Promise<void>} Promise that resolves when removal is complete
 */
export async function removeFollower(userId) {
  await initializeStorage();
  const followDates = await getFollowDates();

  // Remove record
  delete followDates.followers[userId];

  // Save changes
  await saveFollowDates(followDates);
}

/**
 * Get the date when you started following a user
 * @param {number} userId - ID of the user
 * @returns {Promise<{date: Date, username: string}|null>} Promise that resolves with the date and username you started following or null
 */
export async function getFollowingDate(userId) {
  const followDates = await getFollowDates();
  const data = followDates.following[userId];

  return data
    ? {
        date: new Date(data.timestamp),
        username: data.username || "Unknown",
      }
    : null;
}

/**
 * Get the date when a user started following you
 * @param {number} userId - ID of the user
 * @returns {Promise<{date: Date, username: string}|null>} Promise that resolves with the date and username of the user who started following you or null
 */
export async function getFollowerDate(userId) {
  const followDates = await getFollowDates();
  const data = followDates.followers[userId];

  return data
    ? {
        date: new Date(data.timestamp),
        username: data.username || "Unknown",
      }
    : null;
}

/**
 * Get all records with their dates
 * @returns {Promise<Object>} Promise that resolves with the object containing follow dates
 */
export async function getAllFollowDates() {
  const followDates = await getFollowDates();

  // Convert timestamps to Date objects and include usernames
  const result = {
    followers: {},
    following: {},
  };

  // Process followers
  Object.entries(followDates.followers).forEach(([userId, data]) => {
    if (typeof data === "object" && data.timestamp) {
      result.followers[userId] = {
        date: new Date(data.timestamp),
        username: data.username || "Unknown",
      };
    } else if (typeof data === "number") {
      // Handle legacy data format (only timestamp)
      result.followers[userId] = {
        date: new Date(data),
        username: "Unknown",
      };
    }
  });

  // Process following
  Object.entries(followDates.following).forEach(([userId, data]) => {
    if (typeof data === "object" && data.timestamp) {
      result.following[userId] = {
        date: new Date(data.timestamp),
        username: data.username || "Unknown",
      };
    } else if (typeof data === "number") {
      // Handle legacy data format (only timestamp)
      result.following[userId] = {
        date: new Date(data),
        username: "Unknown",
      };
    }
  });

  return result;
}

/**
 * Sync storage with current list of people you follow
 * This removes people you no longer follow from storage
 * @param {Array} currentFollowing - Current list of people you follow
 * @returns {Promise<Object>} Promise that resolves with list of removed records and updated usernames
 */
export async function syncFollowingStorage(currentFollowing) {
  await initializeStorage();
  const followDates = await getFollowDates();
  const storedFollowing = followDates.following;

  // Create map of user IDs you still follow
  const currentFollowingMap = new Map();
  currentFollowing.forEach((user) => {
    currentFollowingMap.set(user.userId.toString(), user);
  });

  // Find people in storage that are no longer in your following list
  const orphanedFollowing = [];
  Object.keys(storedFollowing).forEach((userId) => {
    if (!currentFollowingMap.has(userId)) {
      // Found someone you no longer follow
      orphanedFollowing.push({
        userId,
        timestamp: storedFollowing[userId].timestamp,
        date: new Date(storedFollowing[userId].timestamp),
        username: storedFollowing[userId].username || "Unknown",
      });

      // Remove from storage
      delete storedFollowing[userId];
    }
  });

  // Update usernames for existing records
  let updatedUsernames = 0;

  // For each current following user, update username if necessary
  currentFollowing.forEach((user) => {
    if (user.userId && user.username && storedFollowing[user.userId]) {
      // Check if username is missing or different
      if (
        !storedFollowing[user.userId].username ||
        storedFollowing[user.userId].username === "Unknown" ||
        storedFollowing[user.userId].username !== user.username
      ) {
        // Update username
        storedFollowing[user.userId].username = user.username;
        updatedUsernames++;
      }
    }
  });

  // Save changes if any updates were made or records removed
  if (orphanedFollowing.length > 0 || updatedUsernames > 0) {
    await saveFollowDates(followDates);
  }

  return {
    orphanedRecords: orphanedFollowing,
    updatedUsernames: updatedUsernames,
  };
}

/**
 * Sync storage with current list of your followers
 * This removes people who no longer follow you from storage
 * @param {Array} currentFollowers - Current list of your followers
 * @returns {Promise<Object>} Promise that resolves with list of removed records and updated usernames
 */
export async function syncFollowersStorage(currentFollowers) {
  await initializeStorage();
  const followDates = await getFollowDates();
  const storedFollowers = followDates.followers;

  // Create map of user IDs who still follow you
  const currentFollowersMap = new Map();
  currentFollowers.forEach((user) => {
    currentFollowersMap.set(user.userId.toString(), user);
  });

  // Find people in storage that are no longer in your followers list
  const orphanedFollowers = [];
  Object.keys(storedFollowers).forEach((userId) => {
    if (!currentFollowersMap.has(userId)) {
      // Found someone who no longer follows you
      orphanedFollowers.push({
        userId,
        timestamp: storedFollowers[userId].timestamp,
        date: new Date(storedFollowers[userId].timestamp),
        username: storedFollowers[userId].username || "Unknown",
      });

      // Remove from storage
      delete storedFollowers[userId];
    }
  });

  // Update usernames for existing records
  let updatedUsernames = 0;

  // For each current follower, update username if necessary
  currentFollowers.forEach((user) => {
    if (user.userId && user.username && storedFollowers[user.userId]) {
      // Check if username is missing or different
      if (
        !storedFollowers[user.userId].username ||
        storedFollowers[user.userId].username === "Unknown" ||
        storedFollowers[user.userId].username !== user.username
      ) {
        // Update username
        storedFollowers[user.userId].username = user.username;
        updatedUsernames++;
      }
    }
  });

  // Save changes if any updates were made or records removed
  if (orphanedFollowers.length > 0 || updatedUsernames > 0) {
    await saveFollowDates(followDates);
  }

  return {
    orphanedRecords: orphanedFollowers,
    updatedUsernames: updatedUsernames,
  };
}
