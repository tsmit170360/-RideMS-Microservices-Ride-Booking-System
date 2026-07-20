const express = require('express')
const expressProxy = require('express-http-proxy')
const cors = require('cors')

const app = express()

const corsOptions = {
    origin: 'http://localhost:5174',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

app.use('/user', expressProxy('http://localhost:3001'))
app.use('/captain', expressProxy('http://localhost:3002'))
app.use('/ride', expressProxy('http://localhost:3003'))

app.listen(3000, () => console.log('Gateway server listening on port 3000'))