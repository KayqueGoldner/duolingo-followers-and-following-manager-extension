/**
 * Debug utility for testing profile badge functionality
 * Run this in the browser console on a Duolingo profile page to test the badge system
 */

console.log("=== Profile Badge Debug Utility ===");

// Function to get current badge information
function getBadgeInfo() {
  const badge = document.querySelector(".duolingo-extension-inactive-badge");
  if (badge) {
    return {
      exists: true,
      text: badge.textContent,
      title: badge.title,
      styles: {
        backgroundColor: badge.style.backgroundColor,
        color: badge.style.color,
        marginLeft: badge.style.marginLeft,
      },
    };
  }
  return { exists: false };
}

// Function to find username elements on the page
function findUsernameElements() {
  const selectors = [
    '[data-test="profile-username"]',
    ".profile-username",
    'h1[data-test*="profile"]',
    'h1[class*="username"]',
    ".profile-header h1",
    "h1:first-of-type",
  ];

  const found = [];
  selectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach((el, index) => {
        found.push({
          selector,
          index,
          element: el,
          text: el.textContent?.trim(),
          hasText: !!(el.textContent && el.textContent.trim()),
        });
      });
    }
  });

  return found;
}

// Function to extract username from current URL
function extractUsername() {
  const url = window.location.href;
  const match = url.match(
    /https:\/\/(?:www\.)?duolingo\.com\/profile\/([^\/\?#]+)/
  );
  return match ? match[1] : null;
}

// Function to check storage for user
async function checkStorage(username) {
  try {
    const result = await chrome.storage.local.get(["followDates"]);
    const followDates = result.followDates || { followers: {}, following: {} };

    // Search in both followers and following for the username
    for (const [userId, userData] of Object.entries(followDates.followers)) {
      if (userData.username === username) {
        return { found: true, userId, type: "follower", data: userData };
      }
    }

    for (const [userId, userData] of Object.entries(followDates.following)) {
      if (userData.username === username) {
        return { found: true, userId, type: "following", data: userData };
      }
    }

    return { found: false };
  } catch (error) {
    return { error: error.message };
  }
}

// Function to manually trigger badge creation
function testBadgeCreation(type = "following") {
  // Remove existing badge first
  const existing = document.querySelector(".duolingo-extension-inactive-badge");
  if (existing) {
    existing.remove();
  }

  // Find username element
  const usernameEl =
    document.querySelector('[data-test="profile-username"]') ||
    document.querySelector("h1:first-of-type");

  if (!usernameEl) {
    console.error("Could not find username element for testing");
    return;
  }

  // Create test badge
  const badge = document.createElement("span");
  badge.className = "duolingo-extension-inactive-badge";
  badge.style.cssText = `
    display: inline-block;
    background-color: #ff9500;
    color: white;
    font-size: 11px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 8px;
    vertical-align: middle;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 1px 3px rgba(255, 149, 0, 0.3);
  `;

  const typeText = type === "follower" ? "Ex-Follower" : "Ex-Following";
  badge.textContent = typeText;
  badge.title = `Test badge: This user is no longer ${
    type === "follower" ? "following you" : "being followed by you"
  }.`;

  usernameEl.appendChild(badge);
  console.log("Test badge created successfully");

  return badge;
}

// Main debug function
async function debugProfileBadge() {
  console.log("\n--- Current Page Info ---");
  console.log("URL:", window.location.href);

  const username = extractUsername();
  console.log("Extracted username:", username);

  console.log("\n--- Username Elements Found ---");
  const elements = findUsernameElements();
  elements.forEach((el, i) => {
    console.log(
      `${i + 1}. ${el.selector} - Text: "${el.text}" - Has valid text: ${
        el.hasText
      }`
    );
  });

  console.log("\n--- Current Badge Status ---");
  const badgeInfo = getBadgeInfo();
  console.log("Badge info:", badgeInfo);

  if (username) {
    console.log("\n--- Storage Check ---");
    const storageResult = await checkStorage(username);
    console.log("Storage result:", storageResult);

    if (storageResult.found) {
      console.log(`✅ User found in storage as ${storageResult.type}`);
      console.log(`   Active status: ${storageResult.data.isActive}`);
      console.log(
        `   Should show badge: ${storageResult.data.isActive === false}`
      );
    } else if (storageResult.error) {
      console.log("❌ Error checking storage:", storageResult.error);
    } else {
      console.log(
        "ℹ️  User not found in storage (expected for users not in your history)"
      );
    }
  }

  console.log("\n--- Available Actions ---");
  console.log(
    '- testBadgeCreation("follower") - Create test Ex-Follower badge'
  );
  console.log(
    '- testBadgeCreation("following") - Create test Ex-Following badge'
  );
  console.log("- getBadgeInfo() - Get current badge information");
  console.log("- findUsernameElements() - Find all possible username elements");

  return {
    username,
    elements,
    badgeInfo,
    storageResult: username ? await checkStorage(username) : null,
  };
}

// Make functions available globally
window.debugProfileBadge = debugProfileBadge;
window.testBadgeCreation = testBadgeCreation;
window.getBadgeInfo = getBadgeInfo;
window.findUsernameElements = findUsernameElements;

// Auto-run debug
debugProfileBadge().then((result) => {
  console.log("\n=== Debug Complete ===");
  console.log("Use the functions above to test badge functionality");
});
