const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Database
const db = new sqlite3.Database('fish.db');
db.run(`CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT,
  device TEXT,
  action TEXT,
  source TEXT
)`);

// MQTT Client
const client = mqtt.connect('mqtt://0.0.0.0:1883');
client.on('connect', () => {
  console.log('MQTT đã sẵn sàng!');
  client.subscribe('fish/#');
});

client.on('message', (topic, message) => {
  const msg = message.toString();
  console.log(`→ ${topic}: ${msg}`);
  io.emit('data', { topic, message: msg });

  if (topic.includes('pump') || topic.includes('light')) {
    const device = topic.includes('pump') ? 'Bơm' : 'Đèn';
    const action = msg;
    const source = topic.split('/').pop();
    db.run('INSERT INTO history(time, device, action, source) VALUES(datetime("now","localtime"), ?, ?, ?)', 
      [device, action, source]);
  }
});

// Web + static files
app.use(express.static('web'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/web/index.html');
});

// API lịch sử
app.get('/api/history', (req, res) => {
  db.all('SELECT * FROM history ORDER BY id DESC LIMIT 100', [], (err, rows) => {
    res.json(rows);
  });
});

// API gửi lệnh từ web
app.get('/send', (req, res) => {
  const cmd = req.query.cmd;
  if (cmd && cmd.startsWith('fish/')) {
    const parts = cmd.split('/');
    const topic = parts[0] + '/' + parts[1] + '/' + parts[2];
    const action = parts[2];
    const source = parts[3] || 'web';

    console.log(`Web gửi lệnh: ${topic} -> ${action} (nguồn: ${source})`);
    client.publish(topic, action);

    const device = parts[1] === 'pump' ? 'Bơm' : 'Đèn';
    db.run('INSERT INTO history(time, device, action, source) VALUES(datetime("now","localtime"), ?, ?, ?)', 
      [device, action.toUpperCase(), source]);

    res.send('OK');
  } else {
    res.status(400).send('Lệnh sai');
  }
});

// Listen
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('=====================================');
  console.log('   SERVER ĐÃ HOÀN HẢO – CHỈ CẦN UPLOAD ESP!');
  console.log(`   URL: https://fish-server-nodejs-1.onrender.com`);
  console.log('=====================================');
});