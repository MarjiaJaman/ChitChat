// Global error handler — must be registered last in server.js
module.exports = (err, req, res, next) => {
  console.error(`[${req.method}] ${req.path} —`, err.message || err);
  res.status(500).json({ message: 'Internal server error' });
};
