const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    tag: {
        type: String,
        required: true,
        trim: true
    },
    imageUrl: {
        type: String,
        required: true,
        trim: true
    },
    tone: {
        type: String,
        enum: ['sun', 'sky', 'clay', 'forest'],
        default: 'sun'
    },
    shortDescription: {
        type: String,
        required: true
    },
    longDescription: {
        type: String,
        required: true
    },
    material: {
        type: String,
        required: true
    },
    inventoryCount: {
        type: Number,
        default: 10,
        min: 0
    },
    rating: {
        type: Number,
        default: 4.6,
        min: 0,
        max: 5
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

productSchema.virtual('id').get(function () {
    return this.productId;
});

productSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
    }
});

exports.Product = mongoose.model('product', productSchema);
