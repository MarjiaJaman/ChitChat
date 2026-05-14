const bcrypt = require('bcryptjs');
const db = require('../config/db');

const User = {
  findAll: async () => {
    return await db.User.findAll({
      attributes: ['id', 'full_name', 'gender', 'date_of_birth', 'email', 'created_at', 'updated_at']
    });
  },

  findById: async (id) => {
    return await db.User.findByPk(id, {
      attributes: ['id', 'full_name', 'gender', 'date_of_birth', 'email', 'created_at', 'updated_at']
    });
  },

  findByEmail: async (email) => {
    return await db.User.findOne({
      where: { email }
    });
  },

  create: async ({ fullName, gender, dateOfBirth, email, password }) => {
    const hashed = await bcrypt.hash(password, 10);
    const user = await db.User.create({
      fullName,
      gender: gender || null,
      dateOfBirth,
      email,
      password: hashed
    });
    return User.findById(user.id);
  },

  update: async (id, { fullName, gender, dateOfBirth, email, password }) => {
    const existing = await User._findByIdWithPassword(id);
    if (!existing) return null;
    const hashed = password ? await bcrypt.hash(password, 10) : existing.password;
    await db.User.update(
      {
        fullName: fullName || existing.fullName,
        gender: gender !== undefined ? gender : existing.gender,
        dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : existing.dateOfBirth,
        email: email || existing.email,
        password: hashed
      },
      { where: { id } }
    );
    return User.findById(id);
  },

  delete: async (id) => {
    const result = await db.User.destroy({ where: { id } });
    return result > 0;
  },

  _findByIdWithPassword: async (id) => {
    return await db.User.findByPk(id);
  },
};

module.exports = User;
