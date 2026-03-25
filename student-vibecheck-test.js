// ═══════════════════════════════════════════════════════════════════════════
// STUDENT VIBECHECK TEST - Realistic AI-Generated Code Samples
// Testing the website as a student who copy-pasted from ChatGPT/Claude
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: "Make me a function to find duplicates in an array"
// (Classic ChatGPT response without optimization)
// ─────────────────────────────────────────────────────────────────────────────
function findDuplicates(arr) {
  const duplicates = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
        duplicates.push(arr[i]);
      }
    }
  }
  return duplicates;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: "Create a user authentication system"
// (AI-generated with typical safety issues)
// ─────────────────────────────────────────────────────────────────────────────
async function authenticateUser(username, password, email, role, permissions, settings) {
  try {
    const response = await fetch('/api/login');
    const data = response.json();

    if (data.user.profile.settings.isActive) {
      return data.user;
    }
  } catch(e) {
    // TODO: handle error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: "Make a function to validate email addresses"
// (AI generates regex without explaining it)
// ─────────────────────────────────────────────────────────────────────────────
function validateEmails(emailList) {
  const validEmails = [];
  for (let i = 0; i < emailList.length; i++) {
    const email = emailList[i];
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (regex.test(email)) {
      validEmails.push(email);
    }
  }
  return validEmails;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: "Create a shopping cart with item management"
// (AI generates CRUD operations with DOM manipulation in loops)
// ─────────────────────────────────────────────────────────────────────────────
function updateCart(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const itemElement = document.createElement('div');
    itemElement.innerHTML = `
      <span>${items[i].name}</span>
      <span>$${items[i].price}</span>
    `;
    document.getElementById('cart-items').appendChild(itemElement);
    total = total + items[i].price;
  }
  document.getElementById('total').innerHTML = '$' + total;
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: "Fetch user data from multiple APIs"
// (AI generates sequential async calls instead of parallel)
// ─────────────────────────────────────────────────────────────────────────────
async function getAllUserData(userIds) {
  const results = [];
  for (let i = 0; i < userIds.length; i++) {
    const userData = await fetch(`/api/users/${userIds[i]}`);
    const profile = await fetch(`/api/profiles/${userIds[i]}`);
    const settings = await fetch(`/api/settings/${userIds[i]}`);
    results.push({ userData, profile, settings });
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: "Sort products by multiple criteria"
// (AI generates inefficient sorting in loop)
// ─────────────────────────────────────────────────────────────────────────────
function categorizeProducts(products, categories) {
  const categorized = {};
  for (let i = 0; i < categories.length; i++) {
    categorized[categories[i]] = [];
    for (let j = 0; j < products.length; j++) {
      if (products[j].category === categories[i]) {
        categorized[categories[i]].push(products[j]);
      }
    }
    categorized[categories[i]].sort((a, b) => b.price - a.price);
  }
  return categorized;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: "Create a retry mechanism for failed requests"
// (AI generates while(true) with hardcoded values)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWithRetry(url) {
  let retryCount = 0;
  while(true) {
    try {
      const response = await fetch(url);
      return response.json();
    } catch(error) {
      retryCount++;
      if (retryCount > 3) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8: "Process nested data structures"
// (AI generates deeply nested callbacks)
// ─────────────────────────────────────────────────────────────────────────────
function processData(data) {
  getData(data, function(result) {
    validateData(result, function(validated) {
      transformData(validated, function(transformed) {
        saveData(transformed, function(saved) {
          notifyUser(saved, function(notified) {
            console.log('Done!');
          });
        });
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9: "Calculate fibonacci numbers"
// (AI generates unoptimized recursion)
// ─────────────────────────────────────────────────────────────────────────────
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10: "Search for users by name"
// (AI generates inefficient search)
// ─────────────────────────────────────────────────────────────────────────────
function searchUsers(users, searchTerms) {
  const results = [];
  for (let i = 0; i < searchTerms.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (users[j].name.toLowerCase().includes(searchTerms[i].toLowerCase())) {
        if (!results.includes(users[j])) {
          results.push(users[j]);
        }
      }
    }
  }
  return results;
}
