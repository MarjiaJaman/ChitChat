const User = require('../models/User');

exports.getAll = async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { fullName, gender, dateOfBirth, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Password and confirm password must match' });
    }

    // Validate gender
    if (gender !== null && gender !== undefined && gender !== '' && !['Male', 'Female'].includes(gender)) {
      return res.status(400).json({ message: 'Gender must be either Male or Female' });
    }

    const user = await User.create({ fullName, gender, dateOfBirth, email, password });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Email already in use' });
    }
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { gender } = req.body;

    // Validate gender if provided
    if (gender !== null && gender !== undefined && gender !== '' && !['Male', 'Female'].includes(gender)) {
      return res.status(400).json({ message: 'Gender must be either Male or Female' });
    }

    const user = await User.update(req.params.id, req.body);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const deleted = await User.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};
