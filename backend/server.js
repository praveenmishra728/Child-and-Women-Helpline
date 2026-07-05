/**
 * server.js
 * Express server entry point.
 * Configures middleware, security components, error parsing, and registers routes.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const config = require('./config/config');
const { apiLimiter } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
const ApiError = require('./utils/apiError');
const ApiResponse = require('./utils/apiResponse');

// Import Route Handlers
const authRoutes = require('./routes/auth.routes');
const reportRoutes = require('./routes/report.routes');
const aiRoutes = require('./routes/ai.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// 1. Security HTTP Headers using Helmet
app.use(helmet());

// 2. CORS configuration (allowing requests from web clients)
app.use(cors({
  origin: true, // Configured for flexible training/development environments
  credentials: true,
}));

// 3. Rate limiting protection
app.use('/api', apiLimiter);

// 4. Request body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Cookie parser for managing token authorization
app.use(cookieParser());

// 6. HTTP Request logging using Morgan
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 7. Base Health Check Route
app.get('/api/v1/health', (req, res) => {
  return ApiResponse.success(res, 'Safety System Server is healthy', {
    uptime: process.uptime(),
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// 8. Register Application Routers under API Versioning /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/admin', adminRoutes);

// 9. Handle 404 Undefined Resource Errors
app.use((req, res, next) => {
  next(ApiError.notFound(`Requested URL ${req.originalUrl} not found on this server.`));
});

// 10. Register Centralized Global Error Handler Middleware
app.use(errorHandler);

// Start the Express Server
const server = app.listen(config.port, () => {
  console.log(`=================================================`);
  console.log(`  Women & Child Safety Server running on Port ${config.port}`);
  console.log(`  Environment: ${config.env}`);
  console.log(`  API Health Check: http://localhost:${config.port}/api/v1/health`);
  console.log(`=================================================`);
});

// Graceful Shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
  });
});
