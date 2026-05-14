const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: 'chitchat123',
      database: 'chitchat'
    });
    console.log('✅ MySQL connection successful');
    await connection.end();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    // Try to create database
    try {
      const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: 'root',
        password: 'chitchat123'
      });
      await connection.query('CREATE DATABASE IF NOT EXISTS chitchat');
      console.log('✅ Database chitchat created');
      await connection.end();
    } catch (createErr) {
      console.error('❌ Failed to create database:', createErr.message);
    }
  }
}

testConnection();
