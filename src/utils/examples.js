// ═══════════════════════════════════════════════════════════════════════════════
// CODE EXAMPLES — Pre-filled samples for "Try Example" feature
// ═══════════════════════════════════════════════════════════════════════════════

export const EXAMPLES = {
  nestedLoops: {
    title: "Nested Loops (Beginner)",
    language: "javascript",
    description: "Classic O(n²) nested loop finding duplicates",
    code: `// Finding duplicates with nested loops
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

// This will trigger:
// - Nested Loop Detected (CRITICAL)
// - Linear Scan Inside Loop (CRITICAL)
// Expected issues: 2`
  },

  aiSlop: {
    title: "AI-Generated Code (Intermediate)",
    language: "javascript",
    description: "Typical AI-generated code with multiple issues",
    code: `// AI-generated authentication function
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

// This will trigger:
// - Empty Catch Block (CRITICAL)
// - Missing Null Check (HIGH)
// - Excessive Parameters (MEDIUM)
// - Unhandled Promise (HIGH)
// Expected issues: 4`
  },

  callbackHell: {
    title: "Callback Hell (Intermediate)",
    language: "javascript",
    description: "Deeply nested callbacks",
    code: `// Processing data with nested callbacks
function processUserData(userId) {
  getUser(userId, function(user) {
    validateUser(user, function(valid) {
      if (valid) {
        getPermissions(user.id, function(permissions) {
          checkAccess(permissions, function(hasAccess) {
            if (hasAccess) {
              loadDashboard(user, function(dashboard) {
                console.log('Done!');
              });
            }
          });
        });
      }
    });
  });
}

// This will trigger:
// - Callback Hell (MEDIUM)
// Expected issues: 1`
  },

  inefficientSort: {
    title: "Sort in Loop (Intermediate)",
    language: "javascript",
    description: "Sorting inside a loop",
    code: `// Categorizing and sorting products
function categorizeProducts(products, categories) {
  const categorized = {};

  for (let i = 0; i < categories.length; i++) {
    categorized[categories[i]] = [];

    for (let j = 0; j < products.length; j++) {
      if (products[j].category === categories[i]) {
        categorized[categories[i]].push(products[j]);
      }
    }

    // Sorting inside the loop - inefficient!
    categorized[categories[i]].sort((a, b) => b.price - a.price);
  }

  return categorized;
}

// This will trigger:
// - Nested Loop (CRITICAL)
// - Sort in Loop (HIGH)
// Expected issues: 2`
  },

  unboundedRecursion: {
    title: "Unbounded Recursion (Advanced)",
    language: "javascript",
    description: "Fibonacci without memoization",
    code: `// Fibonacci without memoization
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate fib(30) - will be very slow!
const result = fibonacci(30);

// This will trigger:
// - Unbounded Recursion (HIGH)
// Expected issues: 1`
  },

  domThrashing: {
    title: "DOM Manipulation (Advanced)",
    language: "javascript",
    description: "DOM operations inside loop",
    code: `// Updating shopping cart - bad practice
function updateCart(items) {
  let total = 0;

  for (let i = 0; i < items.length; i++) {
    // DOM manipulation in loop - causes reflows!
    const itemElement = document.createElement('div');
    itemElement.innerHTML = items[i].name + ': $' + items[i].price;
    document.getElementById('cart-items').appendChild(itemElement);

    total = total + items[i].price;
  }

  document.getElementById('total').innerHTML = '$' + total;
  return total;
}

// This will trigger:
// - DOM Manipulation in Loop (HIGH)
// - String Concatenation in Loop (MEDIUM)
// Expected issues: 2`
  },

  asyncInLoop: {
    title: "Sequential Async (Advanced)",
    language: "javascript",
    description: "Await inside loop - serializes requests",
    code: `// Fetching user data sequentially - slow!
async function getAllUserData(userIds) {
  const results = [];

  for (let i = 0; i < userIds.length; i++) {
    // Each request waits for previous - very slow!
    const userData = await fetch('/api/users/' + userIds[i]);
    const profile = await fetch('/api/profiles/' + userIds[i]);
    results.push({ userData, profile });
  }

  return results;
}

// This will trigger:
// - Await in Loop (HIGH)
// - String Concatenation in Loop (MEDIUM)
// Expected issues: 2`
  },

  pythonNested: {
    title: "Python Nested Comprehension",
    language: "python",
    description: "Nested list comprehension in Python",
    code: `# Finding common elements between lists
def find_common(lists):
    # Nested comprehension - O(n*m) complexity
    common = [x for lst in lists for x in lst if x in [y for sublst in lists for y in sublst]]
    return list(set(common))

# Alternative with list literal membership
def check_status(value):
    if value in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]:
        return True
    return False

# This will trigger:
# - Nested List Comprehension (HIGH)
# - Membership Test on List Literal (MEDIUM)
# Expected issues: 2`
  },

  complexMess: {
    title: "Real-World Mess (Expert)",
    language: "javascript",
    description: "Everything wrong in one function",
    code: `// A disaster of a function with multiple issues
async function processEverything(userId, userName, userEmail, userRole, userPermissions, userSettings) {
  let result = "";

  try {
    while(true) {
      const response = await fetch('/api/data');
      const data = response.data.items;

      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data.length; j++) {
          if (data[i].id === data[j].parentId) {
            const item = new Object();
            item.value = data[i];

            if (data[i].tags.includes('important')) {
              result = result + data[i].name + ", ";
              document.getElementById('list').innerHTML += '<li>' + data[i].name + '</li>';
            }
          }
        }

        data.sort((a, b) => a.priority - b.priority);
      }

      if (retryCount > 5) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch(e) {}

  return result;
}

// This triggers almost everything!
// Expected issues: 10+`
  },
};

export const EXAMPLE_LIST = [
  { id: 'nestedLoops', ...EXAMPLES.nestedLoops },
  { id: 'aiSlop', ...EXAMPLES.aiSlop },
  { id: 'callbackHell', ...EXAMPLES.callbackHell },
  { id: 'inefficientSort', ...EXAMPLES.inefficientSort },
  { id: 'unboundedRecursion', ...EXAMPLES.unboundedRecursion },
  { id: 'domThrashing', ...EXAMPLES.domThrashing },
  { id: 'asyncInLoop', ...EXAMPLES.asyncInLoop },
  { id: 'pythonNested', ...EXAMPLES.pythonNested },
  { id: 'complexMess', ...EXAMPLES.complexMess },
];
