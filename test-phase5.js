// Phase 5 Test File - Code Quality & Performance Issues
// This file demonstrates performance anti-patterns and code quality issues

const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ==========================================
// RULE 67: BLOCKING OPERATIONS - HIGH
// ==========================================

console.log('========== BLOCKING OPERATIONS ==========');

// HIGH: Synchronous file operations block the event loop
function loadConfig() {
  // CRITICAL: Blocks entire server while reading file
  const config = fs.readFileSync('./config.json', 'utf8');
  const data = fs.readFileSync('./large-file.csv', 'utf8');
  const exists = fs.existsSync('./temp.txt');
  const files = fs.readdirSync('./uploads');
  const stats = fs.statSync('./package.json');

  return JSON.parse(config);
}

// HIGH: Synchronous crypto operations
function hashPassword(password) {
  // CRITICAL: pbkdf2Sync can take seconds and blocks everything
  const hash = crypto.pbkdf2Sync(password, 'salt', 100000, 64, 'sha512');
  return hash.toString('hex');
}

function scryptPassword(password) {
  // CRITICAL: scryptSync is even worse - blocks for multiple seconds
  const hash = crypto.scryptSync(password, 'salt', 64);
  return hash.toString('hex');
}

// HIGH: Synchronous child process execution
function getGitCommit() {
  // Blocks while waiting for git command
  const commit = execSync('git rev-parse HEAD').toString().trim();
  return commit;
}

// Correct examples (should NOT trigger):
// async function loadConfigAsync() {
//   const config = await fs.promises.readFile('./config.json', 'utf8');
//   return JSON.parse(config);
// }
//
// async function hashPasswordAsync(password) {
//   return new Promise((resolve, reject) => {
//     crypto.pbkdf2(password, 'salt', 100000, 64, 'sha512', (err, hash) => {
//       if (err) reject(err);
//       else resolve(hash.toString('hex'));
//     });
//   });
// }

// ==========================================
// RULE 68: MEMORY LEAKS - MEDIUM
// ==========================================

console.log('========== MEMORY LEAKS ==========');

// MEDIUM: Event listeners not removed
function setupEventListeners() {
  const button = document.getElementById('myButton');

  // MEMORY LEAK: Listener added but never removed
  button.addEventListener('click', () => {
    console.log('Button clicked');
  });

  // MEMORY LEAK: Multiple listeners in a loop
  for (let i = 0; i < 100; i++) {
    document.addEventListener('scroll', handleScroll);
  }

  window.addEventListener('resize', handleResize);
}

// MEDIUM: setInterval not cleared
function startPolling() {
  // MEMORY LEAK: Interval runs forever
  setInterval(() => {
    fetch('/api/status').then(r => r.json());
  }, 5000);

  // Another leak
  const intervalId = setInterval(() => {
    updateUI();
  }, 1000);
  // Never calls clearInterval(intervalId)
}

// MEDIUM: setTimeout not cleared (less critical but still wasteful)
function delayedAction() {
  setTimeout(() => {
    console.log('Delayed');
  }, 5000);
  // If component unmounts, this still fires
}

// LOW: Global variable accumulation
window.globalCache = [];
window.eventLog = [];

function trackEvent(event) {
  // MEMORY LEAK: Array grows forever
  window.eventLog.push(event);
  window.globalCache.push({ timestamp: Date.now(), data: event });
}

// Correct examples (should NOT trigger):
// function setupEventListenersCorrect() {
//   const button = document.getElementById('myButton');
//   const handler = () => console.log('clicked');
//   button.addEventListener('click', handler);
//
//   // Cleanup function
//   return () => {
//     button.removeEventListener('click', handler);
//   };
// }
//
// function startPollingCorrect() {
//   const intervalId = setInterval(() => {
//     fetch('/api/status');
//   }, 5000);
//
//   return () => clearInterval(intervalId);
// }

// ==========================================
// RULE 69: N+1 QUERY PROBLEMS - MEDIUM
// ==========================================

console.log('========== N+1 QUERY PROBLEMS ==========');

// MEDIUM: Database queries in loops
async function getUsersWithPosts() {
  const users = await db.query('SELECT * FROM users');

  // N+1 PROBLEM: Queries database once per user
  for (const user of users) {
    const posts = await db.query('SELECT * FROM posts WHERE user_id = ?', [user.id]);
    user.posts = posts;
  }

  return users;
}

// MEDIUM: ORM queries in loops
async function loadUsersWithComments() {
  const users = await User.find();

  // N+1 PROBLEM: Database call for each user
  for (let i = 0; i < users.length; i++) {
    users[i].comments = await Comment.find({ userId: users[i].id });
  }

  return users;
}

// MEDIUM: forEach with database calls
async function processOrders() {
  const orders = await Order.findAll();

  // N+1 PROBLEM
  orders.forEach(async (order) => {
    const customer = await Customer.findById(order.customerId);
    order.customerName = customer.name;
  });
}

// MEDIUM: map with database calls
async function enrichProducts() {
  const products = await Product.findAll();

  // N+1 PROBLEM
  const enriched = products.map(async (product) => {
    const category = await Category.findById(product.categoryId);
    return { ...product, categoryName: category.name };
  });

  return enriched;
}

// MEDIUM: API calls in loops
async function fetchUserDetails(userIds) {
  const details = [];

  // PERFORMANCE ISSUE: Sequential API calls
  for (const userId of userIds) {
    const response = await fetch(`https://api.example.com/users/${userId}`);
    const data = await response.json();
    details.push(data);
  }

  return details;
}

// MEDIUM: while loop with queries
async function processQueue() {
  let hasMore = true;

  while (hasMore) {
    // Query in loop
    const job = await db.findOne({ status: 'pending' });
    if (!job) {
      hasMore = false;
    } else {
      await processJob(job);
    }
  }
}

// Correct examples (should NOT trigger):
// async function getUsersWithPostsCorrect() {
//   // ONE query with JOIN - efficient!
//   const users = await db.query(`
//     SELECT users.*, posts.id as post_id, posts.title
//     FROM users
//     LEFT JOIN posts ON users.id = posts.user_id
//   `);
//   return users;
// }
//
// async function loadUsersWithCommentsCorrect() {
//   // Use ORM's eager loading
//   const users = await User.find().populate('comments');
//   return users;
// }
//
// async function fetchUserDetailsCorrect(userIds) {
//   // Parallel API calls
//   const promises = userIds.map(id => fetch(`https://api.example.com/users/${id}`));
//   const responses = await Promise.all(promises);
//   const details = await Promise.all(responses.map(r => r.json()));
//   return details;
// }

// ==========================================
// RULE 70: ReDoS - INEFFICIENT REGEX - MEDIUM
// ==========================================

console.log('========== ReDoS VULNERABILITIES ==========');

// MEDIUM: Catastrophic backtracking patterns
const emailRegex1 = /^(([a-z])+)+@[a-z]+\.[a-z]+$/;  // (a+)+ - DANGEROUS
const emailRegex2 = /^(a+)+$/;  // Nested quantifiers
const htmlRegex = /^(.*<div>.*)+$/;  // (.*)+  - DANGEROUS
const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;  // Multiple nested quantifiers

// MEDIUM: Multiple alternations with quantifiers
const complexRegex = /(a|b)*c(d|e)*/;  // Can cause ReDoS with right input

// Test function that could hang
function validateEmail(email) {
  // This regex can take MINUTES on malicious input like "aaaaaaaaaaaaaaaaaaaaaa!"
  return emailRegex1.test(email);
}

function parseHTML(html) {
  // Catastrophic backtracking on long invalid HTML
  return htmlRegex.test(html);
}

// Correct examples (should NOT trigger):
// const safeEmailRegex = /^[a-z]+@[a-z]+\.[a-z]+$/;  // No nested quantifiers
// const safeUrlRegex = /^https?:\/\/[\da-z\.-]+\.[a-z\.]{2,6}[\/\w \.-]*\/?$/;  // No nested quantifiers

// ==========================================
// RULE 71: LARGE BUNDLE IMPORTS - LOW
// ==========================================

console.log('========== LARGE BUNDLE IMPORTS ==========');

// LOW: Importing entire lodash (540KB)
import * as _ from 'lodash';
import lodash from 'lodash';
const _ = require('lodash');

// LOW: Importing moment (large bundle)
import moment from 'moment';
import * as moment from 'moment';

// LOW: Importing entire icon library
import * as MuiIcons from '@mui/icons-material';

// Using only small parts
const debounced = _.debounce(() => {}, 300);
const now = moment().format('YYYY-MM-DD');

// Correct examples (should NOT trigger):
// import debounce from 'lodash/debounce';  // Only 2KB
// import dayjs from 'dayjs';  // Only 2KB vs moment's 67KB
// import { Delete, Edit } from '@mui/icons-material';  // Only specific icons

// ==========================================
// RULE 72: CONSOLE LOGS IN PRODUCTION - LOW
// ==========================================

console.log('========== CONSOLE LOGS ==========');

// LOW: Console statements without guards
console.log('Application started');
console.debug('Debug info:', { userId: 123 });
console.info('User logged in');
console.warn('Deprecation warning');
console.error('Error occurred:', new Error('test'));
console.trace('Stack trace');
console.table([{ name: 'Alice', age: 30 }]);

function processData(data) {
  console.log('Processing data:', data);

  for (let i = 0; i < data.length; i++) {
    console.log('Item:', data[i]);  // In a loop - worse!
  }

  console.log('Done processing');
}

function apiCall() {
  console.log('Making API call...');
  fetch('/api/data')
    .then(r => r.json())
    .then(data => {
      console.log('Received:', data);
    });
}

// Correct examples (should NOT trigger if guards present):
// if (process.env.NODE_ENV !== 'production') {
//   console.log('Development mode');
// }
//
// const DEBUG = process.env.NODE_ENV === 'development';
// if (DEBUG) {
//   console.log('Debug info');
// }

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function handleScroll() {
  console.log('Scrolling...');
}

function handleResize() {
  console.log('Resizing...');
}

function updateUI() {
  console.log('Updating UI...');
}

async function processJob(job) {
  console.log('Processing job:', job);
}

// ==========================================
// EXPECTED DETECTIONS:
// ==========================================
//
// HIGH: 8-10 issues
//   - fs.readFileSync (5 instances)
//   - crypto.pbkdf2Sync
//   - crypto.scryptSync
//   - execSync
//   - (possibly) spawnSync
//
// MEDIUM: 12-15 issues
//   - Event listeners not removed (1-2)
//   - setInterval not cleared (2)
//   - N+1 query problems (6-7 instances)
//   - API calls in loops (1)
//   - ReDoS vulnerabilities (3-4 regex patterns)
//
// LOW: 8-10 issues
//   - setTimeout not cleared (1)
//   - Global accumulation (2)
//   - Large bundle imports (4-5)
//   - Console logs (8+, but only first 3 reported per type)
//
// TOTAL: 28-35 issues expected
// ==========================================

// Notes:
// - Blocking operations freeze Node.js server for ALL users
// - Memory leaks accumulate over time in SPAs
// - N+1 queries can make pages 100x slower
// - ReDoS can cause DoS with specially crafted input
// - Large bundles slow down initial page load
// - Console logs expose debug info and cause minor overhead
//
// Real-world impact:
// - Instagram's N+1 query bug (2013): Feed took 30+ seconds to load
// - Stack Overflow ReDoS attack (2016): Entire site taken down
// - Blocking operations: One slow request blocks thousands
// - Memory leaks: SPAs crash after hours of use
