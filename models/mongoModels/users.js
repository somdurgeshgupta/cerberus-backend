const mongoose = require('mongoose');

const refreshSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUsedAt: {
        type: Date,
        default: Date.now
    },
    userAgent: {
        type: String,
        required: false
    },
    ipAddress: {
        type: String,
        required: false
    }
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    passwordHash: {
        type: String,
        required: false,
    },
    picture: {
        type: String,
        required: false
    },
    profileImage:{
        type: String,
        required: false
    },
    refreshTokens: {
        type: [refreshSessionSchema],
        default: []
    }
});

userSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

userSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        delete ret._id; // Remove the `_id` field
        delete ret.__v; // Optionally remove the version field if it's not needed
    },
});

exports.User = mongoose.model('user', userSchema);
exports.userSchema = userSchema;
