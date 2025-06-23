// server.js
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const PORT = 3000;

let players = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Add new player
  players[socket.id] = { x: 100, y: 100 };

  // Send current state
  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });

  // Movement
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x += data.dx;
      players[socket.id].y += data.dy;
      io.emit('playerMoved', { id: socket.id, ...players[socket.id] });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
