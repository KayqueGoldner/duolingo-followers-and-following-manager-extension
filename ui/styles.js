// Function to add styles to the page
export function addStyles() {
  // Verify if styles have already been added to avoid duplication
  if (document.getElementById("extension-styles")) return;

  // Create a reference to the head tag
  const head = document.head || document.getElementsByTagName("head")[0];

  // Create the style element
  const style = document.createElement("style");
  style.id = "extension-styles";
  style.type = "text/css";

  // Add immediately to head to start processing
  head.appendChild(style);

  // Define styles
  style.textContent = `
    .extension-container {
      font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
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
      position: relative;
    }
    
    .progress-bar {
      height: 100%;
      width: 0%;
      background-color: #1cb0f6;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }
    
    .progress-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.3) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: progress-shine 1.5s infinite;
    }
    
    @keyframes progress-shine {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
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
      background: linear-gradient(to right,
        #e0e0e0 0%,
        #e0e0e0 var(--progress, 0%),
        #1cb0f6 var(--progress, 0%),
        #1cb0f6 100%
      );
      transition: all 0.3s ease;
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
      transform: scale(1.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .loading-step.active .step-text {
      color: #1cb0f6;
      font-weight: bold;
    }
    
    .loading-step.complete .step-indicator {
      background-color: #58cc02;
      border-color: #58cc02;
      transform: scale(1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
      background-color: #fff8f0;
      padding: 12px 16px;
      margin: 0;
      border-radius: 0;
      font-weight: 600;
      color: #ff9600;
      text-align: left;
      border: none;
      border-bottom: 1px solid #ffe4cc;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .not-following-counter svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
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
      align-items: center;
      padding: 16px 16px 0 16px;
      background: #ffffff;
      border-bottom: none;
      gap: 8px;
    }
    
    .tab-button {
      flex: 1;
      background: #f5f5f5;
      border: none;
      padding: 12px 20px;
      font-size: 15px;
      font-weight: 600;
      color: #666;
      cursor: pointer;
      transition: all 0.2s ease;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .tab-button.active {
      color: #ffffff;
      background: #1cb0f6;
      box-shadow: none;
    }
    
    .tab-button:hover:not(.active) {
      background: #eeeeee;
      color: #333;
    }
    
    .filter-container {
      margin: 0;
      padding: 16px;
      background: #ffffff;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .filter-button {
      background-color: #f5f5f5;
      color: #666;
      border: none;
      padding: 8px 16px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .filter-button:hover {
      background-color: #eeeeee;
      color: #333;
    }
    
    .filter-button:active {
      background-color: #e0e0e0;
    }
    
    .filter-button.active {
      background-color: #1cb0f6;
      color: #ffffff;
    }
    
    .users-container {
      max-height: 460px;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #fafafa;
      
      /* Improved scrollbar styling */
      scrollbar-width: thin;
      scrollbar-color: #1cb0f6 #f0f0f0;
    }
    
    .users-container::-webkit-scrollbar {
      width: 8px;
    }
    
    .users-container::-webkit-scrollbar-track {
      background: #f0f0f0;
      border-radius: 4px;
    }
    
    .users-container::-webkit-scrollbar-thumb {
      background: #1cb0f6;
      border-radius: 4px;
    }
    
    .users-container::-webkit-scrollbar-thumb:hover {
      background: #0095d8;
    }
    
    .empty-message {
      text-align: center;
      color: #666;
      padding: 32px;
      background: #ffffff;
      border-radius: 12px;
      margin: 16px;
      font-size: 15px;
      border: 1px dashed #ddd;
    }
    
    .user-card {
      display: flex;
      align-items: center;
      padding: 20px;
      border-radius: 16px;
      background: #ffffff;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      border: 1px solid #eee;
      gap: 16px;
    }
    
    .user-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      border-color: #ddd;
    }
    
    .user-card.unfollowed {
      opacity: 0.5;
      transform: translateX(100px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Style for users who don't follow back */
    .not-following-back {
      background: rgba(255, 150, 0, 0.05);
      border-left: 3px solid #ff9600;
    }
    
    .not-following-back:hover {
      background: rgba(255, 150, 0, 0.1);
    }
    
    .not-following-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      background: linear-gradient(45deg, #ff9600, #ff7a00);
      color: white;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(255, 150, 0, 0.2);
    }
    
    .streak-warning {
      color: #ff4b4b;
      font-size: 11px;
      margin-left: 8px;
      font-style: italic;
    }
    
    /* Highlight for zero streak in dropdown */
    .streak-value.zero {
      color: #ff4b4b;
    }
    
    .user-picture {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #f0f0f0;
      background-color: #f8f8f8;
      transition: all 0.2s ease;
    }
    
    .user-picture:hover {
      border-color: #1cb0f6;
      transform: scale(1.05);
    }
    
    .user-picture-fallback {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 2px solid #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: white;
      text-transform: uppercase;
      background: linear-gradient(45deg, #1cb0f6, #0095d8);
      transition: all 0.2s ease;
    }
    
    .user-picture-fallback:hover {
      transform: scale(1.05);
      border-color: #1cb0f6;
    }
    
    .user-info {
      flex: 1;
      min-width: 0;
    }
    
    .user-displayname {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
    }
    
    .verified-badge {
      background: linear-gradient(45deg, #1cb0f6, #0095d8);
      color: white;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      box-shadow: 0 2px 4px rgba(28, 176, 246, 0.2);
    }
    
    .user-username {
      margin: 0 0 6px 0;
      color: #666;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .username-link {
      text-decoration: none;
      color: #1cb0f6;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    
    .username-link:hover {
      color: #0095d8;
      text-decoration: none;
      transform: translateX(2px);
    }
    
    .link-icon {
      opacity: 0.7;
      transition: all 0.2s ease;
    }
    
    .username-link:hover .link-icon {
      opacity: 1;
      transform: translateX(2px);
    }
    
    .user-xp {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #ff9600;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .user-xp::before {
      content: '⭐';
      font-size: 14px;
    }
    
    .streak-container {
      display: flex;
      align-items: center;
      margin: 8px 0;
      gap: 6px;
    }
    
    .streak-icon {
      font-size: 16px;
    }
    
    .streak-value {
      font-weight: 600;
      color: #ff9600;
    }
    
    .mutual-badge {
      display: inline-flex;
      align-items: center;
      background: linear-gradient(45deg, #58cc02, #4caf50);
      color: white;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 600;
      gap: 4px;
      box-shadow: 0 2px 4px rgba(88, 204, 2, 0.2);
    }
    
    .mutual-badge::before {
      content: '🤝';
      font-size: 12px;
    }
    
    .actions-container {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    .unfollow-button {
      background: #fff;
      color: #ff4b4b;
      border: 1px solid #ff4b4b;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    
    .unfollow-button:hover {
      background: #fff1f0;
      transform: translateY(-1px);
    }
    
    .unfollow-button:active {
      transform: translateY(0);
    }
    
    .unfollow-button::before {
      content: '👋';
      font-size: 14px;
    }
    
    .follow-button {
      background: linear-gradient(45deg, #58cc02, #4caf50);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(88, 204, 2, 0.2);
    }
    
    .follow-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(88, 204, 2, 0.3);
    }
    
    .follow-button:active {
      transform: translateY(0);
    }
    
    .follow-button.followed {
      background: linear-gradient(45deg, #1cb0f6, #0095d8);
      box-shadow: 0 2px 4px rgba(28, 176, 246, 0.2);
    }
    
    .follow-button.followed:hover {
      box-shadow: 0 4px 8px rgba(28, 176, 246, 0.3);
    }
    
    .follow-button::before {
      content: '👋';
      font-size: 14px;
    }
    
    /* Styles for additional information */
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
    
    /* Style for follow date information */
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
    
    /* Styles for username update notification */
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
    
    .filter-info {
      font-size: 14px;
      color: #666;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .filter-count {
      font-weight: 600;
    }
    
    .filter-button svg {
      width: 16px;
      height: 16px;
      stroke-width: 2;
    }
    
    .tab-button svg {
      width: 16px;
      height: 16px;
      stroke-width: 2;
      opacity: 0.8;
    }
    
    .tab-button.active svg {
      opacity: 1;
    }

    /* Loading skeleton styles */
    .skeleton-card {
      display: flex;
      align-items: center;
      padding: 16px;
      border-radius: 12px;
      background: #ffffff;
      margin-bottom: 12px;
      position: relative;
      overflow: hidden;
    }

    .skeleton-card::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      transform: translateX(-100%);
      background-image: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0,
        rgba(255, 255, 255, 0.2) 20%,
        rgba(255, 255, 255, 0.5) 60%,
        rgba(255, 255, 255, 0)
      );
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      100% {
        transform: translateX(100%);
      }
    }

    .skeleton-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #f0f0f0;
      margin-right: 16px;
      flex-shrink: 0;
    }

    .skeleton-content {
      flex: 1;
    }

    .skeleton-line {
      height: 12px;
      background: #f0f0f0;
      border-radius: 6px;
      margin-bottom: 8px;
    }

    .skeleton-line.title {
      width: 40%;
      height: 16px;
    }

    .skeleton-line.subtitle {
      width: 60%;
    }

    .skeleton-line.text {
      width: 80%;
    }

    /* Improved progress bar styles */
    .progress-bar-container {
      width: 80%;
      height: 8px;
      background-color: #f3f3f3;
      border-radius: 4px;
      margin-top: 16px;
      margin-bottom: 24px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar {
      height: 100%;
      width: 0%;
      background-color: #1cb0f6;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .progress-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.3) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: progress-shine 1.5s infinite;
    }

    @keyframes progress-shine {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }

    /* Enhanced loading steps */
    .loading-steps::before {
      content: '';
      position: absolute;
      top: 12px;
      left: 18px;
      right: 18px;
      height: 2px;
      background: linear-gradient(to right,
        #e0e0e0 0%,
        #e0e0e0 var(--progress, 0%),
        #1cb0f6 var(--progress, 0%),
        #1cb0f6 100%
      );
      transition: all 0.3s ease;
      z-index: 0;
    }

    .loading-step.active .step-indicator {
      background-color: #1cb0f6;
      border-color: #1cb0f6;
      box-shadow: 0 0 0 4px rgba(28, 176, 246, 0.2);
      transform: scale(1.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .loading-step.complete .step-indicator {
      background-color: #58cc02;
      border-color: #58cc02;
      transform: scale(1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
  `;
}
