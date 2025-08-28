import { addStyles } from "./ui/styles.js";
import {
  createLoadingUI,
  createErrorUI,
  updateLoadingStep,
} from "./ui/loading.js";
import { showUsernameUpdateNotification } from "./ui/notifications.js";
import { renderUserCards } from "./ui/userCard.js";

document.addEventListener("DOMContentLoaded", function () {
  // Add styles right at the beginning, before starting the application
  addStyles();

  // Remove initial loading after a small delay to ensure styles were applied
  setTimeout(() => {
    const initialLoading = document.getElementById("initial-loading");
    if (initialLoading) {
      initialLoading.style.opacity = "0";
      initialLoading.style.transition = "opacity 0.5s ease";

      setTimeout(() => {
        initialLoading.remove();
      }, 500);
    }
  }, 100);

  initializeApp().catch((error) => {
    console.error("Error initializing extension:", error);

    // Show error message with improved design
    const errorContainer = createErrorUI(error);
    document.body.innerHTML = "";
    document.body.appendChild(errorContainer);
  });
});

// Main initialization function
async function initializeApp() {
  // Create main container
  const container = document.createElement("div");
  container.className = "extension-container";
  document.body.appendChild(container);

  // Create loading indicator with improved design
  const loadingContainer = createLoadingUI();
  container.appendChild(loadingContainer);

  // Progress indicators
  const loadingMessage = document.getElementById("loading-message");
  const progressBar = document.getElementById("progress-bar");
  const loadingSteps = document.querySelector(".loading-steps");

  // Start with connecting step
  updateLoadingStep("connect");

  // Set up progress update listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "progressUpdate") {
      loadingMessage.textContent = message.message;
      progressBar.style.width = `${message.progress}%`;

      // Update loading steps progress
      if (loadingSteps) {
        loadingSteps.style.setProperty("--progress", `${message.progress}%`);
      }

      // Update step indicators based on progress percentage
      if (message.progress < 25) {
        updateLoadingStep("connect");
      } else if (message.progress < 50) {
        updateLoadingStep("followers");
      } else if (message.progress < 75) {
        updateLoadingStep("following");
      } else {
        updateLoadingStep("dates", message.progress === 100);
      }
    } else if (message.action === "usernameUpdateStats") {
      // Display a notification about username updates if any occurred
      if (message.followersUpdated > 0 || message.followingUpdated > 0) {
        showUsernameUpdateNotification(
          message.followersUpdated,
          message.followingUpdated
        );
      }
    }
  });

  // Fetch followers and following data
  updateLoadingStep("followers");
  const [followersResponse, followingResponse] = await Promise.all([
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getFollowers" }, (response) => {
        updateLoadingStep("followers", true);
        resolve(response);
      });
    }),
    new Promise((resolve) => {
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "getFollowing" }, (response) => {
          updateLoadingStep("following", true);
          resolve(response);
        });
      }, 500); // Small delay to make the step transition visible
    }),
  ]);

  // Update final step
  updateLoadingStep("dates", true);

  // Check for errors
  if (followersResponse.error || followingResponse.error) {
    const errorMessage = followersResponse.error || followingResponse.error;
    throw new Error(errorMessage);
  }

  // Process data
  const followers = followersResponse.followers;
  const following = followingResponse.following;

  // Create follower ID map for quick lookup
  const followerIds = new Map();
  followers.users.forEach((user) => {
    followerIds.set(user.userId, true);
  });

  // Create following ID map for quick lookup
  const followingIds = new Map();
  following.users.forEach((user) => {
    followingIds.set(user.userId, true);
  });

  // Update each user's follow status based on the comparison of the two lists
  followers.users.forEach((user) => {
    user.isFollowing = followingIds.has(user.userId);
    user.isFollowedBy = true; // They are in the followers list, so they follow you
  });

  following.users.forEach((user) => {
    user.isFollowedBy = followerIds.has(user.userId);
    user.isFollowing = true; // They are in the following list, so you follow them
  });

  // Load inactive users count for the tab
  try {
    const inactiveUsersResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getInactiveUsers" }, (response) => {
        resolve(response);
      });
    });

    if (!inactiveUsersResponse.error) {
      const inactiveFollowersCount = Object.keys(
        inactiveUsersResponse.followers || {}
      ).length;
      const inactiveFollowingCount = Object.keys(
        inactiveUsersResponse.following || {}
      ).length;
      const totalInactiveCount =
        inactiveFollowersCount + inactiveFollowingCount;

      // This will be updated later when the tab is created, but set initial value
      window.initialInactiveCount = totalInactiveCount;
    }
  } catch (error) {
    console.warn("Could not load inactive users count:", error);
    window.initialInactiveCount = 0;
  }

  // Fade out loading animation before removing
  loadingContainer.classList.add("fade-out");
  setTimeout(() => {
    loadingContainer.remove();

    // Create tab buttons
    const tabsContainer = document.createElement("div");
    tabsContainer.className = "tabs-container";
    container.appendChild(tabsContainer);

    const followersTab = document.createElement("button");
    followersTab.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      Followers (${followers.totalUsers})
    `;
    followersTab.className = "tab-button active";
    tabsContainer.appendChild(followersTab);

    const followingTab = document.createElement("button");
    followingTab.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="20" y1="8" x2="20" y2="14"></line>
        <line x1="23" y1="11" x2="17" y2="11"></line>
      </svg>
      Following (${following.totalUsers})
    `;
    followingTab.className = "tab-button";
    tabsContainer.appendChild(followingTab);

    // Create inactive users tab
    const inactiveTab = document.createElement("button");
    inactiveTab.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
      Inactive (<span id="inactive-count">${
        window.initialInactiveCount || 0
      }</span>)
    `;
    inactiveTab.className = "tab-button";
    tabsContainer.appendChild(inactiveTab);

    // Add filter button for non-followers
    const filterContainer = document.createElement("div");
    filterContainer.className = "filter-container";
    filterContainer.style.display = "none";
    container.appendChild(filterContainer);

    const filterInfo = document.createElement("div");
    filterInfo.className = "filter-info";
    filterInfo.innerHTML = `
      <span class="filter-count">Showing all ${following.totalUsers} users</span>
    `;
    filterContainer.appendChild(filterInfo);

    const filterButton = document.createElement("button");
    filterButton.className = "filter-button";
    filterButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
      Show all
    `;
    filterButton.dataset.showingAll = "true";
    filterContainer.appendChild(filterButton);

    // Filter functionality
    filterButton.addEventListener("click", () => {
      const showingAll = filterButton.dataset.showingAll === "true";
      const cards = followingContainer.querySelectorAll(".user-card");
      const notFollowingBackCount = followingContainer.querySelectorAll(
        ".not-following-back"
      ).length;

      if (showingAll) {
        // Show only non-followers
        cards.forEach((card) => {
          if (!card.classList.contains("not-following-back")) {
            card.style.display = "none";
          }
        });
        filterButton.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 3H6a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h4M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M14 8h4M14 12h4M14 16h4M10 8H6M10 12H6M10 16H6"></path>
              </svg>
              Show all
            `;
        filterButton.dataset.showingAll = "false";
        filterButton.classList.add("active");
        filterInfo.innerHTML = `<span class="filter-count">Showing ${notFollowingBackCount} non-followers</span>`;
      } else {
        // Show all users
        cards.forEach((card) => {
          card.style.display = "flex";
        });
        filterButton.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filter non-followers
            `;
        filterButton.dataset.showingAll = "true";
        filterButton.classList.remove("active");
        filterInfo.innerHTML = `<span class="filter-count">Showing all ${following.totalUsers} users</span>`;
      }
    });

    // Show/hide filter on tab change
    followersTab.addEventListener("click", () => {
      followersTab.classList.add("active");
      followingTab.classList.remove("active");
      inactiveTab.classList.remove("active");
      followersContainer.style.display = "flex";
      followingContainer.style.display = "none";
      inactiveContainer.style.display = "none";
      filterContainer.style.display = "none";
    });

    followingTab.addEventListener("click", () => {
      followingTab.classList.add("active");
      followersTab.classList.remove("active");
      inactiveTab.classList.remove("active");
      followersContainer.style.display = "none";
      followingContainer.style.display = "flex";
      inactiveContainer.style.display = "none";
      filterContainer.style.display = "flex";
    });

    inactiveTab.addEventListener("click", async () => {
      inactiveTab.classList.add("active");
      followersTab.classList.remove("active");
      followingTab.classList.remove("active");
      followersContainer.style.display = "none";
      followingContainer.style.display = "none";
      inactiveContainer.style.display = "flex";
      filterContainer.style.display = "none";

      // Load inactive users if not already loaded
      if (inactiveContainer.children.length === 0) {
        await loadInactiveUsers(inactiveContainer);
      }
    });

    // Create content containers
    const followersContainer = document.createElement("div");
    followersContainer.className = "users-container";
    followersContainer.id = "followers-container";
    container.appendChild(followersContainer);

    const followingContainer = document.createElement("div");
    followingContainer.className = "users-container";
    followingContainer.id = "following-container";
    followingContainer.style.display = "none";
    container.appendChild(followingContainer);

    const inactiveContainer = document.createElement("div");
    inactiveContainer.className = "users-container";
    inactiveContainer.id = "inactive-container";
    inactiveContainer.style.display = "none";
    container.appendChild(inactiveContainer);

    // Render followers
    renderUserCards(
      followers.users,
      followersContainer,
      false,
      followerIds,
      followingIds
    );

    // Render following
    renderUserCards(
      following.users,
      followingContainer,
      true,
      followerIds,
      followingIds
    );

    // Calculate and show how many users don't follow back
    const notFollowingBackCount = following.users.filter(
      (user) => !user.isFollowedBy
    ).length;
    if (notFollowingBackCount > 0) {
      const notFollowingCounter = document.createElement("div");
      notFollowingCounter.className = "not-following-counter";
      notFollowingCounter.textContent = `${notFollowingBackCount} user(s) don't follow you back`;
      followingContainer.insertBefore(
        notFollowingCounter,
        followingContainer.firstChild
      );
    }
  }, 800);
}

// Function to load and display inactive users
async function loadInactiveUsers(container) {
  try {
    // Show loading state
    container.innerHTML = `
      <div class="loading-inactive">
        <div class="spinner"></div>
        <p>Loading inactive users...</p>
      </div>
    `;

    // Fetch inactive users from background
    const inactiveUsers = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getInactiveUsers" }, (response) => {
        resolve(response);
      });
    });

    if (inactiveUsers.error) {
      throw new Error(inactiveUsers.error);
    }

    // Clear loading state
    container.innerHTML = "";

    // Combine all inactive users
    const allInactiveUsers = [];

    // Add inactive followers
    Object.values(inactiveUsers.followers).forEach((user) => {
      allInactiveUsers.push({
        ...user,
        relationshipType: "follower",
      });
    });

    // Add inactive following
    Object.values(inactiveUsers.following).forEach((user) => {
      allInactiveUsers.push({
        ...user,
        relationshipType: "following",
      });
    });

    // Update tab counter
    const inactiveCountElement = document.getElementById("inactive-count");
    if (inactiveCountElement) {
      inactiveCountElement.textContent = allInactiveUsers.length;
    }

    if (allInactiveUsers.length === 0) {
      container.innerHTML = `
        <div class="empty-message">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #bbb; margin-bottom: 16px;">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
          <h3>No Inactive Users</h3>
          <p>You don't have any inactive relationships yet.</p>
          <p style="font-size: 13px; color: #888; margin-top: 8px;">Inactive users appear here when people unfollow you or when you stop following someone.</p>
        </div>
      `;
      return;
    }

    // Sort by date (most recent first)
    allInactiveUsers.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Render inactive users
    allInactiveUsers.forEach((user) => {
      const userCard = createInactiveUserCard(user);
      container.appendChild(userCard);
    });
  } catch (error) {
    console.error("Error loading inactive users:", error);
    container.innerHTML = `
      <div class="error-message">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #ff4b4b; margin-bottom: 16px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3>Error Loading Inactive Users</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #1cb0f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
      </div>
    `;
  }
}

// Function to create an inactive user card
function createInactiveUserCard(user) {
  const userCard = document.createElement("div");
  userCard.className = "user-card inactive-user-card";
  userCard.dataset.userId = user.userId;

  const relationshipIcon =
    user.relationshipType === "follower"
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="20" y1="8" x2="20" y2="14"></line>
        <line x1="23" y1="11" x2="17" y2="11"></line>
      </svg>`;

  const relationshipTypeText =
    user.relationshipType === "follower"
      ? "Used to follow you"
      : "You used to follow them";

  userCard.innerHTML = `
    <div class="user-avatar">
      <div class="avatar-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    </div>
    <div class="user-info">
      <div class="user-header">
        <h3 class="user-name">
          <a href="https://www.duolingo.com/profile/${
            user.username
          }" target="_blank" class="username-link">
            ${user.username}
            <span class="link-icon">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </a>
        </h3>
        <div class="relationship-badge ${user.relationshipType}">
          ${relationshipIcon}
          <span>${relationshipTypeText}</span>
        </div>
      </div>
      <div class="user-meta">
        <div class="inactive-date">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12,6 12,12 16,14"></polyline>
          </svg>
          <span>Since: ${formatDate(user.date)}</span>
        </div>
      </div>
    </div>
  `;

  return userCard;
}

// Helper function to format dates (should match the existing one)
function formatDate(date) {
  if (typeof dateFns !== "undefined") {
    return dateFns.formatDistanceToNow(date, { addSuffix: true });
  }

  // Fallback if date-fns is not available
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "1 day ago";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  } else {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
}
