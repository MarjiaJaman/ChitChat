const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const app = express();

app.use(bodyParser.json());

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'realtime_messenger'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as ID ' + db.threadId);
});

app.get('/api/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(500).send('Error fetching users');
      return;
    }
    res.json(results);
  });
});

app.post('/api/users', (req, res) => {
  const { first_Name, last_Name, gender, birth_Date, email, password } = req.body;
  db.query('INSERT INTO users (first_Name, last_Name, gender, birth_Date, email, password, created_At, updated_At) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [first_Name, last_Name, gender, birth_Date, email, password, new Date(), new Date()], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).send('Error creating user');
      return;
    }
    res.status(201).send('User created successfully');
  });
});

app.put('/api/users/:id', (req, res) => {
  const { first_Name, last_Name, gender, birth_Date, email, password } = req.body;
  const userId = req.params.id;
  db.query('UPDATE users SET first_Name = ?, last_Name = ?, gender = ?, birth_Date = ?, email = ?, password = ?, updated_At = ? WHERE id = ?', [first_Name, last_Name, gender, birth_Date, email, password, new Date(), userId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).send('Error updating user');
      return;
    }
    res.send('User updated successfully');
  });
});

app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  db.query('DELETE FROM users WHERE id = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).send('Error deleting user');
      return;
    }
    res.send('User deleted successfully');
  });
});