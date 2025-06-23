/**
 * Display a notification about username updates
 *
 * @param {number} followersUpdated - Number of followers with updated usernames
 * @param {number} followingUpdated - Number of following users with updated usernames
 */
export function showUsernameUpdateNotification(
  followersUpdated,
  followingUpdated
) {
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

  // Add style for notification if it doesn't exist yet
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

  // Close notification when clicking the close button
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

  // Close automatically after 5 seconds
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
