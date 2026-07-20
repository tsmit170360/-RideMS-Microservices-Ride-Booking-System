const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors')
const app = express();
const connect = require('./db/db');
connect();
const cookieParser = require('cookie-parser');
const rideRoutes = require('./routes/ride.routes');
const rabbitMq = require('./service/rabbit')

rabbitMq.connect();

app.use(cors({ origin: 'http://localhost:5174', credentials: true }))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.use('/', rideRoutes);


module.exports = app;