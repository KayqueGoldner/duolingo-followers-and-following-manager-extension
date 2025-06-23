// Import the main app module
import "./app.js";

// add unfollow button
function addUnfollowButton(
  actionsContainer,
  user,
  card,
  followerIds,
  followingIds
) {
  const unfollowButton = document.createElement("button");
  unfollowButton.className = "unfollow-button";
  unfollowButton.textContent = "Unfollow";
  unfollowButton.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      unfollowButton.disabled = true;
      unfollowButton.textContent = "Unfollowing...";

      const response = await new Promise((resolve) =>
        chrome.runtime.sendMessage(
          {
            action: "unfollow",
            userId: user.userId,
          },
          resolve
        )
      );

      if (response.successful) {
        // remove following record
        await removeFollowing(user.userId);

        // Update both maps to reflect the new state
        followingIds.delete(user.userId);
        user.isFollowing = false;

        // Update any matching user in the followers list
        const followerCard = document.querySelector(
          `#followers-container [data-user-id="${user.userId}"]`
        );
        if (followerCard) {
          const mutualBadge = followerCard.querySelector(".mutual-badge");
          if (mutualBadge) mutualBadge.remove();

          // Add a follow button since we're no longer following them
          const followerActionsContainer =
            followerCard.querySelector(".actions-container");
          if (
            followerActionsContainer &&
            !followerActionsContainer.querySelector(".follow-button")
          ) {
            addFollowButton(
              followerActionsContainer,
              user,
              followerCard.querySelector(".user-info"),
              followerIds,
              followingIds
            );
          }
        }

        // Remove the card with animation
        card.classList.add("unfollowed");
        setTimeout(() => {
          card.remove();

          // Recalculate and update the not following back counter
          updateNotFollowingBackCounter();
        }, 500);
      } else {
        unfollowButton.disabled = false;
        unfollowButton.textContent = "Unfollow";
        alert("Failed to unfollow user. Please try again.");
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
      unfollowButton.disabled = false;
      unfollowButton.textContent = "Unfollow";
      alert("Error unfollowing user. Please try again.");
    }
  });
  actionsContainer.appendChild(unfollowButton);
}

// add follow button
function addFollowButton(
  actionsContainer,
  user,
  userInfo,
  followerIds,
  followingIds
) {
  const followButton = document.createElement("button");
  followButton.className = "follow-button";
  followButton.textContent = "Follow";
  followButton.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      followButton.disabled = true;
      followButton.textContent = "Following...";

      const response = await new Promise((resolve) =>
        chrome.runtime.sendMessage(
          {
            action: "follow",
            userId: user.userId,
          },
          resolve
        )
      );

      if (response.successful) {
        // we don't need to call registerFollow here, it's already done in background.js
        // and the response object (followInfo) already contains the registered date

        // Update maps and user object
        followingIds.set(user.userId, true);
        user.isFollowing = true;

        // Update UI to show user is now followed
        followButton.className = "follow-button followed";
        followButton.textContent = "Following";

        // Add mutual badge if user follows you
        if (user.isFollowedBy) {
          if (
            !document.querySelector(
              `[data-user-id="${user.userId}"] .mutual-badge`
            )
          ) {
            const mutualBadge = document.createElement("span");
            mutualBadge.className = "mutual-badge";
            mutualBadge.textContent = "Mutual";
            userInfo.appendChild(mutualBadge);
          }
        }

        // add follow date info, if available
        if (response.followInfo && response.followInfo.followDate) {
          // if the follow date info element doesn't exist yet
          if (!userInfo.querySelector(".follow-date-info")) {
            const followDateInfo = document.createElement("div");
            followDateInfo.className = "follow-date-info";
            followDateInfo.textContent = `Following since: ${formatDate(
              response.followInfo.followDate
            )}`;

            // insert in a proper location
            const xpElement = userInfo.querySelector(".user-xp");
            const additionalInfoContainer = userInfo.querySelector(
              ".additional-info-container"
            );

            if (xpElement && additionalInfoContainer) {
              userInfo.insertBefore(followDateInfo, additionalInfoContainer);
            } else {
              userInfo.appendChild(followDateInfo);
            }
          }
        }

        // Update the not following back counter if needed
        updateNotFollowingBackCounter();
      } else {
        followButton.disabled = false;
        followButton.textContent = "Follow";
        alert("Failed to follow user. Please try again.");
      }
    } catch (error) {
      console.error("Error following user:", error);
      followButton.disabled = false;
      followButton.textContent = "Follow";
      alert("Error following user. Please try again.");
    }
  });
  actionsContainer.appendChild(followButton);
}

// update not following back counter
function updateNotFollowingBackCounter() {
  const followingContainer = document.getElementById("following-container");
  if (!followingContainer) return;

  const followingCards = followingContainer.querySelectorAll(".user-card");
  const notFollowingBackCount = Array.from(followingCards).filter((card) =>
    card.classList.contains("not-following-back")
  ).length;

  let notFollowingCounter = document.querySelector(".not-following-counter");

  if (notFollowingBackCount > 0) {
    if (notFollowingCounter) {
      notFollowingCounter.textContent = `${notFollowingBackCount} user(s) don't follow you back`;
    } else {
      notFollowingCounter = document.createElement("div");
      notFollowingCounter.className = "not-following-counter";
      notFollowingCounter.textContent = `${notFollowingBackCount} user(s) don't follow you back`;
      followingContainer.insertBefore(
        notFollowingCounter,
        followingContainer.firstChild
      );
    }
  } else if (notFollowingCounter) {
    notFollowingCounter.remove();
  }
}

/**
 * Format a date for display
 * @param {Date} date - The date to format
 * @returns {string} The formatted date
 */
function formatDate(date) {
  if (!date) return "N/A";

  // Use the globally available dateFns object
  return dateFns.formatDistanceToNow(date, { addSuffix: true });
}

// add styles to the page in an optimized way
function addStyles() {
  // check if styles were already added to avoid duplication
  if (document.getElementById("extension-styles")) return;

  // create a reference to the head tag
  const head = document.head || document.getElementsByTagName("head")[0];

  // create the style element
  const style = document.createElement("style");
  style.id = "extension-styles";
  style.type = "text/css";

  // add immediately to head to start processing
  head.appendChild(style);

  // define styles
  style.textContent = `
    .extension-container {
      font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .loading-container, .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      transition: opacity 0.5s ease;
    }
    
    .loading-container.fade-out {
      opacity: 0;
    }
    
    .loading-logo {
      margin-bottom: 20px;
      position: relative;
    }
    
    .loading-icon {
      width: 72px;
      height: 72px;
      border-radius: 16px;
      object-fit: contain;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    
    .pulse {
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    .loading-title {
      color: #1cb0f6;
      margin: 0 0 8px 0;
      font-size: 20px;
    }
    
    #loading-message {
      color: #666;
      margin: 0 0 20px 0;
      font-size: 14px;
    }
    
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #1cb0f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
    
    .progress-bar-container {
      width: 80%;
      height: 8px;
      background-color: #f3f3f3;
      border-radius: 4px;
      margin-top: 16px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      width: 0%;
      background-color: #1cb0f6;
      transition: width 0.3s ease;
    }
    
    .loading-steps {
      display: flex;
      justify-content: space-between;
      width: 80%;
      margin-top: 16px;
      position: relative;
    }
    
    .loading-steps::before {
      content: '';
      position: absolute;
      top: 12px;
      left: 18px;
      right: 18px;
      height: 2px;
      background-color: #e0e0e0;
      z-index: 0;
    }
    
    .loading-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      z-index: 1;
    }
    
    .step-indicator {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: #f3f3f3;
      border: 2px solid #e0e0e0;
      margin-bottom: 8px;
      position: relative;
      transition: all 0.3s ease;
    }
    
    .step-text {
      font-size: 12px;
      color: #888;
      text-align: center;
      white-space: nowrap;
      transition: all 0.3s ease;
    }
    
    .loading-step.active .step-indicator {
      background-color: #1cb0f6;
      border-color: #1cb0f6;
      box-shadow: 0 0 0 4px rgba(28, 176, 246, 0.2);
    }
    
    .loading-step.active .step-text {
      color: #1cb0f6;
      font-weight: bold;
    }
    
    .loading-step.complete .step-indicator {
      background-color: #58cc02;
      border-color: #58cc02;
    }
    
    .loading-step.complete .step-indicator::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 12px;
      font-weight: bold;
    }
    
    .loading-step.complete .step-text {
      color: #58cc02;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .not-following-counter {
      background-color: rgba(255, 150, 0, 0.1);
      padding: 10px;
      margin-bottom: 16px;
      border-radius: 8px;
      font-weight: bold;
      color: #ff9600;
      text-align: center;
      border: 1px solid rgba(255, 150, 0, 0.2);
    }
    
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
    }
    
    .error-icon {
      margin-bottom: 16px;
      animation: pulse 2s infinite;
    }
    
    .error-title {
      color: #ff4b4b;
      margin-bottom: 8px;
      font-size: 22px;
    }
    
    .error-message {
      color: #666;
      margin-bottom: 16px;
      font-size: 15px;
    }
    
    .error-help {
      margin: 16px 0;
      text-align: left;
      background: #f8f8f8;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      width: 80%;
      max-width: 400px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    
    .error-help p {
      margin-top: 0;
      font-weight: bold;
      color: #555;
    }
    
    .error-help ul {
      margin: 8px 0;
      padding-left: 20px;
    }
    
    .error-help li {
      margin-bottom: 8px;
      line-height: 1.5;
    }
    
    .error-help a {
      color: #1cb0f6;
      text-decoration: none;
      font-weight: bold;
    }
    
    .error-help a:hover {
      text-decoration: underline;
    }
    
    .error-details {
      margin: 16px 0;
      padding: 8px 16px;
      background: #f8f8f8;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      color: #777;
    }
    
    #retry-button {
      background: #1cb0f6;
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 30px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(28, 176, 246, 0.3);
    }
    
    #retry-button:hover {
      background: #0095d8;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(28, 176, 246, 0.4);
    }
    
    .tabs-container {
      display: flex;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .tab-button {
      flex: 1;
      background: none;
      border: none;
      padding: 16px;
      font-size: 16px;
      font-weight: bold;
      color: #777;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .tab-button.active {
      color: #1cb0f6;
      box-shadow: inset 0 -3px 0 #1cb0f6;
    }
    
    .users-container {
      max-height: 500px;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .empty-message {
      text-align: center;
      color: #777;
      padding: 24px;
    }
    
    .user-card {
      display: flex;
      align-items: center;
      padding: 16px;
      border-radius: 8px;
      background: #f8f8f8;
      transition: all 0.3s ease;
      position: relative;
    }
    
    .user-card:hover {
      background: #f0f0f0;
    }
    
    .user-card.unfollowed {
      opacity: 0.5;
      transform: translateX(100px);
    }

    /* style for cards of users that don't follow back */
    .not-following-back {
      background: rgba(255, 150, 0, 0.05);
      border-left: 3px solid #ff9600;
    }
    
    .not-following-back:hover {
      background: rgba(255, 150, 0, 0.1);
    }
    
    .not-following-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background: #ff9600;
      color: white;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .streak-warning {
      color: #ff4b4b;
      font-size: 11px;
      margin-left: 8px;
      font-style: italic;
    }
    
    /* highlight streak zero within dropdown */
    .streak-value.zero {
      color: #ff4b4b;
    }
    
    .user-picture {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      object-fit: cover;
      margin-right: 16px;
      border: 2px solid #ddd;
      background-color: #f0f0f0;
    }
    
    .user-picture-fallback {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      margin-right: 16px;
      border: 2px solid #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: white;
      text-transform: uppercase;
    }
    
    .user-info {
      flex: 1;
    }
    
    .user-displayname {
      font-size: 16px;
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .verified-badge {
      background: #1cb0f6;
      color: white;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }
    
    .user-username {
      margin: 0 0 4px 0;
      color: #777;
      font-size: 14px;
    }
    
    .username-link {
      text-decoration: none;
      color: #1cb0f6;
      transition: all 0.2s ease;
    }
    
    .username-link:hover {
      text-decoration: underline;
      color: #0095d8;
    }
    
    .link-icon {
      opacity: 0.6;
      display: inline-block;
      vertical-align: middle;
      margin-left: 2px;
    }
    
    .username-link:hover .link-icon {
      opacity: 1;
    }
    
    .user-xp {
      margin: 0;
      font-size: 14px;
      font-weight: bold;
      color: #ff9600;
    }
    
    .streak-container {
      display: flex;
      align-items: center;
      margin: 4px 0;
    }
    
    .streak-icon {
      margin-right: 5px;
      font-size: 16px;
    }
    
    .streak-value {
      font-weight: bold;
      color: #ff9600;
    }
    
    .mutual-badge {
      display: inline-block;
      background: #58cc02;
      color: white;
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 4px;
    }
    
    .actions-container {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }
    
    .unfollow-button {
      background: #ff4b4b;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .unfollow-button:hover {
      background: #e63939;
    }
    
    .unfollow-button:disabled {
      background: #999;
      cursor: not-allowed;
    }
    
    .follow-button {
      background: #58cc02;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
      transition: all 0.2s ease;
    }
    
    .follow-button:hover {
      background: #47a800;
    }
    
    .follow-button:disabled {
      background: #999;
      cursor: not-allowed;
    }
    
    .follow-button.followed {
      background: #1cb0f6;
    }
    
    /* styles for additional info */
    .additional-info-container {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #eee;
      font-size: 13px;
    }
    
    .mini-loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #1cb0f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 5px auto;
    }
    
    .expand-button {
      background: none;
      border: none;
      padding: 2px;
      font-size: 16px;
      cursor: pointer;
      color: #777;
      margin-left: 5px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      transition: all 0.2s ease;
    }
    
    .expand-button:hover {
      background-color: #f0f0f0;
      color: #1cb0f6;
    }
    
    .user-language {
      margin: 5px 0;
      color: #777;
    }
    
    .plus-badge {
      display: inline-block;
      background: #ff9600;
      color: white;
      font-size: 11px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      margin: 5px 0;
    }
    
    .join-date {
      margin: 5px 0;
      color: #999;
      font-size: 12px;
    }
    
    .courses-container {
      margin-top: 10px;
    }
    
    .courses-title {
      margin: 5px 0;
      font-weight: bold;
      color: #666;
    }
    
    .courses-list {
      list-style-type: none;
      padding-left: 10px;
      margin: 5px 0;
    }
    
    .course-item {
      margin-bottom: 3px;
      font-size: 12px;
    }
    
    .more-courses {
      font-size: 11px;
      color: #999;
      font-style: italic;
    }
    
    .details-error {
      color: #ff4b4b;
      text-align: center;
      font-size: 12px;
      font-style: italic;
    }
    
    /* style for the follow date info */
    .follow-date-info {
      font-size: 12px;
      color: #777;
      margin-top: 2px;
      font-style: italic;
    }
    
    .user-relationship {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 8px;
    }
    
    .user-relationship span {
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 10px;
      display: inline-block;
    }
    
    .follows-you {
      background-color: #e7f5ff;
      color: #1e88e5;
    }
    
    .not-following-back {
      background-color: #fff1f0;
      color: #f44336;
    }
    
    .mutual {
      background-color: #e8f5e9;
      color: #4caf50;
    }
    
    .user-card {
      display: flex;
      padding: 10px;
      border-bottom: 1px solid #e0e0e0;
      transition: background-color 0.2s;
    }
    
    .user-card:hover {
      background-color: #f5f5f5;
    }
    
    .user-picture {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      margin-right: 10px;
    }
    
    .user-initials {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: #58cc02;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 10px;
    }
    
    .user-content {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }
    
    .display-name {
      font-weight: bold;
      font-size: 16px;
    }
    
    .username {
      color: #777;
      font-size: 14px;
    }
    
    .unfollow-button {
      background-color: transparent;
      color: #ff4b4b;
      border: 1px solid #ff4b4b;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 8px;
      align-self: flex-start;
    }
    
    .unfollow-button:hover {
      background-color: #fff1f0;
    }
    
    .removing {
      animation: fadeOut 0.3s forwards;
    }
    
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; height: 0; padding: 0; margin: 0; overflow: hidden; }
    }
    
    .filter-container {
      margin: 10px 0;
      text-align: right;
      padding: 0 10px;
    }
    
    .filter-button {
      background-color: #1cb0f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 16px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    
    .filter-button:hover {
      background-color: #18a0e0;
    }
    
    .filter-button:active {
      background-color: #1690c8;
    }
  `;
}

// function to show username update notification
function showUsernameUpdateNotification(followersUpdated, followingUpdated) {
  const total = followersUpdated + followingUpdated;
  if (total === 0) return;

  const notification = document.createElement("div");
  notification.className = "username-update-notification";
  notification.innerHTML = `
    <div class="notification-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58cc02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>
    <div class="notification-content">
      <p>Updated ${total} username${total > 1 ? "s" : ""}</p>
      <p class="notification-details">
        ${
          followersUpdated > 0
            ? `${followersUpdated} follower${followersUpdated > 1 ? "s" : ""}`
            : ""
        }
        ${followersUpdated > 0 && followingUpdated > 0 ? " and " : ""}
        ${followingUpdated > 0 ? `${followingUpdated} following` : ""}
      </p>
    </div>
    <button class="notification-close">×</button>
  `;

  document.body.appendChild(notification);

  // add style for the notification if it doesn't exist yet
  if (!document.getElementById("username-notification-style")) {
    const style = document.createElement("style");
    style.id = "username-notification-style";
    style.textContent = `
      .username-update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: white;
        border-left: 4px solid #58cc02;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        border-radius: 4px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1000;
        animation: slide-in 0.3s ease-out;
        max-width: 300px;
      }
      
      @keyframes slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      .notification-icon {
        flex-shrink: 0;
      }
      
      .notification-content {
        flex-grow: 1;
      }
      
      .notification-content p {
        margin: 0;
        font-size: 14px;
      }
      
      .notification-details {
        font-size: 12px !important;
        color: #666;
        margin-top: 4px !important;
      }
      
      .notification-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
        padding: 0;
        margin: 0;
        line-height: 1;
      }
    `;
    document.head.appendChild(style);
  }

  // close notification when clicking the close button
  const closeButton = notification.querySelector(".notification-close");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      notification.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      setTimeout(() => {
        notification.remove();
      }, 300);
    });
  }

  // close automatically after 5 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      notification.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.remove();
        }
      }, 300);
    }
  }, 5000);
}
