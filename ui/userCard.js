import {
  getFollowerDate,
  getFollowingDate,
  removeFollowing,
} from "../follow_date_manager.js";
import { formatDate } from "../utils/dateUtils.js";
import { userDetailsCache } from "../services/userService.js";
import { updateNotFollowingBackCounter } from "../services/userService.js";

/**
 * Render user cards with optimized batch rendering
 *
 * @param {Array} users - List of users to render
 * @param {HTMLElement} container - Container to render cards into
 * @param {boolean} showUnfollowButton - Whether to show unfollow button
 * @param {Map} followerIds - Map of follower IDs
 * @param {Map} followingIds - Map of following IDs
 */
export async function renderUserCards(
  users,
  container,
  showUnfollowButton,
  followerIds,
  followingIds
) {
  container.innerHTML = "";

  if (users.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = showUnfollowButton
      ? "You are not following anyone."
      : "You have no followers.";
    container.appendChild(emptyMessage);
    return;
  }

  // Create document fragment for batch DOM operations
  const fragment = document.createDocumentFragment();

  // Number of users per batch
  const BATCH_SIZE = 20;

  // Function to process a batch of users
  async function processBatch(startIndex) {
    const endIndex = Math.min(startIndex + BATCH_SIZE, users.length);

    // Process users in current batch
    for (let i = startIndex; i < endIndex; i++) {
      const user = users[i];
      const card = createUserCard(
        user,
        showUnfollowButton,
        followerIds,
        followingIds
      );
      fragment.appendChild(card);
    }

    // Add fragment to container
    container.appendChild(fragment);

    // If there are more users, schedule next batch
    if (endIndex < users.length) {
      // Small delay to allow UI to respond
      setTimeout(() => {
        window.requestAnimationFrame(() => {
          processBatch(endIndex);
        });
      }, 10);
    }
  }

  // Start batch processing
  processBatch(0);
}

/**
 * Create a single user card
 *
 * @param {Object} user - User data
 * @param {boolean} showUnfollowButton - Whether to show unfollow button
 * @param {Map} followerIds - Map of follower IDs
 * @param {Map} followingIds - Map of following IDs
 * @returns {HTMLElement} The user card element
 */
export function createUserCard(
  user,
  showUnfollowButton,
  followerIds,
  followingIds
) {
  const card = document.createElement("div");
  card.className = "user-card";
  card.dataset.userId = user.userId;

  // Profile picture
  const picture = document.createElement("img");
  picture.className = "user-picture";
  picture.src = user.picture ? `${user.picture}/medium` : "";
  picture.alt = `${user.displayName}'s profile picture`;
  picture.crossOrigin = "anonymous";

  // Fallback for when the image doesn't load
  picture.onerror = function () {
    // Generate user initials
    const initials = user.displayName
      .split(" ")
      .map((name) => name.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2);

    // Create div with initials
    const avatarDiv = document.createElement("div");
    avatarDiv.className = "user-picture-fallback";
    avatarDiv.textContent = initials;

    // Generate color based on ID
    const hue = ((user.userId % 360) + 360) % 360;
    avatarDiv.style.backgroundColor = `hsl(${hue}, 70%, 65%)`;

    // Replace image with div
    card.insertBefore(avatarDiv, picture);
    card.removeChild(picture);
  };

  card.appendChild(picture);

  // Highlight users who aren't following back (in the "Following" tab)
  if (showUnfollowButton && !user.isFollowedBy) {
    card.classList.add("not-following-back");

    // Not following back indicator
    const notFollowingBadge = document.createElement("div");
    notFollowingBadge.className = "not-following-badge";
    notFollowingBadge.textContent = "Not following you";
    card.appendChild(notFollowingBadge);
  }

  // User info container
  const userInfo = document.createElement("div");
  userInfo.className = "user-info";
  card.appendChild(userInfo);

  // Display name
  const displayName = document.createElement("h3");
  displayName.className = "user-displayname";
  displayName.textContent = user.displayName;
  if (user.isVerified) {
    const verifiedBadge = document.createElement("span");
    verifiedBadge.className = "verified-badge";
    verifiedBadge.textContent = "✓";
    displayName.appendChild(verifiedBadge);
  }
  userInfo.appendChild(displayName);

  // Username
  const username = document.createElement("p");
  username.className = "user-username";

  // Create profile link
  const usernameLink = document.createElement("a");
  usernameLink.href = `https://www.duolingo.com/profile/${user.username}`;
  usernameLink.textContent = `@${user.username}`;
  usernameLink.target = "_blank"; // Open in new tab
  usernameLink.className = "username-link";

  // Add external link icon
  const linkIcon = document.createElement("span");
  linkIcon.className = "link-icon";
  linkIcon.innerHTML =
    ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  usernameLink.appendChild(linkIcon);

  // Prevent link click from propagating to the entire card
  usernameLink.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  username.appendChild(usernameLink);
  userInfo.appendChild(username);

  // XP
  const xp = document.createElement("p");
  xp.className = "user-xp";
  xp.textContent = `${user.totalXp.toLocaleString()} XP`;
  userInfo.appendChild(xp);

  // Container for follow date
  const followDateContainer = document.createElement("div");
  followDateContainer.className = "follow-date-container";
  userInfo.appendChild(followDateContainer);

  // Add follow date info asynchronously
  loadFollowDateInfo(user, showUnfollowButton, followDateContainer);

  // Container for additional information (to be loaded on demand)
  const additionalInfoContainer = document.createElement("div");
  additionalInfoContainer.className = "additional-info-container";
  additionalInfoContainer.style.display = "none";
  userInfo.appendChild(additionalInfoContainer);

  // Loading indicator
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "mini-loading-spinner";
  additionalInfoContainer.appendChild(loadingIndicator);

  // Expand/collapse button
  const expandButton = document.createElement("button");
  expandButton.className = "expand-button";
  expandButton.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 9L12 16L5 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  expandButton.title = "View more information";
  expandButton.dataset.expanded = "false";
  userInfo.appendChild(expandButton);

  // Toggle details on button click
  setupExpandButtonHandler(
    expandButton,
    additionalInfoContainer,
    user,
    loadingIndicator
  );

  // Mutual follow status
  if (!showUnfollowButton && user.isFollowedBy && user.isFollowing) {
    const mutualBadge = document.createElement("span");
    mutualBadge.className = "mutual-badge";
    mutualBadge.textContent = "Mutual";
    mutualBadge.style.marginLeft = "10px";
    userInfo.appendChild(mutualBadge);
  }

  // Actions container
  const actionsContainer = document.createElement("div");
  actionsContainer.className = "actions-container";
  card.appendChild(actionsContainer);

  // Unfollow button (only for following tab)
  if (showUnfollowButton && user.isFollowing) {
    addUnfollowButton(actionsContainer, user, card, followerIds, followingIds);
  }

  // Follow button (for followers tab, users not being followed)
  if (!showUnfollowButton && !user.isFollowing) {
    addFollowButton(
      actionsContainer,
      user,
      userInfo,
      followerIds,
      followingIds
    );
  }

  return card;
}

/**
 * Load follow date information asynchronously
 *
 * @param {Object} user - User data
 * @param {boolean} showUnfollowButton - Whether to show unfollow button
 * @param {HTMLElement} userInfo - User info container
 */
async function loadFollowDateInfo(user, showUnfollowButton, userInfo) {
  try {
    let followDateInfo = null;
    if (showUnfollowButton) {
      // In the list of people you follow
      const followDateData = await getFollowingDate(user.userId);
      if (followDateData) {
        followDateInfo = document.createElement("div");
        followDateInfo.className = "follow-date-info";

        const followDate = new Date(followDateData.date);
        const now = new Date();
        const diffInMs = now - followDate;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        followDateInfo.textContent = `Following since: ${formatDate(
          followDateData.date
        )}`;

        if (diffInDays <= 7) {
          followDateInfo.style.color = "blue";
        }

        // Insert after XP but before additional-info-container and expand-button
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
    } else {
      // In the followers list
      const followerDateData = await getFollowerDate(user.userId);
      if (followerDateData) {
        followDateInfo = document.createElement("div");
        followDateInfo.className = "follow-date-info";

        const followDate = new Date(followerDateData.date);
        const now = new Date();
        const diffInMs = now - followDate;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        followDateInfo.textContent = `Following you since: ${formatDate(
          followerDateData.date
        )}`;

        if (diffInDays <= 7) {
          followDateInfo.style.color = "blue";
        }

        // Insert after XP but before additional-info-container and expand-button
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
  } catch (error) {
    console.error("Error loading follow date:", error);
  }
}

/**
 * Set up the expand button handler
 *
 * @param {HTMLElement} expandButton - The expand button
 * @param {HTMLElement} additionalInfoContainer - The container for additional info
 * @param {Object} user - User data
 * @param {HTMLElement} loadingIndicator - Loading indicator element
 */
function setupExpandButtonHandler(
  expandButton,
  additionalInfoContainer,
  user,
  loadingIndicator
) {
  expandButton.addEventListener("click", async (e) => {
    e.stopPropagation();

    const isExpanded = expandButton.dataset.expanded === "true";

    if (isExpanded) {
      // Collapse
      additionalInfoContainer.style.display = "none";
      expandButton.dataset.expanded = "false";
      expandButton.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 9L12 16L5 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      expandButton.title = "View more information";
    } else {
      // Expand
      additionalInfoContainer.style.display = "block";
      expandButton.dataset.expanded = "true";
      expandButton.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 15L12 8L19 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      expandButton.title = "Hide information";

      // Load additional info if not already loaded
      if (additionalInfoContainer.childElementCount <= 1) {
        try {
          // Check if user details are already in the cache
          let userDetails = null;
          const userId = user.userId.toString();

          if (userDetailsCache.has(userId)) {
            console.log(`Using cached details for user ${userId}`);
            userDetails = userDetailsCache.get(userId);
            // Remove loading indicator immediately
            loadingIndicator.remove();
          } else {
            // If not in cache, make the request
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
              userDetails = response.user;
              // Save to local cache for future use
              userDetailsCache.set(userId, userDetails);

              // Save user details to Chrome storage
              const result = await chrome.storage.local.get(["userDetails"]);
              const storedUserDetails = result.userDetails || {};
              storedUserDetails[userId] = {
                ...userDetails,
                lastUpdated: Date.now(),
              };
              await chrome.storage.local.set({
                userDetails: storedUserDetails,
              });
            }

            // Remove loading indicator
            loadingIndicator.remove();
          }

          if (userDetails) {
            // Adding streak in dropdown
            if (userDetails.streak !== undefined) {
              const streakContainer = document.createElement("div");
              streakContainer.className = "streak-container";

              const streakIcon = document.createElement("span");
              streakIcon.className = "streak-icon";
              streakIcon.innerHTML = "🔥";
              streakContainer.appendChild(streakIcon);

              const streakValue = document.createElement("span");
              streakValue.className = "streak-value";
              if (userDetails.streak === 0) {
                streakValue.classList.add("zero");
              }
              streakValue.textContent = userDetails.streak;
              streakContainer.appendChild(streakValue);

              // Add information about broken streak
              if (userDetails.streak === 0) {
                const streakWarning = document.createElement("span");
                streakWarning.className = "streak-warning";
                streakWarning.textContent = "(broken streak)";
                streakContainer.appendChild(streakWarning);

                // Don't add class to card, as the highlight is only shown in the dropdown
              }

              additionalInfoContainer.appendChild(streakContainer);
            }

            // Learning language
            if (userDetails.learningLanguage) {
              const languageInfo = document.createElement("p");
              languageInfo.className = "user-language";
              languageInfo.textContent = `Learning: ${userDetails.learningLanguage.toUpperCase()}`;
              additionalInfoContainer.appendChild(languageInfo);
            }

            // Plus
            if (userDetails.hasPlus) {
              const plusBadge = document.createElement("div");
              plusBadge.className = "plus-badge";
              plusBadge.textContent = "PLUS";
              additionalInfoContainer.appendChild(plusBadge);
            }

            // Creation date
            if (userDetails.creationDate) {
              const creationDate = new Date(userDetails.creationDate);
              const formattedDate = creationDate.toLocaleDateString();
              const joinDateInfo = document.createElement("p");
              joinDateInfo.className = "join-date";
              joinDateInfo.textContent = `Member since: ${formattedDate}`;
              additionalInfoContainer.appendChild(joinDateInfo);
            }

            // Limit to 3 courses to avoid overloading the interface
            const coursesToShow = userDetails.courses
              ? userDetails.courses.slice(0, 3)
              : [];

            // Courses
            if (userDetails.courses && userDetails.courses.length > 0) {
              const coursesContainer = document.createElement("div");
              coursesContainer.className = "courses-container";

              const coursesTitle = document.createElement("p");
              coursesTitle.className = "courses-title";
              coursesTitle.textContent = "Courses:";
              coursesContainer.appendChild(coursesTitle);

              const coursesList = document.createElement("ul");
              coursesList.className = "courses-list";

              coursesToShow.forEach((course) => {
                const courseItem = document.createElement("li");
                courseItem.className = "course-item";
                courseItem.textContent = `${course.fromLanguage} → ${course.learningLanguage} (${course.crowns} 👑)`;
                coursesList.appendChild(courseItem);
              });

              if (userDetails.courses.length > 3) {
                const moreCoursesItem = document.createElement("li");
                moreCoursesItem.className = "more-courses";
                moreCoursesItem.textContent = `+ ${
                  userDetails.courses.length - 3
                } more courses`;
                coursesList.appendChild(moreCoursesItem);
              }

              coursesContainer.appendChild(coursesList);
              additionalInfoContainer.appendChild(coursesContainer);
            }
          } else {
            // Error loading details
            const errorMessage = document.createElement("p");
            errorMessage.className = "details-error";
            errorMessage.textContent = "Error loading details";
            additionalInfoContainer.appendChild(errorMessage);
          }
        } catch (error) {
          console.error("Error loading user details:", error);

          // Show error message
          loadingIndicator.remove();

          const errorMessage = document.createElement("p");
          errorMessage.className = "details-error";
          errorMessage.textContent = "Error loading details";
          additionalInfoContainer.appendChild(errorMessage);
        }
      }
    }
  });
}

/**
 * Add unfollow button to user card
 *
 * @param {HTMLElement} actionsContainer - Container for actions
 * @param {Object} user - User data
 * @param {HTMLElement} card - User card element
 * @param {Map} followerIds - Map of follower IDs
 * @param {Map} followingIds - Map of following IDs
 */
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
        // Remove the following record
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

/**
 * Add follow button to user card
 *
 * @param {HTMLElement} actionsContainer - Container for actions
 * @param {Object} user - User data
 * @param {HTMLElement} userInfo - User info container
 * @param {Map} followerIds - Map of follower IDs
 * @param {Map} followingIds - Map of following IDs
 */
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
        // We don't need to call registerFollow here, as it's already done in background.js
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

        // Add follow date info, if available
        if (response.followInfo && response.followInfo.followDate) {
          // If there isn't already an element with follow date
          if (!userInfo.querySelector(".follow-date-info")) {
            const followDateInfo = document.createElement("div");
            followDateInfo.className = "follow-date-info";
            followDateInfo.textContent = `Following since: ${formatDate(
              response.followInfo.followDate
            )}`;

            // Insert in appropriate place
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
