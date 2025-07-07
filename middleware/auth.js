const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  console.log('AUTH HEADERS:', req.headers);

  const authHeader = req.headers.authorization; // Always lowercase
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No token provided");
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set in environment variables!");
    return res.status(500).json({ message: "Server misconfiguration" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded JWT user:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("JWT error:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = requireAuth;