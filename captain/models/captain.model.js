const mongoose = require('mongoose');

const captainSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    isAvailable: {
        type: Boolean,
        default: false
    },
    vehicle: {
        type: {
            type: String,
            enum: ['cab', 'auto', 'bike'],
            required: true
        },
        plate: {
            type: String,
            required: true
        },
        color: {
            type: String,
            required: true
        }
    }
});

module.exports = mongoose.model('captain', captainSchema);