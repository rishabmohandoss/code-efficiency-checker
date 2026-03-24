// AI SLOP TEST SAMPLE
// This code demonstrates common issues in LLM-generated "vibecoded" code
// Should trigger 7+ flags when analyzed

// 1. Empty catch block (CRITICAL)
// 2. Missing null checks (HIGH)
// 3. Unhandled promise (HIGH)
// 4. Infinite loop risk (HIGH)
// 5. Excessive parameters (MEDIUM)
// 6. Magic numbers (LOW)

async function processUserData(userId, userName, userEmail, userAge, userAddress, userPhone, userCountry) {
  // Flag: Excessive parameters (>5)

  // Flag: Unhandled promise - no .catch() or try-catch
  const response = await fetch('/api/users');

  // Flag: Missing null check - assumes response.data exists
  const users = response.data.items;

  let retryCount = 0;

  // Flag: Infinite loop risk - while(true) without clear exit
  while(true) {
    try {
      // Flag: Magic number (3 appears multiple times)
      if (retryCount > 3) {
        break;
      }

      // Process data
      users.forEach(user => {
        // Flag: Missing null check on nested property
        console.log(user.profile.name);
      });

      retryCount++;
    } catch(e) {
      // Flag: Empty catch block - error swallowed
    }

    // Flag: Magic number (5000)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return users;
}

// Additional AI slop examples:

// Callback hell example (MEDIUM)
function fetchAllData(userId, callback) {
  fetchUser(userId, (user) => {
    fetchPosts(user.id, (posts) => {
      fetchComments(posts[0].id, (comments) => {
        fetchLikes(comments[0].id, (likes) => {
          // Flag: Callback hell (4+ levels deep)
          callback(likes);
        });
      });
    });
  });
}

// Over-defensive error handling
function simpleCalculation(a, b) {
  try {
    try {
      try {
        return a + b; // This doesn't need try-catch!
      } catch(e) {
        // Over-engineering for simple operation
      }
    } catch(e) {}
  } catch(e) {}
}

// Happy path bias - no edge case handling
function divideNumbers(x, y) {
  return x / y; // What if y is 0?
}

// Accessing properties without optional chaining
function getUserCity(user) {
  return user.address.city.name; // Assumes all exist
}
