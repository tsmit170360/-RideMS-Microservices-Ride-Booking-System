const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBIT_URL;

let connection, channel;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect(retries = 10, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            connection = await amqp.connect(RABBITMQ_URL);
            channel = await connection.createChannel();
            console.log('Connected to RabbitMQ');
            return;
        } catch (err) {
            console.log(`RabbitMQ connection attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt === retries) throw err;
            await sleep(delayMs);
        }
    }
}

async function subscribeToQueue(queueName, callback) {
    if (!channel) await connect();
    await channel.assertQueue(queueName);
    channel.consume(queueName, (message) => {
        callback(message.content.toString());
        channel.ack(message);
    });
}

async function publishToQueue(queueName, data) {
    if (!channel) await connect();
    await channel.assertQueue(queueName);
    channel.sendToQueue(queueName, Buffer.from(data));
}

module.exports = {
    subscribeToQueue,
    publishToQueue,
    connect,
};
