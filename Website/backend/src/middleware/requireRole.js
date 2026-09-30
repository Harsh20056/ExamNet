/**
 * Role-based Authorization Middleware
 * Checks if authenticated user has one of the allowed roles
 * Must be used AFTER authenticate middleware
 * 
 * @param {string[]} allowedRoles - Array of role strings (e.g., ['examiner', 'moderator'])
 * @returns {Function} Express middleware
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    // Check if user was attached by auth middleware
    if (!req.user || !req.user.role) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required. Use authenticate middleware first.' 
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${userRole}` 
      });
    }

    next();
  };
}

module.exports = requireRole;
