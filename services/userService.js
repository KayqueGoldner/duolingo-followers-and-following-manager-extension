// Local cache to store user details
export const userDetailsCache = new Map();

/**
 * Preload user details in the background
 *
 * @param {Array} users - List of users to preload details for
 * @param {number} maxPreload - Maximum number of users to preload (default: 10)
 */
export async function preloadUserDetails(users, maxPreload = 10) {
  // Limit the number of preloads to not overload the API
  const usersToPreload = users.slice(0, maxPreload);

  // For each user, check if they're already in the cache
  for (const user of usersToPreload) {
    const userId = user.userId.toString();
    if (!userDetailsCache.has(userId)) {
      try {
        // Wait a short interval between requests to not overload the API
        await new Promise((resolve) => setTimeout(resolve, 500));

        console.log(`Preloading details for user ${userId}`);
        const response = await new Promise((resolve) =>
          chrome.runtime.sendMessage(
            {
              action: "getUserDetails",
              userId: user.userId,
            },
            resolve
          )
        );

        if (response && response.user) {
          userDetailsCache.set(userId, response.user);
        }
      } catch (error) {
        console.warn(`Failed to preload details for user ${userId}:`, error);
      }
    }
  }
}

/**
 * Update the counter of users who don't follow back
 */
export function updateNotFollowingBackCounter() {
  const followingContainer = document.getElementById("following-container");
  if (!followingContainer) return;

  // Remove existing counter
  const existingCounter = followingContainer.querySelector(
    ".not-following-counter"
  );
  if (existingCounter) {
    existingCounter.remove();
  }

  // Count users not following back
  const notFollowingBack = followingContainer.querySelectorAll(
    ".not-following-back"
  ).length;
  if (notFollowingBack > 0) {
    const counter = document.createElement("div");
    counter.className = "not-following-counter";
    counter.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="18" y1="8" x2="23" y2="13"></line>
        <line x1="23" y1="8" x2="18" y2="13"></line>
      </svg>
      ${notFollowingBack} ${
      notFollowingBack === 1 ? "person" : "people"
    } not following you back
    `;

    // Insert counter at the top of the container
    followingContainer.insertBefore(counter, followingContainer.firstChild);
  }
}

/**
 * Fetch user detail from the cache or API
 *
 * @param {string|number} userId - The user ID to fetch details for
 * @returns {Promise<Object>} The user details
 */
export async function getUserDetails(userId) {
  const userIdStr = userId.toString();

  // Check if details are in the cache
  if (userDetailsCache.has(userIdStr)) {
    return userDetailsCache.get(userIdStr);
  }

  // Fetch from API if not in cache
  try {
    const response = await new Promise((resolve) =>
      chrome.runtime.sendMessage(
        {
          action: "getUserDetails",
          userId: userId,
        },
        resolve
      )
    );

    if (response && response.user) {
      // Store in cache for future use
      userDetailsCache.set(userIdStr, response.user);
      return response.user;
    }

    throw new Error("Failed to get user details");
  } catch (error) {
    console.error("Error fetching user details:", error);
    throw error;
  }
}
