const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3002;

const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`captain service is running on port ${PORT}`);
});

const shutdown = (signal) => {
    console.log(`${signal} received, shutting down captain service gracefully`);

    const forceExit = setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 25000);

    server.close(() => {
        mongoose.connection.close(false).finally(() => {
            clearTimeout(forceExit);
            process.exit(0);
        });
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
