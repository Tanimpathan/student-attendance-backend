const logger = require('../utils/logger');
const {
  AppError,
  isOperationalError,
  formatErrorResponse,
  // Removed less common errors for simplification
} = require('../utils/errors');


exports.errorHandler = (err, req, res, next) => {
  let error = err;

  // Log error details for debugging
  logger.error('Error occurred:', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || 'SERVER_ERROR',
      isOperational: isOperationalError(error),
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
