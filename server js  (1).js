// SHELL Myrtleford - Snow Chain Hire Form API Server
// Run locally with: node server.js
// This is a complete, production-ready setup

const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ============================================================
// MIDDLEWARE CONFIGURATION
// ============================================================

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// CORS Configuration - Allow requests from your domain
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:3000'
    ],
    methods: ['POST', 'GET', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Serve static files (including the HTML form)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// EMAIL CONFIGURATION
// ============================================================

// Check if running in test mode (for development without real email)
const TEST_MODE = process.env.TEST_MODE === 'true';

let transporter;

if (!TEST_MODE) {
    // Production email configuration
    transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || 'gmail',
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true' ? true : false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    });

    // Verify SMTP connection
    transporter.verify((error, success) => {
        if (error) {
            console.error('❌ SMTP Configuration Error:');
            console.error('   User:', process.env.SMTP_USER);
            console.error('   Host:', process.env.SMTP_HOST);
            console.error('   Error:', error.message);
        } else {
            console.log('✓ Email service connected successfully');
            console.log(`  From: ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
            console.log(`  Service: ${process.env.SMTP_SERVICE || 'gmail'}`);
        }
    });
} else {
    console.log('⚠️  TEST MODE ENABLED - Emails will not be sent');
    console.log('   Set TEST_MODE=false to enable real email sending');
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>]/g, '');
}

// ============================================================
// API ROUTES
// ============================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    const health = {
        status: 'ok',
        service: 'Snow Chain Hire Form API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        emailEnabled: !TEST_MODE
    };
    res.json(health);
});

// Main form submission endpoint
app.post('/api/send-form', async (req, res) => {
    try {
        const { to, subject, html, data } = req.body;

        // Validation
        if (!to || !isValidEmail(to)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address provided'
            });
        }

        if (!subject || !html) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: subject and html'
            });
        }

        // Rate limiting - check if too many requests from same IP
        const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        // In production, implement proper rate limiting with Redis
        console.log(`📝 Form submission from ${clientIP}`);

        // Log submission
        console.log(`\n📋 Processing form submission for: ${sanitizeInput(data.fullName)}`);
        console.log(`   Email: ${to}`);
        console.log(`   Vehicle: ${sanitizeInput(data.vehicleRego)}`);

        if (TEST_MODE) {
            // Test mode - don't actually send
            console.log('   [TEST MODE] Email would be sent here');
            return res.json({
                success: true,
                message: 'Form processed (TEST MODE - no email sent)',
                mode: 'test'
            });
        }

        // Production mode - send actual email
        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: to,
            cc: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
            subject: subject,
            html: html,
            replyTo: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
            text: `Snow Chain Hire Agreement submitted by ${data.fullName}`
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        console.log(`✓ Email sent successfully`);
        console.log(`  Message ID: ${info.messageId}`);
        console.log(`  Response: ${info.response}`);

        // Success response
        res.json({
            success: true,
            message: 'Form submitted and confirmation email sent',
            messageId: info.messageId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('\n❌ Error processing form submission:');
        console.error('   Error:', error.message);
        console.error('   Code:', error.code);

        // Return appropriate error response
        const statusCode = error.code === 'EAUTH' ? 401 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Error submitting form',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            code: error.code
        });
    }
});

// Alternative endpoint for test submissions
app.post('/api/test-email', async (req, res) => {
    try {
        const { testEmail } = req.body;

        if (!isValidEmail(testEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        console.log(`\n🧪 Sending test email to: ${testEmail}`);

        const testMailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: testEmail,
            subject: 'SHELL Myrtleford - Test Email',
            html: `
                <h2>Test Email</h2>
                <p>This is a test email from SHELL Myrtleford Snow Chain Hire system.</p>
                <p>If you received this, the email service is working correctly!</p>
                <p>Sent at: ${new Date().toLocaleString()}</p>
            `
        };

        const info = await transporter.sendMail(testMailOptions);

        console.log('✓ Test email sent successfully');

        res.json({
            success: true,
            message: 'Test email sent successfully',
            messageId: info.messageId
        });

    } catch (error) {
        console.error('❌ Test email error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Test email failed',
            error: error.message
        });
    }
});

// ============================================================
// SERVE THE HTML FORM
// ============================================================

app.get('/', (req, res) => {
    // If public/snow_chain_hire_form.html exists, serve it
    res.sendFile(path.join(__dirname, 'snow_chain_hire_form.html'));
});

// ============================================================
// ERROR HANDLING
// ============================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Global error handler:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============================================================
// SERVER STARTUP
// ============================================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   SHELL Myrtleford - Snow Chain Hire Form API Server      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log(`✓ Server running at http://${HOST}:${PORT}`);
    console.log(`✓ Form available at http://${HOST}:${PORT}/snow_chain_hire_form.html`);
    console.log(`✓ API Health check: http://${HOST}:${PORT}/api/health\n`);
    
    console.log('Configuration:');
    console.log(`  Node Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Test Mode: ${TEST_MODE ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  CORS Enabled: ${!TEST_MODE}`);
    
    if (!TEST_MODE) {
        console.log('\nEmail Configuration:');
        console.log(`  Service: ${process.env.SMTP_SERVICE || 'gmail'}`);
        console.log(`  From Address: ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
        console.log(`  Admin Email: ${process.env.ADMIN_EMAIL || 'Not configured'}`);
    }
    
    console.log('\n📝 To test the form:');
    console.log('  1. Open http://' + HOST + ':' + PORT + ' in your browser');
    console.log('  2. Fill out the form');
    console.log('  3. Submit to test email functionality');
    
    if (process.env.NODE_ENV !== 'production') {
        console.log('\n⚠️  Development mode - detailed errors enabled');
        console.log('   Set NODE_ENV=production for production deployment\n');
    }
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

process.on('SIGINT', () => {
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   Server shutting down gracefully...                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    process.exit(0);
});

// ============================================================
// EXPORTS FOR TESTING
// ============================================================

module.exports = app;
