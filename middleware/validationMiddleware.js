const Joi = require('joi');

const createValidator = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body || {}, {
    abortEarly: false,
    convert: true,
    allowUnknown: false,
  });

  if (error) {
    return res.status(400).json({ 
      errors: error.details.map((d) => ({ 
        msg: d.message, 
        param: d.path.join('.') 
      }))
    });
  }

  req.body = value;
  next();
};

const mobilePattern = /^\+?[0-9]{7,15}$/;

const registrationSchema = Joi.object({
  username: Joi.string().min(3).required().messages({
    'string.base': 'Username must be a string',
    'string.empty': 'Username is required',
    'string.min': 'Username must be at least 3 characters long',
    'any.required': 'Username is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please include a valid email',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required',
  }),
  mobile: Joi.string().pattern(mobilePattern).required().messages({
    'string.pattern.base': 'Please include a valid mobile number',
    'any.required': 'Mobile number is required',
  }),
});

const loginSchema = Joi.object({
  username: Joi.string().required().messages({ 'any.required': 'Username is required', 'string.empty': 'Username is required' }),
  password: Joi.string().required().messages({ 'any.required': 'Password is required', 'string.empty': 'Password is required' }),
});

const addStudentSchema = Joi.object({
  username: Joi.string().min(3).required().messages({ 'string.min': 'Username must be at least 3 characters long', 'any.required': 'Username is required' }),
  email: Joi.string().email().required().messages({ 'string.email': 'Please include a valid email', 'any.required': 'Email is required' }),
  password: Joi.string().min(6).required().messages({ 'string.min': 'Password must be at least 6 characters long', 'any.required': 'Password is required' }),
  mobile: Joi.string().pattern(mobilePattern).required().messages({ 'string.pattern.base': 'Please include a valid mobile number', 'any.required': 'Mobile number is required' }),
  first_name: Joi.string().required().messages({ 'any.required': 'First name is required', 'string.empty': 'First name is required' }),
  last_name: Joi.string().required().messages({ 'any.required': 'Last name is required', 'string.empty': 'Last name is required' }),
  date_of_birth: Joi.date().iso().optional().messages({ 'date.format': 'Invalid date of birth' }),
});

const editStudentSchema = Joi.object({
  username: Joi.string().min(3).optional().allow('').messages({ 'string.min': 'Username must be at least 3 characters long' }),
  email: Joi.string().email().optional().allow('').messages({ 'string.email': 'Please include a valid email' }),
  mobile: Joi.string().pattern(mobilePattern).optional().allow('').messages({ 'string.pattern.base': 'Please include a valid mobile number' }),
  first_name: Joi.string().optional().allow('').messages({}),
  last_name: Joi.string().optional().allow('').messages({}),
  date_of_birth: Joi.date().iso().optional().allow('', null).messages({ 'date.format': 'Invalid date of birth' }),
  is_active: Joi.boolean().optional(),
}).options({ stripUnknown: true });

exports.validateRegistration = createValidator(registrationSchema);
exports.validateLogin = createValidator(loginSchema);
exports.validateAddStudent = createValidator(addStudentSchema);
exports.validateEditStudent = createValidator(editStudentSchema);
