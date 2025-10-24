const jwt = require('jsonwebtoken');
const db = require('../db/db');

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token.' });
    }
    req.user = user;
    next();
  });
};

exports.authorizeRoles = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
  }
  next();
};

exports.authorize = (permissionName) => async (req, res, next) => {
  //  try {
  //     const userId = req.user.id;

  //     // Get all roles for this user
  //     const rolesResult = await db.query(
  //       `SELECT r.id, r.name
  //        FROM user_roles ur
  //        JOIN roles r ON ur.role_id = r.id
  //        WHERE ur.user_id = $1`,
  //       [userId]
  //     );
  //     console.log('roles result', rolesResult.rows);
      

  //     const roleIds = rolesResult.rows.map(r => r.id);
  //     if (roleIds.length === 0) {
  //       return res.status(403).json({ message: 'User has no roles' });
  //     }

  //     // Get all permissions for those roles
  //     const permResult = await db.query(
  //       `SELECT p.name
  //        FROM role_permissions rp
  //        JOIN permissions p ON p.id = rp.permission_id
  //        WHERE rp.role_id = ANY($1::int[])`,
  //       [roleIds]
  //     );
  //     console.log('permission result', permResult.rows);
      

  //     const permissions = permResult.rows.map(p => p.name);

  //     // Check permission
  //     if (!permissions.includes(permissionName)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     next();
  //   } catch (err) {
  //     console.error(err);
  //     res.status(500).json({ message: 'Server error' });
  //   }

  console.log('user object structure', req.user);
  
  if (!req.user.permissions.includes(permissionName)) {
    return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
  }
  next();
};