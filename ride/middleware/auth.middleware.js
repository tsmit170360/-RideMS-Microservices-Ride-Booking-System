const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// ─── Separate connections to each service's database ─────────────────
// The ride service cannot find users/captains in its own DB.
// We open lightweight secondary connections directly to the user and
// captain databases so we can verify tokens without HTTP calls.

let userConn = null;
let captainConn = null;

const getUserConn = () => {
    if (!userConn) {
        userConn = mongoose.createConnection(process.env.USER_MONGO_URL);
    }
    return userConn;
};

const getCaptainConn = () => {
    if (!captainConn) {
        captainConn = mongoose.createConnection(process.env.CAPTAIN_MONGO_URL);
    }
    return captainConn;
};

// ─── Schemas ──────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: { type: String, select: false }
});

const captainSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: { type: String, select: false },
    isAvailable: Boolean
});

const blacklistSchema = new mongoose.Schema({ token: String });

// ─── Middleware ───────────────────────────────────────────────────────
module.exports.userAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Unauthorized' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const conn = getUserConn();
        const User = conn.models.user || conn.model('user', userSchema);
        const Blacklist = conn.models.BlacklistToken || conn.model('BlacklistToken', blacklistSchema);

        const isBlacklisted = await Blacklist.findOne({ token });
        if (isBlacklisted) return res.status(401).json({ message: 'Unauthorized' });

        const user = await User.findById(decoded.id);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        req.user = user;
        next();
    } catch (error) {
        console.error('userAuth error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports.captainAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Unauthorized' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const conn = getCaptainConn();
        const Captain = conn.models.captain || conn.model('captain', captainSchema);
        const Blacklist = conn.models.BlacklistToken || conn.model('BlacklistToken', blacklistSchema);

        const isBlacklisted = await Blacklist.findOne({ token });
        if (isBlacklisted) return res.status(401).json({ message: 'Unauthorized' });

        const captain = await Captain.findById(decoded.id);
        if (!captain) return res.status(401).json({ message: 'Unauthorized' });

        req.captain = captain;
        next();
    } catch (error) {
        console.error('captainAuth error:', error.message);
        res.status(500).json({ message: error.message });
    }
};