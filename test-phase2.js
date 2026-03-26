// Phase 2 Test File - Environment Variables & Configuration Security
// This file contains intentional security vulnerabilities for testing

const express = require('express');
const multer = require('multer');
const session = require('express-session');
const app = express();

// ==========================================
// ENVIRONMENT VARIABLE ISSUES (Rules 11-15)
// ==========================================

// MEDIUM: Missing .env.example - uses env vars without documentation
const apiKey = process.env.STRIPE_API_KEY;
const dbUrl = process.env.DATABASE_URL;

// CRITICAL: .env file in git
// git add .env  // This would trigger the detector
// !.env in .gitignore would also trigger

// MEDIUM: Unsafe environment variable access without fallback
const unsafeApiKey = process.env.API_KEY;  // No validation!
const unsafePort = process.env.PORT;       // Will be undefined if not set

// HIGH: Secrets in client-side code (React component example)
import React, { useState } from 'react';

function MyComponent() {
  // This is client-side - secrets will be bundled and exposed!
  const secretKey = process.env.SECRET_API_KEY;  // WRONG!
  const apiToken = process.env.API_TOKEN;        // WRONG!

  // These are OK (public prefixes):
  const publicKey = process.env.REACT_APP_PUBLIC_KEY;  // OK
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;      // OK

  return <div>Component</div>;
}

// LOW: Insecure environment variable names (too generic)
const password = process.env.PASSWORD;    // Which password?
const secret = process.env.SECRET;        // Which secret?
const key = process.env.KEY;              // Which key?
const token = process.env.TOKEN;          // Which token?

// ==========================================
// CONFIGURATION SECURITY (Rules 46-52)
// ==========================================

// HIGH: Debug mode in production
const DEBUG = true;  // Should be false in production!
app.set('env', 'development');  // Should be 'production'!

if (DEBUG) {
  console.log('Debug mode enabled - showing all errors');
}

// CRITICAL: Default credentials
const adminUser = "admin";
const adminPass = "admin";  // Default password!

const dbUsername = "root";
const dbPassword = "password";  // Another default!

// Authentication with defaults
if (req.body.username === "admin" && req.body.password === "admin123") {
  // Allow access
}

// HIGH: Exposed admin panel without authentication
app.get('/admin', (req, res) => {
  // No authentication middleware!
  res.send('Admin panel');
});

app.post('/admin/delete-user', (req, res) => {
  // No auth check!
  User.findByIdAndDelete(req.params.id);
});

app.get('/dashboard', (req, res) => {
  // No protection!
  res.send('Dashboard with sensitive data');
});

// MEDIUM: Directory listing enabled
app.use(express.static('public'));  // No index: false or index.html specified

// CRITICAL: Insecure file uploads
const upload = multer({ dest: 'uploads/' });
// No validation on file types!
// No size limits!
// No malware scanning!

app.post('/upload', upload.single('file'), (req, res) => {
  // Accepts ANY file type - .exe, .php, .jsp all allowed!
  // No size limit - could upload 10GB and crash server!
  res.send('File uploaded: ' + req.file.originalname);
});

// Better example but still missing malware check:
const uploadWithSomeValidation = multer({
  limits: { fileSize: 5 * 1024 * 1024 }  // 5MB limit
  // Still missing: fileFilter, mimetype check, antivirus
});

// HIGH: Missing input validation
app.post('/api/users', (req, res) => {
  // No validation library (joi, yup, express-validator)!
  const user = {
    email: req.body.email,      // Could be undefined or malicious
    age: req.body.age,          // Could be a string, negative, or 9999
    name: req.body.name         // Could be empty or contain scripts
  };

  User.create(user);  // Saving without validation!
});

app.get('/api/search', (req, res) => {
  const query = req.query.q;  // No validation!
  search(query);
});

// HIGH: Insecure cookie settings
app.post('/login', (req, res) => {
  const token = generateToken(user);

  // Missing httpOnly, secure, and sameSite!
  res.cookie('token', token);  // Vulnerable to XSS and CSRF!

  // Also insecure:
  res.cookie('session', sessionId, {
    httpOnly: false,  // JavaScript can access it!
    // Missing: secure, sameSite
  });

  // Partially secure (missing some flags):
  res.cookie('auth', token, {
    httpOnly: true
    // Missing: secure, sameSite
  });
});

// Session configuration without secure settings
app.use(session({
  secret: 'keyboard cat',
  cookie: {
    // Missing httpOnly, secure, sameSite!
    maxAge: 60000
  }
}));

// ==========================================
// CORRECT EXAMPLES (Should NOT trigger)
// ==========================================

// CORRECT: Safe environment variable usage
const safeApiKey = process.env.API_KEY || throwError('API_KEY missing');
const safePort = process.env.PORT || 3000;

// CORRECT: Descriptive env var names
const dbPassword_CORRECT = process.env.DB_PASSWORD;
const jwtSecret_CORRECT = process.env.JWT_SECRET;
const stripeKey_CORRECT = process.env.STRIPE_API_KEY;

// CORRECT: Public client-side env vars
const publicApiUrl = process.env.REACT_APP_API_URL;
const publicGAId = process.env.NEXT_PUBLIC_GA_ID;

// CORRECT: Production mode check
if (process.env.NODE_ENV !== 'production') {
  app.set('debug', true);
}

// CORRECT: Strong custom credentials
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;  // From environment

// CORRECT: Protected admin route
app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  res.send('Admin panel');
});

// CORRECT: Secure file upload
const secureUpload = multer({
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024  // 5MB
  }
});

// CORRECT: Input validation with joi
const Joi = require('joi');

app.post('/api/users', (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    age: Joi.number().min(0).max(120).required(),
    name: Joi.string().min(1).max(100).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).send(error.details);
  }

  User.create(value);
});

// CORRECT: Secure cookie settings
app.post('/login', (req, res) => {
  const token = generateToken(user);

  res.cookie('token', token, {
    httpOnly: true,   // Prevents XSS
    secure: true,     // HTTPS only
    sameSite: 'strict' // Prevents CSRF
  });
});

app.listen(3000);

// ==========================================
// EXPECTED DETECTIONS:
// ==========================================
// CRITICAL: 2-3 (env in git, default credentials, insecure file upload)
// HIGH: 4-5 (secrets in client code, debug mode, exposed admin, missing validation, insecure cookies)
// MEDIUM: 2-3 (missing .env.example, unsafe env access, directory listing)
// LOW: 1-2 (insecure env names)
//
// TOTAL: ~10-13 issues should be detected
