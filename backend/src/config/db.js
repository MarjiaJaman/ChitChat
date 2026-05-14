const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Determine MySQL host and port based on environment
let dbHost = process.env.DB_HOST || 'localhost';
let dbPort = process.env.DB_PORT || 3306;

// If connecting to localhost (not in Docker network), use the Docker-mapped port
if (dbHost === 'localhost' || dbHost === '127.0.0.1') {
  // When running outside Docker, connect to Docker-mapped MySQL port
  dbPort = 3307;
}

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: dbHost,
  port: dbPort,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'chitchat123',
  database: process.env.DB_NAME || 'chitchat',
  logging: false, // Set to true to see SQL queries
});

// Import all models from the Sequelize models directory
const models = {};
const modelDir = path.join(__dirname, '..', '..', 'models');
const modelFiles = fs.readdirSync(modelDir);

modelFiles.forEach(file => {
  if (file.endsWith('.js') && file !== 'index.js') {
    const modelPath = path.join(modelDir, file);
    const modelFactory = require(modelPath);
    if (typeof modelFactory !== 'function') {
      throw new Error(`Model factory for ${file} is not a function`);
    }
    const model = modelFactory(sequelize, Sequelize.DataTypes);
    models[model.name] = model;
  }
});

// Create associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
