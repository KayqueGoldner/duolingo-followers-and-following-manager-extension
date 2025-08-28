/**
 * Content script for Duolingo profile pages
 * Detects inactive users and renders badges on profile usernames
 */

// Extract username from URL
function extractUsernameFromUrl() {
  const url = window.location.href;
  const match = url.match(
    /https:\/\/(?:www\.)?duolingo\.com\/profile\/([^\/\?#]+)/
  );
  return match ? match[1] : null;
}

// Get user ID from storage by username
async function getUserIdByUsername(username) {
  try {
    const result = await chrome.storage.local.get(["followDates"]);
    const followDates = result.followDates || { followers: {}, following: {} };

    // Search in both followers and following for the username
    for (const [userId, userData] of Object.entries(followDates.followers)) {
      if (userData.username === username) {
        return { userId, type: "follower", data: userData };
      }
    }

    for (const [userId, userData] of Object.entries(followDates.following)) {
      if (userData.username === username) {
        return { userId, type: "following", data: userData };
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting user data:", error);
    return null;
  }
}

// Create inactive badge element
function createInactiveBadge(type) {
  const badge = document.createElement("span");
  badge.className = "duolingo-extension-inactive-badge";
  badge.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 35px;
    background-color: #ff9500;
    color: white;
    font-size: 13px;
    font-weight: bold;
    border-radius: 10px;
    margin-block: 8px;
    vertical-align: middle;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 1px 3px rgba(255, 149, 0, 0.3);
  `;

  const typeText = type === "follower" ? "Ex-Follower" : "Ex-Following";
  badge.textContent = typeText;
  badge.title = `This user is no longer ${
    type === "follower" ? "following you" : "being followed by you"
  } but appears in your history.`;

  return badge;
}

// Global state to prevent multiple execution
let processingBadge = false;
let currentProfileUsername = null;
let retryCount = 0;
const MAX_RETRIES = 3;

// Check if badge already exists
function badgeExists() {
  return document.querySelector(".duolingo-extension-inactive-badge") !== null;
}

// More comprehensive element selectors for profile username
function findProfileUsernameElement() {
  // Try multiple selectors in order of preference
  const selectors = [
    '[data-test="profile-username"]',
    ".profile-username",
    'h1[data-test*="profile"]',
    'h1[class*="username"]',
    ".profile-header h1",
    "h1:first-of-type",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim()) {
      return element;
    }
  }

  return null;
}

// Add badge to profile username element
async function addInactiveBadge() {
  // Prevent concurrent execution
  if (processingBadge) {
    return;
  }

  const username = extractUsernameFromUrl();
  if (!username) {
    console.log("Could not extract username from URL");
    return;
  }

  // Skip if we're already processing this username and badge exists
  if (currentProfileUsername === username && badgeExists()) {
    return;
  }

  processingBadge = true;
  currentProfileUsername = username;

  try {
    console.log(`Checking inactive status for user: ${username}`);

    const userInfo = await getUserIdByUsername(username);
    if (!userInfo) {
      console.log(`User ${username} not found in storage`);
      return;
    }

    // Check if user is inactive
    if (userInfo.data.isActive === false) {
      console.log(`User ${username} is inactive (${userInfo.type})`);

      // Prevent duplicate badges
      if (badgeExists()) {
        console.log("Badge already exists, skipping");
        return;
      }

      // Find the profile username element with multiple strategies
      const usernameElement = findProfileUsernameElement();
      if (usernameElement) {
        const badge = createInactiveBadge(userInfo.type);
        usernameElement.appendChild(badge);
        console.log(`Added inactive badge for ${username}`);
        retryCount = 0; // Reset retry count on success
      } else {
        console.log("Profile username element not found");

        // Only retry a limited number of times
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(
            `Retrying badge placement (${retryCount}/${MAX_RETRIES})`
          );
          setTimeout(() => {
            processingBadge = false;
            addInactiveBadge();
          }, 2000); // Longer delay to let page load
          return; // Don't reset processingBadge yet
        } else {
          console.log("Max retries reached, giving up on badge placement");
          retryCount = 0;
        }
      }
    } else {
      console.log(`User ${username} is active`);
    }
  } catch (error) {
    console.error("Error in addInactiveBadge:", error);
  } finally {
    processingBadge = false;
  }
}

// Observer to detect DOM changes (for SPA navigation)
let observerTimeout = null;
function observePageChanges() {
  const observer = new MutationObserver((mutations) => {
    // Debounce the observer to prevent excessive triggering
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }

    observerTimeout = setTimeout(() => {
      // Only react to significant changes, not our own badge additions
      const hasRelevantChanges = mutations.some((mutation) => {
        if (mutation.type !== "childList") return false;

        // Ignore if we're just adding our own badge
        const addedNodes = Array.from(mutation.addedNodes);
        if (
          addedNodes.length === 1 &&
          addedNodes[0].classList?.contains("duolingo-extension-inactive-badge")
        ) {
          return false;
        }

        // Look for significant page structure changes
        return addedNodes.some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            (node.tagName === "MAIN" ||
              node.tagName === "SECTION" ||
              node.classList?.contains("profile"))
        );
      });

      if (hasRelevantChanges && !processingBadge) {
        console.log("Significant DOM change detected, clearing badge state");

        // Reset state for new page
        currentProfileUsername = null;
        retryCount = 0;

        // Remove existing badge since page content changed
        const existingBadge = document.querySelector(
          ".duolingo-extension-inactive-badge"
        );
        if (existingBadge) {
          existingBadge.remove();
        }

        // Retry adding badge after content loads
        setTimeout(addInactiveBadge, 1500);
      }
    }, 1000); // 1 second debounce
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

// Listen for navigation changes (for SPA)
function listenForNavigation() {
  let currentUrl = window.location.href;
  let navigationTimeout = null;

  const handleNavigation = () => {
    if (navigationTimeout) {
      clearTimeout(navigationTimeout);
    }

    navigationTimeout = setTimeout(() => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl && newUrl.includes("/profile/")) {
        currentUrl = newUrl;
        console.log("Navigation to profile detected:", newUrl);

        // Reset state for new profile
        processingBadge = false;
        currentProfileUsername = null;
        retryCount = 0;

        // Remove existing badge
        const existingBadge = document.querySelector(
          ".duolingo-extension-inactive-badge"
        );
        if (existingBadge) {
          existingBadge.remove();
        }

        // Add badge for new profile if applicable
        setTimeout(addInactiveBadge, 2000);
      }
    }, 500);
  };

  // Check for URL changes every 2 seconds (less frequent)
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      handleNavigation();
    }
  }, 2000);

  // Also listen to popstate events
  window.addEventListener("popstate", handleNavigation);

  // Listen to pushstate/replacestate (for SPA navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    handleNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    handleNavigation();
  };
}

// Initialize the script
function init() {
  console.log("Duolingo profile inactive user detector initialized");

  // Add badge immediately if applicable
  setTimeout(addInactiveBadge, 1000);

  // Set up observers for dynamic content
  observePageChanges();

  // Listen for navigation changes
  listenForNavigation();

  // Also try adding badge when document fully loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(addInactiveBadge, 1500);
    });
  }
}

// Start the script
init();

// Listen for messages from the extension (in case we need to refresh data)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "refreshInactiveBadge") {
    console.log("Received refresh badge request");

    // Reset processing state
    processingBadge = false;
    currentProfileUsername = null;
    retryCount = 0;

    // Remove existing badge
    const existingBadge = document.querySelector(
      ".duolingo-extension-inactive-badge"
    );
    if (existingBadge) {
      existingBadge.remove();
    }

    // Re-check and add badge if needed
    setTimeout(addInactiveBadge, 1000);
    sendResponse({ success: true });
  }
});
