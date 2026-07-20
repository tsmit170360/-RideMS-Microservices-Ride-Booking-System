const captainModel = require('../models/captain.model');
const blacklisttokenModel = require('../models/blacklisttoken.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { subscribeToQueue } = require('../service/rabbit');

// ─── In-memory ride queue ─────────────────────────────────────────────
// Rides published by the ride-service land here first.
// When a captain polls /new-ride we immediately give them the oldest
// waiting ride, or hold their connection open until one arrives.

const rideQueue = [];       // rides waiting to be dispatched
const pendingCaptains = []; // captain HTTP responses waiting for a ride

function dispatchRide(rideData) {
    if (pendingCaptains.length > 0) {
        const res = pendingCaptains.shift();
        try { res.json(rideData); } catch {}
    } else {
        rideQueue.push(rideData);
        if (rideQueue.length > 20) rideQueue.shift();
    }
}

// Subscribe once at startup
subscribeToQueue("new-ride", (data) => {
    try {
        const rideData = JSON.parse(data);
        console.log('new-ride received:', rideData._id);
        dispatchRide(rideData);
    } catch (e) {
        console.error('Failed to parse new-ride:', e.message);
    }
});

// ─── Controllers ──────────────────────────────────────────────────────
module.exports.register = async (req, res) => {
    try {
        const { name, email, password, vehicle } = req.body;

        const existing = await captainModel.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: 'Captain already exists' });
        }

        if (!vehicle || !vehicle.type || !vehicle.plate || !vehicle.color) {
            return res.status(400).json({ message: 'Vehicle type, plate and color are required' });
        }

        const hash = await bcrypt.hash(password, 10);
        const newcaptain = new captainModel({
            name, email, password: hash,
            vehicle: { type: vehicle.type, plate: vehicle.plate, color: vehicle.color }
        });

        await newcaptain.save();
        const token = jwt.sign({ id: newcaptain._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token);
        delete newcaptain._doc.password;
        res.send({ token, newcaptain });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const captain = await captainModel.findOne({ email }).select('+password');
        if (!captain) return res.status(400).json({ message: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, captain.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

        const token = jwt.sign({ id: captain._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        delete captain._doc.password;
        res.cookie('token', token);
        res.send({ token, captain });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.logout = async (req, res) => {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (token) await blacklisttokenModel.create({ token });
        res.clearCookie('token');
        res.send({ message: 'Captain logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.profile = async (req, res) => {
    try {
        res.send(req.captain);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.toggleAvailability = async (req, res) => {
    try {
        const captain = await captainModel.findById(req.captain._id);
        captain.isAvailable = !captain.isAvailable;
        await captain.save();
        res.send(captain);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.waitForNewRide = async (req, res) => {
    // If a ride is already queued, send immediately
    if (rideQueue.length > 0) {
        const ride = rideQueue.shift();
        console.log('Dispatching queued ride to captain:', ride._id);
        return res.json(ride);
    }

    // Hold connection open up to 30s
    const timeout = setTimeout(() => {
        const idx = pendingCaptains.indexOf(res);
        if (idx !== -1) pendingCaptains.splice(idx, 1);
        try { res.status(204).end(); } catch {}
    }, 30000);

    pendingCaptains.push(res);

    req.on('close', () => {
        clearTimeout(timeout);
        const idx = pendingCaptains.indexOf(res);
        if (idx !== -1) pendingCaptains.splice(idx, 1);
    });
};