// Middleware factory: ensures required body fields are present
exports.requireFields = (...fields) => (req, res, next) => {
  const missing = fields.filter((f) => !req.body[f]);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
  }
  next();
};
