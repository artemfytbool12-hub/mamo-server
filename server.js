const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let activeRooms = {};

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.emit('roomList', Object.keys(activeRooms));

    socket.on('createRoom', () => {
        // Очищаем старые комнаты этого же игрока, чтобы не было дублей
        for (let code in activeRooms) {
            if (activeRooms[code].host === socket.id) {
                delete activeRooms[code];
            }
        }

        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        activeRooms[roomCode] = { host: socket.id, playerCount: 1 };
        socket.join(roomCode);
        io.emit('roomList', Object.keys(activeRooms));
        socket.emit('roomCreated', roomCode);
    });

    socket.on('getRooms', () => {
        socket.emit('roomList', Object.keys(activeRooms));
    });

    socket.on('joinRoom', (roomCode) => {
        if (activeRooms[roomCode] && activeRooms[roomCode].playerCount < 2) {
            activeRooms[roomCode].playerCount++;
            socket.join(roomCode);
            socket.emit('roomJoined', roomCode);
            io.to(roomCode).emit('gameStart');
            delete activeRooms[roomCode];
            io.emit('roomList', Object.keys(activeRooms));
        } else {
            socket.emit('errorMsg', 'Комната не найдена или заполнена!');
        }
    });

    socket.on('updatePlayer', (data) => {
        socket.to(data.roomCode).emit('opponentMoved', data);
    });

    socket.on('updateBall', (data) => {
        socket.to(data.roomCode).emit('ballMoved', data);
    });

    // ВОТ ЗДЕСЬ СЕРВЕР ОЧИЩАЕТ КОМНАТЫ ПРИ ВЫХОДЕ
    socket.on('disconnect', () => {
        for (let code in activeRooms) {
            if (activeRooms[code].host === socket.id) {
                delete activeRooms[code];
                io.emit('roomList', Object.keys(activeRooms));
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Сервер запущен на порту ' + PORT));
