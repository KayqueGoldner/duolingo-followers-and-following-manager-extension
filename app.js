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

  // Start with connecting step
  updateLoadingStep("connect");

  // Set up progress update listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "progressUpdate") {
      loadingMessage.textContent = message.message;
      progressBar.style.width = `${message.progress}%`;

      // Update step indicators based on progress
      if (message.progress < 25) {
        updateLoadingStep("connect");
      } else if (message.progress < 50) {
        updateLoadingStep("followers");
      } else if (message.progress < 75) {
        updateLoadingStep("following");
      } else {
        updateLoadingStep("dates");
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
      followersContainer.style.display = "flex";
      followingContainer.style.display = "none";
      filterContainer.style.display = "none";
    });

    followingTab.addEventListener("click", () => {
      followingTab.classList.add("active");
      followersTab.classList.remove("active");
      followersContainer.style.display = "none";
      followingContainer.style.display = "flex";
      filterContainer.style.display = "flex";
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
