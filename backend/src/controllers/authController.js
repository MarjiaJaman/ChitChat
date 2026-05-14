const bcrypt = require('bcryptjs');
const User = require('../models/User');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      createdAt: user.created_at,
    });
  } catch (err) {
    next(err);
  }
};
