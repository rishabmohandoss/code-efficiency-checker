// Test file with intentional security vulnerabilities

const express = require('express');
const app = express();

// CRITICAL: Hardcoded API key
const apiKey = "sk_live_abc123xyz456def789";

// CRITICAL: Hardcoded password
const dbPassword = "admin123";

// CRITICAL: Database connection string with credentials
const dbUrl = "mongodb://admin:secretpass@localhost:27017/mydb";

// CRITICAL: SQL Injection vulnerability
app.get('/users', (req, res) => {
  const userId = req.query.id;
  db.query("SELECT * FROM users WHERE id = " + userId);
});

// CRITICAL: XSS vulnerability
app.get('/comment', (req, res) => {
  const comment = req.body.comment;
  document.getElementById('comments').innerHTML = comment;
});

// HIGH: Missing authentication
app.post('/api/admin/delete', (req, res) => {
  User.findByIdAndDelete(req.params.id);
});

// HIGH: Weak password requirements
app.post('/register', (req, res) => {
  if (req.body.password.length >= 4) {
    // Password is OK
    user.password = req.body.password; // CRITICAL: No hashing!
  }
});

// HIGH: Insecure token storage (client-side)
// localStorage.setItem('token', jwt);

// MEDIUM: Open redirect
app.get('/redirect', (req, res) => {
  res.redirect(req.query.url);
});

app.listen(3000);
