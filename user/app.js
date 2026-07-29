const dotenv = require('dotenv')
dotenv.config()
const express = require('express')
const cors = require('cors')
const app = express()
const connect = require('./db/db')
connect()
const userRoutes = require('./routes/user.routes')
const cookieParser = require('cookie-parser')
const rabbitMq = require('./service/rabbit')

rabbitMq.connect()

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5174', credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }))

app.use('/', userRoutes)

module.exports = app