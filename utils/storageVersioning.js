/**
 * Storage versioning and migration system
 */

const CURRENT_STORAGE_VERSION = 2;
const STORAGE_VERSION_KEY = "storageVersion";

/**
 * Storage schema definitions
 */
const STORAGE_SCHEMAS = {
  1: {
    description: "Initial schema with basic follow dates",
    structure: {
      followDates: {
        followers: {}, // userId: timestamp
        following: {}, // userId: timestamp
      },
    },
  },
  2: {
    description: "Enhanced schema with usernames and metadata",
    structure: {
      followDates: {
        followers: {}, // userId: { timestamp, username, source }
        following: {}, // userId: { timestamp, username, source }
      },
      metadata: {
        version: 2,
        lastSync: null,
        syncStats: {
          totalSyncs: 0,
          lastSyncDuration: 0,
          averageSyncDuration: 0,
        },
      },
    },
  },
};

/**
 * Initialize storage with proper versioning
 */
export async function initializeVersionedStorage() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_VERSION_KEY,
      "followDates",
      "metadata",
    ]);
    const currentVersion = result[STORAGE_VERSION_KEY] || 1;

    console.log(
      `Current storage version: ${currentVersion}, Target version: ${CURRENT_STORAGE_VERSION}`
    );

    if (currentVersion < CURRENT_STORAGE_VERSION) {
      console.log("Storage migration required");
      await migrateStorage(currentVersion, CURRENT_STORAGE_VERSION, result);
    } else if (!result.followDates) {
      // Fresh installation
      await initializeFreshStorage();
    } else {
      console.log("Storage is up to date");
    }

    return true;
  } catch (error) {
    console.error("Error initializing versioned storage:", error);
    throw error;
  }
}

/**
 * Migrate storage from one version to another
 */
async function migrateStorage(fromVersion, toVersion, existingData) {
  console.log(`Migrating storage from version ${fromVersion} to ${toVersion}`);

  const migrationSteps = [];

  // Define migration steps
  if (fromVersion === 1 && toVersion >= 2) {
    migrationSteps.push(migrateV1ToV2);
  }

  let currentData = existingData;

  // Execute migrations sequentially
  for (const migrationStep of migrationSteps) {
    try {
      currentData = await migrationStep(currentData);
      console.log(`Migration step completed: ${migrationStep.name}`);
    } catch (error) {
      console.error(`Migration step failed: ${migrationStep.name}`, error);
      throw new Error(
        `Storage migration failed at step: ${migrationStep.name}`
      );
    }
  }

  // Update version
  await chrome.storage.local.set({
    [STORAGE_VERSION_KEY]: toVersion,
    ...currentData,
  });

  console.log("Storage migration completed successfully");
}

/**
 * Migrate from version 1 to version 2
 */
async function migrateV1ToV2(data) {
  const followDates = data.followDates || { followers: {}, following: {} };
  const migratedData = {
    followers: {},
    following: {},
  };

  // Migrate followers
  for (const [userId, timestampOrData] of Object.entries(
    followDates.followers
  )) {
    if (typeof timestampOrData === "number") {
      // Old format: just timestamp
      migratedData.followers[userId] = {
        timestamp: timestampOrData,
        username: "Unknown",
        source: "migration_v1",
      };
    } else if (typeof timestampOrData === "object") {
      // Partial new format: ensure all fields
      migratedData.followers[userId] = {
        timestamp: timestampOrData.timestamp || Date.now(),
        username: timestampOrData.username || "Unknown",
        source: timestampOrData.source || "migration_v1",
      };
    }
  }

  // Migrate following
  for (const [userId, timestampOrData] of Object.entries(
    followDates.following
  )) {
    if (typeof timestampOrData === "number") {
      // Old format: just timestamp
      migratedData.following[userId] = {
        timestamp: timestampOrData,
        username: "Unknown",
        source: "migration_v1",
      };
    } else if (typeof timestampOrData === "object") {
      // Partial new format: ensure all fields
      migratedData.following[userId] = {
        timestamp: timestampOrData.timestamp || Date.now(),
        username: timestampOrData.username || "Unknown",
        source: timestampOrData.source || "migration_v1",
      };
    }
  }

  return {
    followDates: migratedData,
    metadata: {
      version: 2,
      lastSync: null,
      syncStats: {
        totalSyncs: 0,
        lastSyncDuration: 0,
        averageSyncDuration: 0,
      },
      migrationHistory: [
        {
          fromVersion: 1,
          toVersion: 2,
          timestamp: Date.now(),
          recordsMigrated: {
            followers: Object.keys(migratedData.followers).length,
            following: Object.keys(migratedData.following).length,
          },
        },
      ],
    },
  };
}

/**
 * Initialize fresh storage for new installations
 */
async function initializeFreshStorage() {
  const initialData = {
    followDates: {
      followers: {},
      following: {},
    },
    metadata: {
      version: CURRENT_STORAGE_VERSION,
      lastSync: null,
      syncStats: {
        totalSyncs: 0,
        lastSyncDuration: 0,
        averageSyncDuration: 0,
      },
      created: Date.now(),
    },
  };

  await chrome.storage.local.set({
    [STORAGE_VERSION_KEY]: CURRENT_STORAGE_VERSION,
    ...initialData,
  });

  console.log("Fresh storage initialized");
  return initialData;
}

/**
 * Update sync statistics
 */
export async function updateSyncStats(
  duration,
  newFollowers = 0,
  newFollowing = 0
) {
  try {
    const result = await chrome.storage.local.get(["metadata"]);
    const metadata = result.metadata || {};

    const syncStats = metadata.syncStats || {
      totalSyncs: 0,
      lastSyncDuration: 0,
      averageSyncDuration: 0,
    };

    syncStats.totalSyncs += 1;
    syncStats.lastSyncDuration = duration;
    syncStats.averageSyncDuration =
      (syncStats.averageSyncDuration * (syncStats.totalSyncs - 1) + duration) /
      syncStats.totalSyncs;

    const updatedMetadata = {
      ...metadata,
      lastSync: Date.now(),
      syncStats,
      lastSyncResults: {
        newFollowers,
        newFollowing,
        timestamp: Date.now(),
      },
    };

    await chrome.storage.local.set({ metadata: updatedMetadata });

    return updatedMetadata;
  } catch (error) {
    console.error("Error updating sync stats:", error);
  }
}

/**
 * Get storage health information
 */
export async function getStorageHealth() {
  try {
    const result = await chrome.storage.local.get(null); // Get all data
    const version = result[STORAGE_VERSION_KEY] || 1;
    const followDates = result.followDates || { followers: {}, following: {} };
    const metadata = result.metadata || {};

    // Calculate storage usage (approximate)
    const dataSize = new Blob([JSON.stringify(result)]).size;
    const maxSize = 5 * 1024 * 1024; // 5MB Chrome limit

    return {
      version,
      isUpToDate: version === CURRENT_STORAGE_VERSION,
      recordCounts: {
        followers: Object.keys(followDates.followers).length,
        following: Object.keys(followDates.following).length,
      },
      storageUsage: {
        currentSize: dataSize,
        maxSize,
        usagePercentage: (dataSize / maxSize) * 100,
      },
      metadata,
      lastSync: metadata.lastSync,
      syncStats: metadata.syncStats,
    };
  } catch (error) {
    console.error("Error getting storage health:", error);
    return null;
  }
}
