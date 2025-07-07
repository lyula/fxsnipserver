const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  console.log("AUTH HEADERS:", req.headers); // <-- Added this
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No token provided");
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("JWT error:", err); // <-- Added this
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = requireAuth;