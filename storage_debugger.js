/**
 * Script to view and manage extension storage data
 */

// Global variable to store current sort state
let currentSort = {
  column: "timestamp", // Default sort by timestamp
  direction: "desc", // Default direction
};

// Add filter state object
let currentFilters = {
  dateFrom: null,
  dateTo: null,
  followStatus: "all",
  plusStatus: "all",
  streakFrom: null,
  streakTo: null,
  xpFrom: null,
  xpTo: null,
};

// Function to format a date as a readable string
function formatDate(timestamp) {
  if (!timestamp) return "N/A";

  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

// Function to display storage data
async function displayStorageData() {
  try {
    const result = await chrome.storage.local.get([
      "followDates",
      "userDetails",
    ]);
    const followDates = result.followDates || { followers: {}, following: {} };
    const userDetails = result.userDetails || {};

    const container = document.getElementById("storage-data");
    if (!container) return;

    // Clear previous content
    container.innerHTML = "";

    // Get unique users from both following and followers
    const uniqueUsers = new Set([
      ...Object.keys(followDates.following),
      ...Object.keys(followDates.followers),
    ]);

    // Show counts and filters section
    const statsAndFilters = document.createElement("div");
    statsAndFilters.className = "stats-and-filters";

    // Create counts section
    const countInfo = document.createElement("div");
    countInfo.className = "storage-counts";

    // Get filtered count if filters are active
    const usersArray = Array.from(uniqueUsers).map((userId) => {
      const followingData = followDates.following[userId];
      const followerData = followDates.followers[userId];
      const details = userDetails[userId] || {};
      const username =
        (followingData && followingData.username) ||
        (followerData && followerData.username) ||
        "Unknown";

      return {
        userId,
        username,
        following: !!followingData,
        follower: !!followerData,
        timestamp: Math.max(
          followingData
            ? typeof followingData === "object"
              ? followingData.timestamp
              : followingData
            : 0,
          followerData
            ? typeof followerData === "object"
              ? followerData.timestamp
              : followerData
            : 0
        ),
        followersCount: details.followersCount || 0,
        followingCount: details.followingCount || 0,
        streak: details.streak !== undefined ? details.streak : -1,
        totalXp: details.totalXp || 0,
        plus: details.hasPlus || false,
        lastUpdated: details.lastUpdated || 0,
        details,
      };
    });

    const filteredUsers = usersArray.filter(applyFilters);
    const followingCount = Object.keys(followDates.following).length;
    const followersCount = Object.keys(followDates.followers).length;
    const uniqueCount = uniqueUsers.size;
    const filteredCount = filteredUsers.length;

    countInfo.innerHTML = `
      <p><strong>Total Unique Users:</strong> ${uniqueCount}</p>
      <p><strong>Filtered Users:</strong> ${filteredCount} of ${uniqueCount} users</p>
      <p><strong>Following:</strong> ${followingCount} users</p>
      <p><strong>Followers:</strong> ${followersCount} users</p>
    `;

    // Create filters section
    const filtersSection = document.createElement("div");
    filtersSection.className = "filters-section";
    filtersSection.innerHTML = `
      <div class="filters-header">
        <h3 class="filters-title">Filter Users</h3>
        <div class="filter-actions">
          <button id="apply-filters" class="filter-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Apply Filters
          </button>
          <button id="reset-filters" class="filter-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 0 1-9 9"></path>
              <path d="M3 12a9 9 0 0 1 9-9"></path>
              <path d="M21 12c0-4.97-4.03-9-9-9"></path>
              <path d="M3 12c0 4.97 4.03 9 9 9"></path>
            </svg>
            Reset
          </button>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-group">
          <label>Date Range</label>
          <div class="filter-group-row">
            <input type="date" id="date-from" placeholder="From">
            <input type="date" id="date-to" placeholder="To">
          </div>
        </div>
        <div class="filter-group">
          <label>Follow Status</label>
          <select id="follow-status">
            <option value="all">All Users</option>
            <option value="mutual">Mutual Follows</option>
            <option value="following">Following Only</option>
            <option value="followers">Followers Only</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Plus Status</label>
          <select id="plus-status">
            <option value="all">All Users</option>
            <option value="plus">Plus Users</option>
            <option value="non-plus">Non-Plus Users</option>
          </select>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-group">
          <label>Streak Range</label>
          <div class="filter-group-row">
            <input type="number" id="streak-from" placeholder="Min" min="0">
            <input type="number" id="streak-to" placeholder="Max" min="0">
          </div>
        </div>
        <div class="filter-group">
          <label>XP Range</label>
          <div class="filter-group-row">
            <input type="number" id="xp-from" placeholder="Min" min="0">
            <input type="number" id="xp-to" placeholder="Max" min="0">
          </div>
        </div>
        <div class="filter-group">
          <label>&nbsp;</label>
          <div class="filter-group-row">
            <!-- Placeholder for future filters -->
          </div>
        </div>
      </div>
    `;

    // Add event listeners for filter buttons
    filtersSection
      .querySelector("#apply-filters")
      .addEventListener("click", updateFilters);
    filtersSection
      .querySelector("#reset-filters")
      .addEventListener("click", resetFilters);

    // Set current filter values
    if (currentFilters.dateFrom)
      filtersSection.querySelector("#date-from").value =
        currentFilters.dateFrom;
    if (currentFilters.dateTo)
      filtersSection.querySelector("#date-to").value = currentFilters.dateTo;
    filtersSection.querySelector("#follow-status").value =
      currentFilters.followStatus;
    filtersSection.querySelector("#plus-status").value =
      currentFilters.plusStatus;
    if (currentFilters.streakFrom)
      filtersSection.querySelector("#streak-from").value =
        currentFilters.streakFrom;
    if (currentFilters.streakTo)
      filtersSection.querySelector("#streak-to").value =
        currentFilters.streakTo;
    if (currentFilters.xpFrom)
      filtersSection.querySelector("#xp-from").value = currentFilters.xpFrom;
    if (currentFilters.xpTo)
      filtersSection.querySelector("#xp-to").value = currentFilters.xpTo;

    statsAndFilters.appendChild(countInfo);
    statsAndFilters.appendChild(filtersSection);
    container.appendChild(statsAndFilters);

    // Create merged table if there's data
    if (uniqueUsers.size > 0) {
      container.appendChild(
        createDataTable("User Relationships", followDates, userDetails)
      );
    } else {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "empty-data";
      emptyMessage.textContent =
        "No date data stored yet. Try following someone or being followed by someone to start recording dates.";
      container.appendChild(emptyMessage);
    }
  } catch (error) {
    console.error("Error displaying storage data:", error);
    const container = document.getElementById("storage-data");
    if (container) {
      container.innerHTML = `<p class="error">Error loading data: ${error.message}</p>`;
    }
  }
}

// Function to create a table with data
function createDataTable(title, followDates, userDetails) {
  const section = document.createElement("div");
  section.className = "storage-section";

  const sectionTitle = document.createElement("h3");
  sectionTitle.textContent = title;
  section.appendChild(sectionTitle);

  const table = document.createElement("table");
  table.className = "storage-table";

  // Table header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  // Define headers with their corresponding sort keys
  const headers = [
    { text: "User ID", key: "userId" },
    { text: "Username", key: "username" },
    { text: "You Follow", key: "following" },
    { text: "Follows You", key: "follower" },
    { text: "First Interaction", key: "timestamp" },
    { text: "Followers Count", key: "followersCount" },
    { text: "Following Count", key: "followingCount" },
    { text: "Streak", key: "streak" },
    { text: "Total XP", key: "totalXp" },
    { text: "Plus", key: "plus" },
    { text: "Details Last Updated", key: "lastUpdated" },
    { text: "Actions", key: null }, // No sorting for actions
  ];

  headers.forEach((header) => {
    const th = document.createElement("th");
    th.innerHTML = `${header.text} ${
      header.key ? '<span class="sort-indicator"></span>' : ""
    }`;

    if (header.key) {
      th.style.cursor = "pointer";
      th.style.width = "min-content";
      th.addEventListener("click", () => {
        // Toggle direction if same column, otherwise default to ascending
        if (currentSort.column === header.key) {
          currentSort.direction =
            currentSort.direction === "asc" ? "desc" : "asc";
        } else {
          currentSort.column = header.key;
          currentSort.direction = "asc";
        }

        // Update sort indicators
        document.querySelectorAll(".sort-indicator").forEach((indicator) => {
          indicator.textContent = "";
        });
        const indicator = th.querySelector(".sort-indicator");
        indicator.textContent = currentSort.direction === "asc" ? " ↑" : " ↓";

        // Resort and rebuild table body
        rebuildTableBody(tbody, followDates, userDetails, currentSort);
      });

      // Set initial sort indicator if this is the current sort column
      if (header.key === currentSort.column) {
        const indicator = th.querySelector(".sort-indicator");
        indicator.textContent = currentSort.direction === "asc" ? " ↑" : " ↓";
      }
    }

    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Table body
  const tbody = document.createElement("tbody");
  rebuildTableBody(tbody, followDates, userDetails, currentSort);

  table.appendChild(tbody);
  section.appendChild(table);

  return section;
}

// Function to apply filters to user data
function applyFilters(userData) {
  // Date range filter
  if (currentFilters.dateFrom || currentFilters.dateTo) {
    const userDate = new Date(userData.timestamp);
    if (currentFilters.dateFrom && userDate < new Date(currentFilters.dateFrom))
      return false;
    if (currentFilters.dateTo && userDate > new Date(currentFilters.dateTo))
      return false;
  }

  // Follow status filter
  if (currentFilters.followStatus !== "all") {
    switch (currentFilters.followStatus) {
      case "mutual":
        if (!(userData.following && userData.follower)) return false;
        break;
      case "following":
        if (!userData.following || userData.follower) return false;
        break;
      case "followers":
        if (!userData.follower || userData.following) return false;
        break;
    }
  }

  // Plus status filter
  if (currentFilters.plusStatus !== "all") {
    if (currentFilters.plusStatus === "plus" && !userData.plus) return false;
    if (currentFilters.plusStatus === "non-plus" && userData.plus) return false;
  }

  // Streak range filter
  if (
    currentFilters.streakFrom !== null &&
    userData.streak < currentFilters.streakFrom
  )
    return false;
  if (
    currentFilters.streakTo !== null &&
    userData.streak > currentFilters.streakTo
  )
    return false;

  // XP range filter
  if (
    currentFilters.xpFrom !== null &&
    userData.totalXp < currentFilters.xpFrom
  )
    return false;
  if (currentFilters.xpTo !== null && userData.totalXp > currentFilters.xpTo)
    return false;

  return true;
}

// Function to update filters and refresh table
function updateFilters() {
  currentFilters = {
    dateFrom: document.getElementById("date-from").value || null,
    dateTo: document.getElementById("date-to").value || null,
    followStatus: document.getElementById("follow-status").value,
    plusStatus: document.getElementById("plus-status").value,
    streakFrom: document.getElementById("streak-from").value
      ? parseInt(document.getElementById("streak-from").value)
      : null,
    streakTo: document.getElementById("streak-to").value
      ? parseInt(document.getElementById("streak-to").value)
      : null,
    xpFrom: document.getElementById("xp-from").value
      ? parseInt(document.getElementById("xp-from").value)
      : null,
    xpTo: document.getElementById("xp-to").value
      ? parseInt(document.getElementById("xp-to").value)
      : null,
  };
  displayStorageData();
}

// Function to reset filters
function resetFilters() {
  document.getElementById("date-from").value = "";
  document.getElementById("date-to").value = "";
  document.getElementById("follow-status").value = "all";
  document.getElementById("plus-status").value = "all";
  document.getElementById("streak-from").value = "";
  document.getElementById("streak-to").value = "";
  document.getElementById("xp-from").value = "";
  document.getElementById("xp-to").value = "";

  currentFilters = {
    dateFrom: null,
    dateTo: null,
    followStatus: "all",
    plusStatus: "all",
    streakFrom: null,
    streakTo: null,
    xpFrom: null,
    xpTo: null,
  };

  displayStorageData();
}

// Function to rebuild table body with sorted data
function rebuildTableBody(tbody, followDates, userDetails, sort) {
  // Clear existing rows
  tbody.innerHTML = "";

  // Get unique users and their data
  const uniqueUsers = new Set([
    ...Object.keys(followDates.following),
    ...Object.keys(followDates.followers),
  ]);

  // Convert to array with all necessary data for sorting
  const usersArray = Array.from(uniqueUsers).map((userId) => {
    const followingData = followDates.following[userId];
    const followerData = followDates.followers[userId];
    const details = userDetails[userId] || {};
    const username =
      (followingData && followingData.username) ||
      (followerData && followerData.username) ||
      "Unknown";

    return {
      userId,
      username,
      following: !!followingData,
      follower: !!followerData,
      timestamp: Math.max(
        followingData
          ? typeof followingData === "object"
            ? followingData.timestamp
            : followingData
          : 0,
        followerData
          ? typeof followerData === "object"
            ? followerData.timestamp
            : followerData
          : 0
      ),
      followersCount: details.followersCount || 0,
      followingCount: details.followingCount || 0,
      streak: details.streak !== undefined ? details.streak : -1,
      totalXp: details.totalXp || 0,
      plus: details.hasPlus || false,
      lastUpdated: details.lastUpdated || 0,
      followingData,
      followerData,
      details,
    };
  });

  // Sort the array based on current sort settings
  usersArray.sort((a, b) => {
    let comparison = 0;

    switch (sort.column) {
      case "userId":
      case "username":
        comparison = String(a[sort.column]).localeCompare(
          String(b[sort.column])
        );
        break;
      case "following":
      case "follower":
      case "plus":
        comparison =
          a[sort.column] === b[sort.column] ? 0 : a[sort.column] ? -1 : 1;
        break;
      case "timestamp":
      case "streak":
      case "totalXp":
      case "lastUpdated":
      case "followersCount":
      case "followingCount":
        comparison = a[sort.column] - b[sort.column];
        break;
      default:
        comparison = 0;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });

  // Apply filters to usersArray before creating table rows
  const filteredUsers = usersArray.filter(applyFilters);

  // Update the counts display
  const countInfo = document.querySelector(".storage-counts");
  if (countInfo) {
    const totalUnique = uniqueUsers.size;
    const filteredCount = filteredUsers.length;
    countInfo.innerHTML = `
      <p><strong>Total Unique Users:</strong> ${totalUnique}</p>
      <p><strong>Filtered Users:</strong> ${filteredCount} of ${totalUnique} users</p>
      <p><strong>Following:</strong> ${
        Object.keys(followDates.following).length
      } users</p>
      <p><strong>Followers:</strong> ${
        Object.keys(followDates.followers).length
      } users</p>
    `;
  }

  // Create table rows with filtered and sorted data
  filteredUsers.forEach((userData) => {
    const row = document.createElement("tr");

    // User ID
    const idCell = document.createElement("td");
    idCell.textContent = userData.userId;
    row.appendChild(idCell);

    // Username
    const usernameCell = document.createElement("td");
    usernameCell.textContent = userData.username;
    row.appendChild(usernameCell);

    // Following Status
    const followingCell = document.createElement("td");
    followingCell.className = "status-cell";
    followingCell.textContent = userData.following ? "✓" : "✗";
    followingCell.classList.add(
      userData.following ? "following" : "not-following"
    );
    row.appendChild(followingCell);

    // Follower Status
    const followerCell = document.createElement("td");
    followerCell.className = "status-cell";
    followerCell.textContent = userData.follower ? "✓" : "✗";
    followerCell.classList.add(
      userData.follower ? "following" : "not-following"
    );
    row.appendChild(followerCell);

    // First Interaction
    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(userData.timestamp);
    row.appendChild(dateCell);

    // Followers Count
    const followersCountCell = document.createElement("td");
    followersCountCell.textContent = userData.details.followersCount || "N/A";
    if (!userData.details.followersCount)
      followersCountCell.className = "no-details";
    row.appendChild(followersCountCell);

    // Following Count
    const followingCountCell = document.createElement("td");
    followingCountCell.textContent = userData.details.followingCount || "N/A";
    if (!userData.details.followingCount)
      followingCountCell.className = "no-details";
    row.appendChild(followingCountCell);

    // Streak
    const streakCell = document.createElement("td");
    streakCell.textContent = userData.streak === -1 ? "N/A" : userData.streak;
    if (userData.streak === -1) streakCell.className = "no-details";
    row.appendChild(streakCell);

    // Total XP
    const xpCell = document.createElement("td");
    xpCell.textContent = userData.totalXp
      ? userData.totalXp.toLocaleString()
      : "N/A";
    if (!userData.totalXp) xpCell.className = "no-details";
    row.appendChild(xpCell);

    // Plus
    const plusCell = document.createElement("td");
    if (userData.details) {
      plusCell.textContent = userData.plus ? "✓" : "✗";
    } else {
      plusCell.textContent = "No details available";
      plusCell.className = "no-details";
    }
    row.appendChild(plusCell);

    // Last Updated
    const lastUpdatedCell = document.createElement("td");
    if (userData.lastUpdated) {
      const daysAgo =
        (Date.now() - userData.lastUpdated) / (1000 * 60 * 60 * 24);
      lastUpdatedCell.textContent = formatDate(userData.lastUpdated);
      lastUpdatedCell.classList.add(
        daysAgo <= 7 ? "recent-update" : "old-update"
      );
    } else {
      lastUpdatedCell.textContent = "Never";
      lastUpdatedCell.className = "no-details";
    }
    row.appendChild(lastUpdatedCell);

    // Actions
    const actionsCell = document.createElement("td");
    const updateButton = document.createElement("button");
    updateButton.className = "update-details-button";
    updateButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"></path>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
        <path d="M3 22v-6h6"></path>
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
      </svg>
    `;
    updateButton.title = userData.details
      ? "Update user details"
      : "Fetch user details";

    updateButton.addEventListener("click", async () => {
      try {
        updateButton.disabled = true;
        updateButton.innerHTML = '<div class="mini-spinner"></div>';

        // Get user details
        const response = await new Promise((resolve) =>
          chrome.runtime.sendMessage(
            {
              action: "getUserDetails",
              userId: userData.userId,
            },
            resolve
          )
        );

        console.log("Response from getUserDetails:", response);

        if (response && response.details) {
          const result = await chrome.storage.local.get(["userDetails"]);
          const storedUserDetails = result.userDetails || {};
          storedUserDetails[userData.userId] = {
            ...response.details,
            lastUpdated: Date.now(),
          };

          console.log(
            "Storing user details:",
            storedUserDetails[userData.userId]
          );

          await chrome.storage.local.set({ userDetails: storedUserDetails });

          // Instead of rebuilding the entire table, just update this row
          const row = updateButton.closest("tr");
          updateUserRow(row, userData, storedUserDetails);
        } else {
          throw new Error("Failed to fetch user details");
        }
      } catch (error) {
        console.error("Error updating user details:", error);
        updateButton.innerHTML = "❌";
        updateButton.title = "Error: " + error.message;
        setTimeout(() => {
          updateButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
          `;
          updateButton.disabled = false;
        }, 2000);
      }
    });

    actionsCell.appendChild(updateButton);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });
}

// Function to update a single user row without rebuilding the entire table
function updateUserRow(row, userData, userDetails) {
  const details = userDetails[userData.userId] || {};
  console.log("Updating row with details:", details);

  // Update cells that might have changed
  row.children[5].textContent =
    details.followersCount !== undefined ? details.followersCount : "N/A"; // Followers Count
  if (details.followersCount === undefined)
    row.children[5].className = "no-details";
  else row.children[5].className = "";

  row.children[6].textContent =
    details.followingCount !== undefined ? details.followingCount : "N/A"; // Following Count
  if (details.followingCount === undefined)
    row.children[6].className = "no-details";
  else row.children[6].className = "";

  row.children[7].textContent =
    details.streak !== undefined ? details.streak : "N/A"; // Streak
  if (details.streak === undefined) row.children[7].className = "no-details";
  else row.children[7].className = "";

  row.children[8].textContent = details.totalXp
    ? details.totalXp.toLocaleString()
    : "N/A"; // Total XP
  if (!details.totalXp) row.children[8].className = "no-details";
  else row.children[8].className = "";

  row.children[9].textContent = details.hasPlus ? "✓" : "✗"; // Plus
  row.children[9].className = details ? "" : "no-details";

  // Last Updated
  const lastUpdatedCell = row.children[10];
  if (details.lastUpdated) {
    const daysAgo = (Date.now() - details.lastUpdated) / (1000 * 60 * 60 * 24);
    lastUpdatedCell.textContent = formatDate(details.lastUpdated);
    lastUpdatedCell.className = daysAgo <= 7 ? "recent-update" : "old-update";
  } else {
    lastUpdatedCell.textContent = "Never";
    lastUpdatedCell.className = "no-details";
  }

  // Update the update button
  const updateButton = row.children[11].querySelector(".update-details-button");
  updateButton.disabled = false;
  updateButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 2v6h-6"></path>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
      <path d="M3 22v-6h6"></path>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
    </svg>
  `;
  updateButton.title = "Update user details";
}

// Add some CSS styles for the no-details class, update button and status cells
const style = document.createElement("style");
style.textContent = `
  .no-details {
    color: #999;
    font-style: italic;
  }
  
  .update-details-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1cb0f6;
    transition: all 0.2s ease;
  }
  
  .update-details-button:hover {
    background-color: #e7f5ff;
  }
  
  .update-details-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .update-details-button .mini-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(28, 176, 246, 0.3);
    border-radius: 50%;
    border-top-color: #1cb0f6;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .status-cell {
    text-align: center;
    font-weight: bold;
  }
  
  .status-cell.following {
    color: #58cc02;
  }
  
  .status-cell.not-following {
    color: #ff4b4b;
  }
  
  .recent-update {
    color: #000000;
  }
  
  .old-update {
    color: #1cb0f6;
  }

  .storage-table {
    position: relative;
    border-collapse: collapse;
    width: 100%;
  }

  .storage-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: white;
  }

  .storage-table th {
    padding: 12px;
    text-align: left;
    border-bottom: 2px solid #e5e5e5;
    background: white;
    box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.1);
    user-select: none;
  }

  .storage-table th[style*="cursor: pointer"]:hover {
    background-color: #f5f9ff;
  }

  .storage-table td {
    padding: 12px;
    border-bottom: 1px solid #e5e5e5;
  }

  .storage-table tbody tr:hover {
    background-color: #f5f9ff;
  }

  .sort-indicator {
    display: inline-block;
    margin-left: 4px;
    color: #1cb0f6;
    font-weight: bold;
  }

  .storage-table th[style*="cursor: pointer"] {
    position: relative;
  }

  .storage-table th[style*="cursor: pointer"]:after {
    content: '';
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 4px solid #ddd;
    opacity: 0.3;
  }

  .storage-table th[style*="cursor: pointer"]:hover:after {
    opacity: 1;
    border-bottom-color: #1cb0f6;
  }
`;
document.head.appendChild(style);

// Function to clear all storage data
async function clearAllStorageData() {
  if (
    confirm(
      "Are you sure you want to clear all follow date data? This action cannot be undone."
    )
  ) {
    try {
      await chrome.storage.local.set({
        followDates: {
          followers: {},
          following: {},
        },
      });

      displayStorageData();
      alert("Storage data cleared successfully!");
    } catch (error) {
      console.error("Error clearing data:", error);
      alert(`Error clearing data: ${error.message}`);
    }
  }
}

// Function to export storage data to a JSON file
async function exportStorageData() {
  try {
    const result = await chrome.storage.local.get(["followDates"]);
    const followDates = result.followDates || { followers: {}, following: {} };

    // Add extra information to the exported file
    const exportData = {
      followDates: followDates,
      exportDate: new Date().toISOString(),
      version: "1.1",
      description: "Duolingo Followers & Following Manager - Exported Data",
    };

    // Convert to formatted JSON string
    const jsonString = JSON.stringify(exportData, null, 2);

    // Create a blob and a download link
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create a temporary download link and click it
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `duolingo-follow-dates-${formatDateForFilename(
      new Date()
    )}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error("Error exporting data:", error);
    alert(`Error exporting data: ${error.message}`);
  }
}

// Function to import data from a JSON file
function importStorageData() {
  // Create a temporary file input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";

  fileInput.addEventListener("change", async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      // Read the file as text
      const fileContent = await readFileAsText(file);

      // Parse the JSON
      const importedData = JSON.parse(fileContent);

      // Verify the file has the expected format
      if (
        !importedData.followDates ||
        typeof importedData.followDates !== "object" ||
        !importedData.followDates.followers ||
        !importedData.followDates.following
      ) {
        throw new Error(
          "Invalid file format. The file does not contain valid follow date data."
        );
      }

      // Ask if user wants to replace or merge
      const action = confirm(
        "How do you want to import the data?\n\n" +
          "OK = REPLACE (deletes all existing data and uses only the file data)\n" +
          "CANCEL = MERGE (keeps existing data and adds the file data)"
      );

      // Get current data if merging
      let currentData = { followers: {}, following: {} };
      if (!action) {
        // If chose to merge
        const result = await chrome.storage.local.get(["followDates"]);
        currentData = result.followDates || { followers: {}, following: {} };
      }

      // Ensure imported data is in the correct format (with username)
      const processedData = {
        followers: {},
        following: {},
      };

      // Process followers
      Object.entries(importedData.followDates.followers).forEach(
        ([userId, data]) => {
          if (typeof data === "object" && data.timestamp) {
            // New format
            processedData.followers[userId] = {
              timestamp: data.timestamp,
              username: data.username || "Unknown",
            };
          } else if (typeof data === "number") {
            // Old format (convert)
            processedData.followers[userId] = {
              timestamp: data,
              username: "Unknown",
            };
          }
        }
      );

      // Process following
      Object.entries(importedData.followDates.following).forEach(
        ([userId, data]) => {
          if (typeof data === "object" && data.timestamp) {
            // New format
            processedData.following[userId] = {
              timestamp: data.timestamp,
              username: data.username || "Unknown",
            };
          } else if (typeof data === "number") {
            // Old format (convert)
            processedData.following[userId] = {
              timestamp: data,
              username: "Unknown",
            };
          }
        }
      );

      // Prepare data to save
      const newData = {
        followers: action
          ? { ...processedData.followers }
          : { ...currentData.followers, ...processedData.followers },
        following: action
          ? { ...processedData.following }
          : { ...currentData.following, ...processedData.following },
      };

      // Save the data
      await chrome.storage.local.set({ followDates: newData });

      // Update the display
      await displayStorageData();

      // Success message
      const followersCount = Object.keys(
        importedData.followDates.followers
      ).length;
      const followingCount = Object.keys(
        importedData.followDates.following
      ).length;

      alert(
        `Import completed successfully!\n\n` +
          `Imported data:\n` +
          `- Followers: ${followersCount}\n` +
          `- Following: ${followingCount}\n\n` +
          `Method: ${action ? "Replacement" : "Merge"}`
      );
    } catch (error) {
      console.error("Error importing data:", error);
      alert(`Error importing data: ${error.message}`);
    }
  });

  // Simulate a click on the input
  fileInput.click();
}

// Helper function to read a file as text
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error("Error reading file"));
    reader.readAsText(file);
  });
}

// Helper function to format date for filename
function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Function to update usernames
async function updateUsernames() {
  try {
    const updateButton = document.getElementById("update-usernames");
    const statusElement = document.getElementById("update-status");

    if (!updateButton || !statusElement) return;

    // Disable button during update
    updateButton.disabled = true;
    updateButton.innerHTML = `
      <div class="mini-spinner"></div>
      Updating Usernames...
    `;

    statusElement.innerHTML = `<p>Starting update process. This may take a moment...</p>`;
    statusElement.className = "update-status in-progress";

    // Call the background function to update usernames
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "updateStoredUsernames",
        },
        resolve
      );
    });

    if (result.error) {
      throw new Error(result.error);
    }

    // Show success message
    statusElement.innerHTML = `
      <div class="success-icon">✓</div>
      <p>Successfully updated ${result.followersUpdated} follower(s) and ${result.followingUpdated} following user(s).</p>
      <p class="note">Note: Usernames are now automatically updated during normal extension usage. This button is only needed for manual updates.</p>
    `;
    statusElement.className = "update-status success";

    // Re-enable button
    updateButton.disabled = false;
    updateButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"></path>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
        <path d="M3 22v-6h6"></path>
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
      </svg>
      Update Usernames
    `;

    // Refresh the display to show updated usernames
    await displayStorageData();
  } catch (error) {
    console.error("Error updating usernames:", error);

    const statusElement = document.getElementById("update-status");
    if (statusElement) {
      statusElement.innerHTML = `
        <div class="error-icon">!</div>
        <p>Error updating usernames: ${error.message}</p>
        <p>Please make sure you are logged in to Duolingo and try again.</p>
      `;
      statusElement.className = "update-status error";
    }

    const updateButton = document.getElementById("update-usernames");
    if (updateButton) {
      updateButton.disabled = false;
      updateButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"></path>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
          <path d="M3 22v-6h6"></path>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
        </svg>
        Try Again
      `;
    }
  }
}

// Initialize the page when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  displayStorageData();

  // Add listeners for buttons
  const refreshButton = document.getElementById("refresh-storage");
  if (refreshButton) {
    refreshButton.addEventListener("click", displayStorageData);
  }

  const clearButton = document.getElementById("clear-storage");
  if (clearButton) {
    clearButton.addEventListener("click", clearAllStorageData);
  }

  // Add listeners for export and import buttons
  const exportButton = document.getElementById("export-storage");
  if (exportButton) {
    exportButton.addEventListener("click", exportStorageData);
  }

  const importButton = document.getElementById("import-storage");
  if (importButton) {
    importButton.addEventListener("click", importStorageData);
  }

  // Add listener for update usernames button
  const updateUsernamesButton = document.getElementById("update-usernames");
  if (updateUsernamesButton) {
    updateUsernamesButton.addEventListener("click", updateUsernames);
  }

  // Add listeners for filter buttons
  const applyFiltersButton = document.getElementById("apply-filters");
  if (applyFiltersButton) {
    applyFiltersButton.addEventListener("click", updateFilters);
  }

  const resetFiltersButton = document.getElementById("reset-filters");
  if (resetFiltersButton) {
    resetFiltersButton.addEventListener("click", resetFilters);
  }
});
