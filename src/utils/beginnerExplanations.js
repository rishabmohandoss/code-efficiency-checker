// ═══════════════════════════════════════════════════════════════════════════════
// BEGINNER-FRIENDLY EXPLANATIONS
// Simple, jargon-free explanations for each rule
// ═══════════════════════════════════════════════════════════════════════════════

export const BEGINNER_EXPLANATIONS = {
  "nested-loops": {
    simple: "Your code checks every item against every other item. This gets really slow with big lists!",
    impact: "With 100 items: 10,000 checks. With 1,000 items: 1,000,000 checks (freezes your app!)",
    analogy: "Like checking if two phone books have duplicates by comparing every name in book 1 to every name in book 2.",
    fix: "Use a Set instead - it's like an index that lets you find things instantly."
  },

  "triple-nested-loops": {
    simple: "You have three loops inside each other. This makes your code extremely slow!",
    impact: "With just 100 items: 1,000,000 operations. Your app will freeze.",
    analogy: "Like sorting a deck of cards by comparing every card to every other card, three times.",
    fix: "Rethink your approach - there's usually a smarter way to solve this."
  },

  "linear-scan-in-loop": {
    simple: "Inside your loop, you're searching through a list every time. This doubles the slowness!",
    impact: "Each loop iteration does another full search. With 1,000 items: 1,000,000 searches.",
    analogy: "Like looking up a word in a dictionary without an index - you read every page, every time.",
    fix: "Create a Set before the loop, then you can check instantly (like using a dictionary index)."
  },

  "alloc-in-loop": {
    simple: "You're creating new objects/arrays inside the loop. This wastes memory and slows things down.",
    impact: "Creates thousands of temporary objects that need cleanup. Causes lag and stuttering.",
    analogy: "Like getting a new notebook for every item on your shopping list, then throwing them all away.",
    fix: "Create one object/array before the loop and reuse it."
  },

  "unbounded-recursion": {
    simple: "Your function calls itself without remembering previous results. It recalculates everything repeatedly!",
    impact: "fibonacci(30) does 1 million+ calculations. fibonacci(40) would take hours!",
    analogy: "Like asking your friend for an answer, who asks another friend, who asks you again - endless loop!",
    fix: "Remember results (memoization) so you don't recalculate the same thing twice."
  },

  "sort-in-loop": {
    simple: "You're sorting the entire list inside a loop. That's like re-alphabetizing a whole filing cabinet repeatedly!",
    impact: "Sorting is already slow (O(n log n)). Doing it in a loop multiplies the slowness.",
    analogy: "Like shuffling and re-sorting a deck of cards after adding each card.",
    fix: "Sort once before or after the loop, not during it."
  },

  "async-in-loop": {
    simple: "You're waiting for each request to finish before starting the next one. This is like standing in line at a coffee shop!",
    impact: "10 requests take 10 seconds instead of 1 second. Users see loading spinners forever.",
    analogy: "Like sending emails one at a time, waiting for each reply before sending the next.",
    fix: "Use Promise.all() to send all requests at once (like opening multiple email tabs)."
  },

  "dom-in-loop": {
    simple: "You're updating the webpage inside a loop. Each update forces the browser to redraw everything!",
    impact: "Causes visible lag and stuttering. Users see the page flicker.",
    analogy: "Like repainting your entire room after adding each decoration.",
    fix: "Collect all changes, then update the page once at the end."
  },

  "array-as-set": {
    simple: "You're using an array to check if items exist, but that's slow - it checks every item each time!",
    impact: "With 1,000 items, checking takes 1,000 operations. With 10,000: 10,000 operations.",
    analogy: "Like looking for a name in a list by reading every name from the start each time.",
    fix: "Use a Set - it's like a phone book index, finds things instantly."
  },

  "string-concat-loop": {
    simple: "Building a string with += in a loop creates a new copy each time. Very wasteful!",
    impact: "With 10,000 items, creates 10,000 temporary string copies. Uses tons of memory.",
    analogy: "Like rewriting an entire book every time you add one word.",
    fix: "Collect strings in an array, then join them once at the end."
  },

  "console-in-loop": {
    simple: "Printing to console inside a loop is slow and clutters your debug output!",
    impact: "With 10,000 items, prints 10,000 lines. Makes debugging impossible.",
    analogy: "Like shouting every item on your shopping list while shopping.",
    fix: "Remove console.logs, or collect values and print once after the loop."
  },

  "large-function": {
    simple: "This function is really long! Hard to understand and probably does too many things.",
    impact: "Difficult to debug, test, or modify. Other developers (and future you) will struggle.",
    analogy: "Like having one giant recipe for an entire 5-course meal instead of separate recipes.",
    fix: "Break it into smaller functions, each doing one thing."
  },

  "python-nested-comprehension": {
    simple: "Nested list comprehensions are clever but hard to read and still slow!",
    impact: "O(n×m) complexity - with big lists, this gets really slow.",
    analogy: "Like using complicated shorthand - clever but confusing.",
    fix: "Use simple loops if needed, they're clearer and you can add optimizations."
  },

  "python-append-loop": {
    simple: "Using .append() in a loop works, but list comprehensions are faster in Python!",
    impact: "Minor performance hit, but adds up with large lists.",
    analogy: "Like adding items to a shopping cart one by one instead of scanning them all at once.",
    fix: "Use: result = [process(x) for x in items]"
  },

  "python-keys-iteration": {
    simple: "No need to call .keys() when looping over a dictionary - it's automatic!",
    impact: "Tiny performance hit, but it's also extra typing for no benefit.",
    analogy: "Like asking for the table of contents when the book opens to it automatically.",
    fix: "Change 'for x in dict.keys():' to just 'for x in dict:'"
  },

  "python-in-list-literal": {
    simple: "Checking 'if x in [a, b, c]' creates a new list each time - wasteful!",
    impact: "With large lists and frequent checks, this adds up.",
    analogy: "Like rewriting a list of names every time you want to check if someone's on it.",
    fix: "Use a tuple (a, b, c) for small sets, or {a, b, c} for larger ones."
  },

  "empty-catch": {
    simple: "Your catch block is empty! When an error happens, it disappears silently. Very dangerous!",
    impact: "Bugs become invisible. Your app fails quietly and you'll never know why.",
    analogy: "Like putting duct tape over your car's 'check engine' light.",
    fix: "At minimum: log the error. Better: show user feedback or retry."
  },

  "missing-null-check": {
    simple: "You're accessing object properties without checking if the object exists first. This will crash!",
    impact: "App crashes with 'Cannot read property of undefined' - users see error page.",
    analogy: "Like opening a box without checking if you have a box.",
    fix: "Use optional chaining (obj?.prop?.nested) or check: if (!obj) return;"
  },

  "unhandled-promise": {
    simple: "Your async code doesn't handle errors! If something fails, your app might crash.",
    impact: "Unhandled rejections crash Node.js apps and cause silent failures in browsers.",
    analogy: "Like ordering food delivery but not answering the door if something goes wrong.",
    fix: "Add .catch() to promises or wrap await calls in try-catch."
  },

  "infinite-loop-risk": {
    simple: "Your while(true) loop might never exit! This will freeze your app completely.",
    impact: "App becomes unresponsive. Users have to force-quit.",
    analogy: "Like driving in circles without knowing when to stop.",
    fix: "Add a clear exit condition or use while(condition) instead."
  },

  "excessive-parameters": {
    simple: "This function has too many parameters! Hard to remember what order they go in.",
    impact: "Easy to mix up parameters, leading to bugs. Difficult to test.",
    analogy: "Like a TV remote with 50 buttons - you'll press the wrong one.",
    fix: "Use an options object: function(config) where config = { param1, param2, ... }"
  },

  "callback-hell": {
    simple: "Your callbacks are nested too deep! This code is very hard to read and maintain.",
    impact: "Difficult to debug, error handling becomes a nightmare. Known as 'callback hell'.",
    analogy: "Like reading a book where every page sends you to another page in a different book.",
    fix: "Use async/await instead of nested callbacks. Much clearer!"
  },

  "magic-numbers": {
    simple: "You have numbers scattered in your code without explaining what they mean!",
    impact: "When you need to change '5' to '10', you have to find and update every '5'.",
    analogy: "Like using speed limit numbers everywhere instead of a sign you can update once.",
    fix: "Create constants: const MAX_RETRIES = 5; const TIMEOUT = 3000;"
  }
};

// Generate impact score for priority ranking
export function calculateImpactScore(rule) {
  const severityScore = {
    'CRITICAL': 10,
    'HIGH': 7,
    'MEDIUM': 4,
    'LOW': 2
  };

  const complexityScore = {
    'O(2ⁿ) worst': 10,
    'O(n³)': 9,
    'O(n² log n)': 7,
    'O(n²)': 6,
    'O(n² space)': 6,
    'O(n×m)': 6,
    'O(n) per check': 4,
    'O(n)': 3
  };

  let score = severityScore[rule.severity] || 1;

  if (rule.complexity) {
    score += (complexityScore[rule.complexity] || 0);
  }

  return score;
}

// Get beginner explanation for a rule
export function getBeginnerExplanation(ruleId) {
  return BEGINNER_EXPLANATIONS[ruleId] || {
    simple: "This pattern can cause issues in your code.",
    impact: "May affect performance or reliability.",
    analogy: "Think of it like taking the long way instead of a shortcut.",
    fix: "Check the hint for how to improve this."
  };
}
