const db = require('./config/db');

async function migrate() {
  try {
    // Sync all models to the database
    await db.sequelize.sync({ alter: true });
    console.log('✅ Database migration complete');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

module.exports = migrate;
