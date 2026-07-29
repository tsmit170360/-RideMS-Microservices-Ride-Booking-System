const express = require('express')
const expressProxy = require('express-http-proxy')
const cors = require('cors')

const app = express()

const PORT = process.env.PORT || 3000
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001'
const CAPTAIN_SERVICE_URL = process.env.CAPTAIN_SERVICE_URL || 'http://localhost:3002'
const RIDE_SERVICE_URL = process.env.RIDE_SERVICE_URL || 'http://localhost:3003'

const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }))

app.use('/user', expressProxy(USER_SERVICE_URL))
app.use('/captain', expressProxy(CAPTAIN_SERVICE_URL))
app.use('/ride', expressProxy(RIDE_SERVICE_URL))

app.listen(PORT, '0.0.0.0', () => console.log(`Gateway server listening on port ${PORT}`))
