// Phase 6 Test File - Cloud & Infrastructure Security Issues
// This file demonstrates cloud misconfigurations and infrastructure vulnerabilities

// ==========================================
// RULE 46: EXPOSED CLOUD CREDENTIALS - CRITICAL
// ==========================================

console.log('========== EXPOSED CLOUD CREDENTIALS ==========');

// CRITICAL: AWS credentials hardcoded
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1'
});

// CRITICAL: AWS credentials in config
aws_access_key_id = "AKIAIOSFODNN7EXAMPLE"
aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

// CRITICAL: GCP credentials
const GOOGLE_APPLICATION_CREDENTIALS = "/path/to/service-account-key.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = "./gcp-credentials.json";

// CRITICAL: Azure credentials
const azure_client_id = "12345678-1234-1234-1234-123456789012";
const azure_client_secret = "secretvalue123456";
const azure_tenant_id = "87654321-4321-4321-4321-210987654321";

// Correct examples (should NOT trigger):
// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION
// });
//
// Or better: use IAM roles (no credentials needed in code!)

// ==========================================
// RULE 47: OVERLY PERMISSIVE IAM - HIGH
// ==========================================

console.log('========== OVERLY PERMISSIVE IAM POLICIES ==========');

// HIGH: AWS IAM policy with wildcard actions
const iamPolicy = {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",           // DANGEROUS: All actions
      "Resource": "*"          // DANGEROUS: All resources
    }
  ]
};

// HIGH: Another wildcard example
const dangerousPolicy = {
  "Effect": "Allow",
  "Action": "*",
  "Resource": "arn:aws:s3:::*"
};

// HIGH: GCP overly permissive role
const gcpBinding = {
  "role": "roles/owner",      // DANGEROUS: Owner has all permissions
  "members": ["user:dev@example.com"]
};

const editorRole = {
  "role": "roles/editor",     // DANGEROUS: Editor can modify everything
  "members": ["serviceAccount:app@project.iam.gserviceaccount.com"]
};

// Correct examples (should NOT trigger):
// {
//   "Effect": "Allow",
//   "Action": [
//     "s3:GetObject",
//     "s3:PutObject"
//   ],
//   "Resource": "arn:aws:s3:::my-specific-bucket/*"
// }

// ==========================================
// RULE 48: UNENCRYPTED CLOUD STORAGE - HIGH
// ==========================================

console.log('========== UNENCRYPTED CLOUD STORAGE ==========');

// HIGH: S3 bucket without encryption
const bucketConfig = {
  Bucket: 'my-bucket',
  "Encrypted": false,
  ServerSideEncryption: "None"
};

// HIGH: Encryption explicitly disabled
const storageConfig = {
  encryption = false,
  sse_algorithm = ""
};

// HIGH: Public bucket ACL
const publicBucket = {
  ACL: "PublicRead",          // DANGEROUS
  Bucket: "my-public-data"
};

const publicReadWrite = {
  ACL: "PublicReadWrite"      // VERY DANGEROUS
};

// HIGH: Block public ACLs disabled
const bucketPolicy = {
  "BlockPublicAcls": false,   // Allows public access
  "BlockPublicPolicy": false
};

// Correct examples (should NOT trigger):
// {
//   Bucket: 'my-bucket',
//   ServerSideEncryption: 'AES256',
//   Encrypted: true
// }

// ==========================================
// RULE 49: OVERLY PERMISSIVE FIREWALL - MEDIUM
// ==========================================

console.log('========== OVERLY PERMISSIVE FIREWALL RULES ==========');

// MEDIUM: Security group allowing all IPs
const securityGroup = {
  "IpPermissions": [
    {
      "IpProtocol": "tcp",
      "FromPort": 22,
      "ToPort": 22,
      "CidrIp": "0.0.0.0/0"    // DANGEROUS: SSH from anywhere
    },
    {
      "IpProtocol": "tcp",
      "FromPort": 0,
      "ToPort": 65535,
      "CidrIp": "0.0.0.0/0"    // VERY DANGEROUS: All ports from anywhere
    }
  ]
};

// MEDIUM: GCP firewall rule
const gcpFirewall = {
  "allowed": [{
    "IPProtocol": "tcp",
    "ports": ["0-65535"]
  }],
  "sourceRanges": ["0.0.0.0/0"],
  "direction": "INGRESS"
};

// Correct examples (should NOT trigger):
// {
//   "CidrIp": "10.0.0.0/8"  // Private IP range
// }
// {
//   "CidrIp": "203.0.113.0/24"  // Specific office IP range
// }

// ==========================================
// RULE 55: API WITHOUT AUTHENTICATION - HIGH
// ==========================================

console.log('========== API ENDPOINTS WITHOUT AUTH ==========');

const express = require('express');
const app = express();

// HIGH: Unauthenticated routes
app.get('/api/users', (req, res) => {
  const users = db.query('SELECT * FROM users');
  res.json(users);
});

app.post('/api/transfer-money', (req, res) => {
  const { from, to, amount } = req.body;
  db.query('INSERT INTO transactions VALUES (?, ?, ?)', [from, to, amount]);
  res.json({ success: true });
});

app.delete('/api/user/:id', (req, res) => {
  db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ deleted: true });
});

app.put('/api/settings', (req, res) => {
  db.query('UPDATE settings SET value = ?', [req.body.value]);
  res.json({ updated: true });
});

// Correct examples (should NOT trigger):
// app.get('/api/users', authenticate, (req, res) => {
//   res.json(users);
// });
//
// app.post('/api/data', requireAuth, handler);
// app.use('/api/', authenticate);

// ==========================================
// RULE 56: MISSING RATE LIMITING - MEDIUM
// ==========================================

console.log('========== MISSING RATE LIMITING ==========');

// MEDIUM: API routes without rate limiting
// (No rate limiting middleware in code)

app.post('/api/login', (req, res) => {
  // No rate limiting - can brute force passwords
  const user = authenticate(req.body.username, req.body.password);
  res.json({ token: user.token });
});

app.get('/api/search', (req, res) => {
  // No rate limiting - can scrape entire database
  const results = db.search(req.query.term);
  res.json(results);
});

// Correct examples (should NOT trigger):
// const rateLimit = require('express-rate-limit');
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100
// });
// app.use(limiter);

// ==========================================
// RULE 57: CORS MISCONFIGURATION - MEDIUM
// ==========================================

console.log('========== CORS MISCONFIGURATION ==========');

// MEDIUM: CORS wildcard with credentials
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// MEDIUM: CORS misconfiguration
const cors = require('cors');
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(cors({
  origin: true  // Reflects any origin - DANGEROUS
}));

// Correct examples (should NOT trigger):
// app.use(cors({
//   origin: 'https://myapp.com',
//   credentials: true
// }));
//
// const whitelist = ['https://app1.com', 'https://app2.com'];
// app.use(cors({
//   origin: (origin, callback) => {
//     if (whitelist.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed'));
//     }
//   }
// }));

// ==========================================
// EXPECTED DETECTIONS:
// ==========================================
//
// CRITICAL: 5-7 issues
//   - AWS access key ID (2)
//   - AWS secret access key (2)
//   - GCP credentials path
//   - Azure client ID
//   - Azure client secret
//
// HIGH: 15-20 issues
//   - Overly permissive IAM policies (4-5)
//   - Unencrypted storage (5-6)
//   - Overly permissive firewall rules (2-3)
//   - API without authentication (4-5)
//
// MEDIUM: 4-6 issues
//   - Missing rate limiting (1)
//   - CORS misconfiguration (3-5)
//
// TOTAL: 24-33 issues expected
// ==========================================

// Notes:
// - Exposed cloud credentials lead to account takeover
// - Overly permissive policies violate least privilege
// - Unencrypted storage violates compliance (GDPR, HIPAA)
// - Public firewall rules expose services to internet
// - Unauthenticated APIs lead to data breaches
// - Missing rate limiting enables brute force and DoS
// - CORS misconfig allows cross-origin attacks
//
// Real-world examples:
// - Capital One breach (2019): Misconfigured firewall + stolen credentials
// - Uber breach (2016): AWS keys in GitHub repo
// - Tesla (2018): Unencrypted S3 bucket with AWS credentials
// - Deloitte (2017): Weak admin credentials on Azure
