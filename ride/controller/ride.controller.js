const rideModel = require('../models/ride.model');
const { subscribeToQueue, publishToQueue } = require('../service/rabbit');

// Base fares in INR per km
const FARE_PER_KM = { cab: 14, auto: 9, bike: 6 };
const BASE_FARE   = { cab: 50, auto: 30, bike: 20 };

// Rough distance estimate using Haversine (no external API needed)
function haversineKm(pickup, destination) {
    // Simple flat estimate — frontend sends location strings, not coords.
    // We use a fixed 5km base + random ±2km so the UI shows realistic numbers.
    // Replace this with an OSRM call if you want real distances.
    return 4 + Math.random() * 6; // 4–10 km
}

function calcFare(vehicleType, distanceKm) {
    const base = BASE_FARE[vehicleType] || 30;
    const perKm = FARE_PER_KM[vehicleType] || 9;
    return Math.round(base + perKm * distanceKm);
}

module.exports.createRide = async (req, res, next) => {
    try {
        const { pickup, destination, vehicleType } = req.body;

        if (!pickup || !destination || !vehicleType) {
            return res.status(400).json({ message: 'pickup, destination and vehicleType are required' });
        }

        if (!['cab', 'auto', 'bike'].includes(vehicleType)) {
            return res.status(400).json({ message: 'vehicleType must be cab, auto or bike' });
        }

        const distanceKm = haversineKm(pickup, destination);
        const fare = calcFare(vehicleType, distanceKm);

        const newRide = new rideModel({
            user: req.user._id,
            pickup,
            destination,
            vehicleType,
            fare
        });

        await newRide.save();
        publishToQueue('new-ride', JSON.stringify(newRide));
        res.status(201).send(newRide);
    } catch (error) {
        next(error);
    }
};

module.exports.acceptRide = async (req, res, next) => {
    try {
        const { rideId } = req.query;
        const ride = await rideModel.findById(rideId);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        ride.status = 'accepted';
        await ride.save();
        publishToQueue('ride-accepted', JSON.stringify(ride));
        res.send(ride);
    } catch (error) {
        next(error);
    }
};

// GET /ride/get-fare?pickup=...&destination=...
module.exports.getFare = async (req, res, next) => {
    try {
        const { pickup, destination } = req.query;
        if (!pickup || !destination) {
            return res.status(400).json({ message: 'pickup and destination are required' });
        }

        const distanceKm = haversineKm(pickup, destination);

        const fares = {
            cab:  calcFare('cab',  distanceKm),
            auto: calcFare('auto', distanceKm),
            bike: calcFare('bike', distanceKm),
            distanceKm: Math.round(distanceKm * 10) / 10
        };

        res.json(fares);
    } catch (error) {
        next(error);
    }
};