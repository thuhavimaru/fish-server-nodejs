const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Tạo database lưu lịch sử
const db = new sqlite3.Database('fish.db');
db.run(`CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT,
  device TEXT,
  action TEXT,
  source TEXT
)`);

// MQTT Client kết nối chính server này
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('MQTT đã sẵn sàng!');
  client.subscribe('fish/#');
});

client.on('message', (topic, message) => {
  const msg = message.toString();
  console.log(`→ ${topic}: ${msg}`);
  io.emit('data', { topic, message: msg });

  // Lưu lịch sử khi có lệnh bật/tắt
  if (topic.includes('pump') || topic.includes('light')) {
    const device = topic.includes('pump') ? 'Bơm' : 'Đèn';
    const action = msg;
    const source = topic.split('/').pop();
    db.run('INSERT INTO history(time, device, action, source) VALUES(datetime("now","localtime"), ?, ?, ?)', 
      [device, action, source]);
  }
});

// Web server
app.use(express.static('web'));

app.get('/api/history', (req, res) => {
  db.all('SELECT * FROM history ORDER BY id DESC LIMIT 100', [], (err, rows) => {
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=====================================');
  console.log('   SERVER NODE.JS ĐANG CHẠY TRÊN INTERNET!');
  console.log(`   Web: http://localhost:${PORT}`);
  console.log(`   Hoặc truy cập từ xa qua Render/ngrok`);
  console.log('   MQTT: mqtt://0.0.0.0:1883');
  console.log('=====================================');
});