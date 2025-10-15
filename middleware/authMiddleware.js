
import jwt from "jsonwebtoken";

// Middleware to verify JWT token
export const verifyToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ message: "Unauthorized: No token provided" });

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized: Invalid token" });

    // Attach user info to request object
    req.user = decoded;

    // Proceed to next middleware or route handler
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    res.status(401).json({ message: "Unauthorized: Token verification failed" });
  }
};

// Optional: Middleware to check if user is admin
export const verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin)
    return res.status(403).json({ message: "Forbidden: Admins only" });
  next();
};