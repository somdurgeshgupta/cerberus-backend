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
    source: {
        type: String,
        enum: ['cart', 'buy-now'],
        default: 'cart'
    },
    status: {
        type: String,
        enum: ['pending-payment', 'placed', 'processing', 'shipped', 'delivered', 'cancelled', 'payment-failed'],
        default: 'pending-payment'
    },
    payment: {
        method: {
            type: String,
            enum: ['cod', 'razorpay'],
            default: 'razorpay'
        },
        provider: {
            type: String,
            default: 'razorpay'
        },
        status: {
            type: String,
            enum: ['created', 'authorized', 'paid', 'failed'],
            default: 'created'
        },
        currency: {
            type: String,
            default: 'INR'
        },
        amount: {
            type: Number,
            default: 0
        },
        razorpayOrderId: {
            type: String,
            default: ''
        },
        razorpayPaymentId: {
            type: String,
            default: ''
        },
        razorpaySignature: {
            type: String,
            default: ''
        },
        paidAt: {
            type: Date,
            default: null
        }
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
