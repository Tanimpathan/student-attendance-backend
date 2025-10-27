class AppError extends Error {
  constructor(message, statusCode, errorCode = null, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Auth related errors
class AuthenticationError extends AppError {
  constructor(message = 'Invalid credentials', errorCode = 'AUTH_001') {
    super(message, 401, errorCode);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', errorCode = 'AUTH_002') {
    super(message, 403, errorCode);
  }
}

class TokenExpiredError extends AppError {
  constructor(message = 'Token expired', errorCode = 'AUTH_003') {
    super(message, 401, errorCode);
  }
}

class InvalidTokenError extends AppError {
  constructor(message = 'Invalid token', errorCode = 'AUTH_004') {
    super(message, 401, errorCode);
  }
}

// Input validation errors
class ValidationError extends AppError {
  constructor(message = 'Invalid input data', errorCode = 'VAL_001', details = null) {
    super(message, 400, errorCode);
    this.details = details;
  }
}

class DuplicateDataError extends AppError {
  constructor(message = 'Data already exists', errorCode = 'VAL_002', field = null) {
    super(message, 409, errorCode);
    this.field = field;
  }
}

// Database related errors
class DatabaseError extends AppError {
  constructor(message = 'Database error occurred', errorCode = 'DB_001', originalError = null) {
    super(message, 500, errorCode);
    this.originalError = originalError;
  }
}

class RecordNotFoundError extends AppError {
  constructor(message = 'Record not found', errorCode = 'DB_002', resource = null) {
    super(message, 404, errorCode);
    this.resource = resource;
  }
}

class DatabaseConnectionError extends AppError {
  constructor(message = 'Database connection failed', errorCode = 'DB_003') {
    super(message, 503, errorCode);
  }
}

// File handling errors
class FileError extends AppError {
  constructor(message = 'File error', errorCode = 'FILE_001', fileName = null) {
    super(message, 400, errorCode);
    this.fileName = fileName;
  }
}

class FileNotFoundError extends AppError {
  constructor(message = 'File not found', errorCode = 'FILE_002', fileName = null) {
    super(message, 404, errorCode);
    this.fileName = fileName;
  }
}

class InvalidFileTypeError extends AppError {
  constructor(message = 'Invalid file type', errorCode = 'FILE_003', allowedTypes = null) {
    super(message, 400, errorCode);
    this.allowedTypes = allowedTypes;
  }
}

// Business logic errors
class BusinessLogicError extends AppError {
  constructor(message = 'Invalid operation', errorCode = 'BIZ_001') {
    super(message, 422, errorCode);
  }
}

class ResourceConflictError extends AppError {
  constructor(message = 'Resource conflict', errorCode = 'BIZ_002') {
    super(message, 409, errorCode);
  }
}

// External service errors
class ExternalServiceError extends AppError {
  constructor(message = 'External service error', errorCode = 'EXT_001', service = null) {
    super(message, 502, errorCode);
    this.service = service;
  }
}

// Rate limiting
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', errorCode = 'RATE_001') {
    super(message, 429, errorCode);
  }
}

// Configuration issues
class ConfigurationError extends AppError {
  constructor(message = 'Configuration error', errorCode = 'CONFIG_001') {
    super(message, 500, errorCode);
  }
}

// Helper functions to create common errors
const createValidationError = (message, details = null) => {
  return new ValidationError(message, 'VAL_001', details);
};

const createDuplicateError = (field, value) => {
  return new DuplicateDataError(
    `${field} '${value}' already exists`,
    'VAL_002',
    field
  );
};

const createNotFoundError = (resource, identifier) => {
  return new RecordNotFoundError(
    `${resource} with identifier '${identifier}' not found`,
    'DB_002',
    resource
  );
};

const createDatabaseError = (operation, originalError = null) => {
  return new DatabaseError(
    `Database ${operation} failed`,
    'DB_001',
    originalError
  );
};

const createAuthenticationError = (reason = 'Invalid credentials') => {
  return new AuthenticationError(reason, 'AUTH_001');
};

const createAuthorizationError = (action = 'access this resource') => {
  return new AuthorizationError(`Insufficient permissions to ${action}`, 'AUTH_002');
};

// Utility functions to check error types
const isOperationalError = (error) => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

const isDatabaseError = (error) => {
  return error instanceof DatabaseError || 
         error instanceof RecordNotFoundError || 
         error instanceof DatabaseConnectionError;
};

const isValidationError = (error) => {
  return error instanceof ValidationError || 
         error instanceof DuplicateDataError;
};

const isAuthenticationError = (error) => {
  return error instanceof AuthenticationError || 
         error instanceof AuthorizationError ||
         error instanceof TokenExpiredError ||
         error instanceof InvalidTokenError;
};

// Format error response for client
const formatErrorResponse = (error, isDevelopment = false) => {
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode || 'UNKNOWN_ERROR',
      timestamp: error.timestamp || new Date().toISOString(),
    }
  };

  // Add extra info in development mode
  if (isDevelopment) {
    response.error.stack = error.stack;
    response.error.name = error.name;
    if (error.details) response.error.details = error.details;
    if (error.field) response.error.field = error.field;
    if (error.resource) response.error.resource = error.resource;
  }

  return response;
};

module.exports = {
  // Main error class
  AppError,
  
  // Error types
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  InvalidTokenError,
  ValidationError,
  DuplicateDataError,
  DatabaseError,
  RecordNotFoundError,
  DatabaseConnectionError,
  FileError,
  FileNotFoundError,
  InvalidFileTypeError,
  BusinessLogicError,
  ResourceConflictError,
  ExternalServiceError,
  RateLimitError,
  ConfigurationError,
  
  // Helper functions
  createValidationError,
  createDuplicateError,
  createNotFoundError,
  createDatabaseError,
  createAuthenticationError,
  createAuthorizationError,
  
  // Utility functions
  isOperationalError,
  isDatabaseError,
  isValidationError,
  isAuthenticationError,
  formatErrorResponse
};