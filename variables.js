/**
 * Gets the user ID from Duolingo cookies.
 * The ID is stored in the "logged_out_uuid" cookie.
 *
 * @returns {Promise<string>} The user ID from cookies
 */
async function getUserIdFromCookies() {
  try {
    const cookie = await chrome.cookies.get({
      url: "https://www.duolingo.com",
      name: "logged_out_uuid",
    });

    if (!cookie || !cookie.value) {
      throw new Error("Could not find logged_out_uuid cookie");
    }

    return cookie.value;
  } catch (error) {
    console.error("Error getting user ID from cookies:", error);
    throw error;
  }
}

/**
 * Gets the JWT token from Duolingo cookies.
 *
 * @returns {Promise<string>} The JWT token with 'Bearer' prefix
 */
async function getJwtTokenFromCookies() {
  try {
    const cookies = await chrome.cookies.getAll({
      domain: "duolingo.com",
      name: "jwt_token",
    });

    if (!cookies || cookies.length === 0 || !cookies[0].value) {
      throw new Error("Could not find jwt_token cookie");
    }

    return `Bearer ${cookies[0].value}`;
  } catch (error) {
    console.error("Error getting JWT token from cookies:", error);
    throw error;
  }
}

/**
 * The current user's Duolingo profile ID.
 * This is obtained from the logged_out_uuid cookie.
 */
export let MY_USER_ID = null;

/**
 * The current user's JWT token.
 * This is obtained from the jwt_token cookie.
 */
export let JWT_TOKEN = null;

// Initialize both user ID and JWT token when the module loads
Promise.all([getUserIdFromCookies(), getJwtTokenFromCookies()])
  .then(([id, token]) => {
    MY_USER_ID = id;
    JWT_TOKEN = token;
    console.log("User ID initialized from cookies:", id);
    console.log("JWT token initialized from cookies");
  })
  .catch((error) => {
    console.error("Failed to initialize authentication:", error);
  });
