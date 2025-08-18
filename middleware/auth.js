const jwt = require("jsonwebtoken");

// Main authentication middleware (can be called protect or requireAuth)
function requireAuth(req, res, next) {
  console.log('Auth middleware called for:', req.method, req.path);
  const authHeader = req.headers.authorization; // Always lowercase
  console.log('Auth header:', authHeader);
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log('No valid auth header');
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  console.log('Token extracted:', token ? 'Token present' : 'No token');
  const decodedRaw = jwt.decode(token);

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set in environment variables!");
    return res.status(500).json({ message: "Server misconfiguration" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully, user:', decoded.id);
    console.log('Full decoded token:', decoded);
    // Ensure req.user._id is set for Mongoose queries
    if (decoded.id && !decoded._id) {
      decoded._id = decoded.id;
    }
    req.user = decoded;
    console.log('req.user set to:', req.user);
    next();
  } catch (err) {
    console.log('Token verification failed:', err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Alias for protect (for compatibility)
const protect = requireAuth;

// Authorization middleware for role-based access
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }
    
    next();
  };
}

module.exports = { requireAuth, protect, authorize };