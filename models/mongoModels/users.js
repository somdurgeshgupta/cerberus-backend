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

const addressSchema = new mongoose.Schema({
    label: { type: String, required: true },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, required: false, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
    isDefault: { type: Boolean, default: false }
}, { _id: true, timestamps: true });

const productSnapshotSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: false, default: '' },
    imageTone: { type: String, required: false, default: 'sun' },
    shortDescription: { type: String, required: false, default: '' }
}, { _id: false });

const cartItemSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1, min: 1 },
    productSnapshot: { type: productSnapshotSchema, required: true },
    addedAt: { type: Date, default: Date.now }
}, { _id: true });

const wishlistItemSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    productSnapshot: { type: productSnapshotSchema, required: true },
    addedAt: { type: Date, default: Date.now }
}, { _id: true });

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
    },
    addresses: {
        type: [addressSchema],
        default: []
    },
    cart: {
        type: [cartItemSchema],
        default: []
    },
    wishlist: {
        type: [wishlistItemSchema],
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
exports.addressSchema = addressSchema;
exports.productSnapshotSchema = productSnapshotSchema;
