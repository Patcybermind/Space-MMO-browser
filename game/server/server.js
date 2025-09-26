const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const players = {};

io.on('connection', (socket) => {
    // Wait for client to send initial position
    socket.on('initPosition', (data) => {
        players[socket.id] = { x: data.x, y: data.y };
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', { id: socket.id, x: data.x, y: data.y });
    });

    // Player moves
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x += data.dx;
            players[socket.id].y += data.dy;
            io.emit('playerMoved', { id: socket.id, x: players[socket.id].x, y: players[socket.id].y });
        }
    });

    // Player disconnects
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

app.use(express.static('../public')); // Adjust path if needed

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});