/**
 * Create a loading UI element
 * @returns {HTMLElement} The loading container element
 */
export function createLoadingUI() {
  const loadingContainer = document.createElement("div");
  loadingContainer.className = "loading-container";
  loadingContainer.innerHTML = `
    <div class="loading-logo">
      <img src="icons/icon48.png" alt="Duolingo Followers Manager" class="loading-icon pulse">
    </div>
    <h3 class="loading-title">Loading Duolingo Data</h3>
    <p id="loading-message">Connecting to Duolingo...</p>
    <div class="progress-bar-container">
      <div id="progress-bar" class="progress-bar"></div>
    </div>
    <div class="loading-steps">
      <div class="loading-step" id="step-connect">
        <span class="step-indicator"></span>
        <span class="step-text">Connecting</span>
      </div>
      <div class="loading-step" id="step-followers">
        <span class="step-indicator"></span>
        <span class="step-text">Loading followers</span>
      </div>
      <div class="loading-step" id="step-following">
        <span class="step-indicator"></span>
        <span class="step-text">Loading following</span>
      </div>
      <div class="loading-step" id="step-dates">
        <span class="step-indicator"></span>
        <span class="step-text">Processing dates</span>
      </div>
    </div>
  `;

  return loadingContainer;
}

/**
 * Create an error UI element
 * @param {Error} error - The error that occurred
 * @returns {HTMLElement} The error container element
 */
export function createErrorUI(error) {
  const errorContainer = document.createElement("div");
  errorContainer.className = "error-container";
  errorContainer.innerHTML = `
    <div class="error-icon">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#ff4b4b" stroke-width="2"/>
        <path d="M12 7v6" stroke="#ff4b4b" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="16" r="1" fill="#ff4b4b"/>
      </svg>
    </div>
    <h3 class="error-title">Connection Error</h3>
    <p class="error-message">${
      error.message || "Could not connect to Duolingo API."
    }</p>
    <div class="error-help">
      <p>Suggestions:</p>
      <ul>
        <li>Make sure you are logged in to <a href="https://www.duolingo.com" target="_blank">Duolingo.com</a>.</li>
        <li>Try refreshing the Duolingo page and then open the extension again.</li>
        <li>Check your internet connection.</li>
      </ul>
    </div>
    <button id="retry-button">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"></path>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
        <path d="M3 22v-6h6"></path>
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
      </svg>
      Try Again
    </button>
  `;

  // Add retry button functionality
  setTimeout(() => {
    const retryButton = document.getElementById("retry-button");
    if (retryButton) {
      retryButton.addEventListener("click", () => {
        window.location.reload();
      });
    }
  }, 0);

  return errorContainer;
}

/**
 * Update the loading step indicators
 * @param {string} step - The current step
 * @param {boolean} isComplete - Whether the step is complete
 */
export function updateLoadingStep(step, isComplete = false) {
  const steps = {
    connect: "step-connect",
    followers: "step-followers",
    following: "step-following",
    dates: "step-dates",
  };

  // Reset all steps
  Object.values(steps).forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.remove("active", "complete");
    }
  });

  // Mark previous steps as complete
  const stepKeys = Object.keys(steps);
  const currentIndex = stepKeys.indexOf(step);

  for (let i = 0; i <= currentIndex; i++) {
    const stepId = steps[stepKeys[i]];
    const element = document.getElementById(stepId);
    if (element) {
      if (i < currentIndex || isComplete) {
        element.classList.add("complete");
      } else {
        element.classList.add("active");
      }
    }
  }
}
