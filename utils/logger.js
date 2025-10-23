const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors, json, metadata } = format;
const path = require('path');
const util = require('util');

// Custom format for development environment
const developmentFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      const formattedMeta = util.inspect(meta, { 
        colors: true, 
        depth: 3, 
        compact: false 
      });
      log += `\n${formattedMeta}`;
    }
    
    return log;
  })
);

// Custom format for production environment
const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  metadata({ fillWith: ['service', 'env', 'correlationId', 'userId'] }),
  json()
);

// Custom format for file transports
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      ...(stack && { stack }),
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Create the logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'your-service-name',
    env: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error logs (only errors)
    new transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined logs (all levels)
    new transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new transports.File({ 
      filename: path.join(__dirname, '../logs/exceptions.log'),
      format: fileFormat,
    })
  ],
  rejectionHandlers: [
    new transports.File({ 
      filename: path.join(__dirname, '../logs/rejections.log'),
      format: fileFormat,
    })
  ],
  exitOnError: false
});

// Console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: developmentFormat,
    handleExceptions: true,
    handleRejections: true,
  }));
} else {
  // In production, you might want structured console logs too
  logger.add(new transports.Console({
    format: productionFormat,
    handleExceptions: true,
    handleRejections: true,
  }));
}

// Request logger middleware for Express
logger.expressMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const correlationId = req.headers['x-correlation-id'] || 'none';
    
    logger.info(`${req.method} ${req.originalUrl}`, {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
};

module.exports = logger;