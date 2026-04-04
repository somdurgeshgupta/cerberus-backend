const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    reviewId: {
        type: String,
        trim: true
    },
    title: {
        type: String,
        trim: true,
        default: ''
    },
    comment: {
        type: String,
        trim: true,
        default: ''
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    userName: {
        type: String,
        trim: true,
        default: 'Verified buyer'
    },
    verified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const variantSchema = new mongoose.Schema({
    variantId: {
        type: String,
        trim: true
    },
    sku: {
        type: String,
        trim: true,
        default: ''
    },
    name: {
        type: String,
        trim: true,
        default: ''
    },
    design: {
        type: String,
        trim: true,
        default: ''
    },
    color: {
        type: String,
        trim: true,
        default: ''
    },
    size: {
        type: String,
        trim: true,
        default: ''
    },
    price: {
        type: Number,
        min: 0
    },
    inventoryCount: {
        type: Number,
        min: 0,
        default: 0
    },
    imageUrl: {
        type: String,
        trim: true,
        default: ''
    },
    attributes: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

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
    brand: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    categoryHierarchy: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    discount: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    variants: {
        type: [variantSchema],
        default: []
    },
    reviews: {
        type: [reviewSchema],
        default: []
    },
    attributes: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
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
