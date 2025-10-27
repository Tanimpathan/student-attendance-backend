const logger = require('../utils/logger');
const { 
  AppError, 
  isOperationalError, 
  formatErrorResponse,
  DatabaseError,
  DatabaseConnectionError,
  ConfigurationError
} = require('../utils/errors');


exports.errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details
  logger.error('Error occurred:', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode || 500,
      errorCode: err.errorCode,
      isOperational: isOperationalError(err),
      timestamp: new Date().toISOString()
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || null
    }
  });

  // Handle common error types
  if (err.name === 'ValidationError') {
    error = new AppError('Invalid input data', 400, 'VAL_001');
  }

  if (err.name === 'CastError') {
    error = new AppError('Invalid ID format', 400, 'VAL_002');
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new AppError(
      `${field} already exists`,
      409,
      'VAL_003'
    );
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, 'AUTH_001');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401, 'AUTH_002');
  }

  // Handle PostgreSQL specific errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        error = new AppError('Duplicate entry found', 409, 'DB_001');
        break;
      case '23503': // Foreign key violation
        error = new AppError('Referenced record not found', 400, 'DB_002');
        break;
      case '23502': // Not null violation
        error = new AppError('Required field is missing', 400, 'DB_003');
        break;
      case '42P01': // Undefined table
        error = new DatabaseError('Database table not found', 'DB_004', err);
        break;
      case 'ECONNREFUSED':
      case 'ENOTFOUND':
        error = new DatabaseConnectionError('Database connection failed', 'DB_005');
        break;
      default:
        if (!isOperationalError(error)) {
          error = new DatabaseError('Database operation failed', 'DB_006', err);
        }
    }
  }

  // Handle file system errors
  if (err.code === 'ENOENT') {
    error = new AppError('File not found', 404, 'FILE_001');
  }

  if (err.code === 'EACCES') {
    error = new AppError('Permission denied', 403, 'FILE_002');
  }

  // Handle multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('File too large', 413, 'FILE_003');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new AppError('Unexpected file field', 400, 'FILE_004');
  }

  // If error is not operational, create a generic server error
  if (!isOperationalError(error)) {
    error = new AppError(
      'Internal server error',
      500,
      'SERVER_001',
      false
    );
  }

  // Send error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse = formatErrorResponse(error, isDevelopment);

  res.status(error.statusCode || 500).json(errorResponse);
};

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
  
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  });
  
  process.exit(1);
});

/**
 * Wrapper for async route handlers to catch errors
 */
exports.asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
