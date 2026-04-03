const mongoose = require('mongoose');
const { addressSchema, productSnapshotSchema } = require('./users');

const orderItemSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    productSnapshot: { type: productSnapshotSchema, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    items: {
        type: [orderItemSchema],
        default: []
    },
    shippingAddress: {
        type: addressSchema,
        required: true
    },
    totals: {
        subtotal: { type: Number, required: true },
        shipping: { type: Number, required: true, default: 0 },
        total: { type: Number, required: true }
    },
    status: {
        type: String,
        enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'placed'
    },
    notes: {
        type: String,
        default: ''
    },
    placedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

orderSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

orderSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
    }
});

exports.Order = mongoose.model('order', orderSchema);
