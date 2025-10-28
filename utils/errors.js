class AppError extends Error {
  constructor(message, statusCode, errorCode = null, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', errorCode = 'AUTH_001') {
    super(message, 401, errorCode);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Authorization denied', errorCode = 'AUTH_002') {
    super(message, 403, errorCode);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid input', errorCode = 'VAL_001', details = null) {
    super(message, 400, errorCode);
    this.details = details;
  }
}

class DuplicateDataError extends AppError {
  constructor(message = 'Duplicate data', errorCode = 'VAL_002', field = null) {
    super(message, 409, errorCode);
    this.field = field;
  }
}

class RecordNotFoundError extends AppError {
  constructor(message = 'Record not found', errorCode = 'DB_001', resource = null) {
    super(message, 404, errorCode);
    this.resource = resource;
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', errorCode = 'DB_002', originalError = null) {
    super(message, 500, errorCode);
    this.originalError = originalError;
  }
}

class FileError extends AppError {
  constructor(message = 'File operation failed', errorCode = 'FILE_001', fileName = null) {
    super(message, 500, errorCode);
    this.fileName = fileName;
  }
}

class ConfigurationError extends AppError {
  constructor(message = 'Configuration error', errorCode = 'CONFIG_001') {
    super(message, 500, errorCode);
  }
}

const isOperationalError = (error) => error instanceof AppError && error.isOperational;

const formatErrorResponse = (error, isDevelopment = false) => {
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    }
  };
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
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  DuplicateDataError,
  RecordNotFoundError,
  DatabaseError,
  FileError,
  ConfigurationError,
  isOperationalError,
  formatErrorResponse,
};
