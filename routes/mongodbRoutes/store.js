const express = require('express');
const crypto = require('crypto');
const { authJwt } = require('../../helpers/jwt');
const { User } = require('../../models/mongoModels/users');
const { Order } = require('../../models/mongoModels/orders');
const { Product } = require('../../models/mongoModels/products');

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const SHIPPING_FLAT_RATE = 99;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 20;

const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
}).format(amount);

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const getBrandName = (brand) => {
    if (!brand) {
        return '';
    }

    if (typeof brand === 'string') {
        return brand;
    }

    return brand.name || brand.label || brand.title || '';
};

const getProductCategory = (product) => {
    if (typeof product?.category === 'string' && product.category.trim()) {
        return product.category.trim();
    }

    if (Array.isArray(product?.categoryHierarchy) && product.categoryHierarchy.length) {
        const lastEntry = product.categoryHierarchy[product.categoryHierarchy.length - 1];
        if (typeof lastEntry === 'string' && lastEntry.trim()) {
            return lastEntry.trim();
        }

        if (lastEntry && typeof lastEntry === 'object') {
            const label = lastEntry.name || lastEntry.label || lastEntry.title || lastEntry.slug;
            if (typeof label === 'string' && label.trim()) {
                return label.trim();
            }
        }
    }

    return 'Uncategorized';
};

const getDiscountedPrice = (amount, discount) => {
    if (!discount || typeof amount !== 'number') {
        return amount;
    }

    if (typeof discount === 'number') {
        return Math.max(0, amount - discount);
    }

    if (typeof discount === 'string') {
        const parsed = Number(discount);
        return Number.isFinite(parsed) ? Math.max(0, amount - parsed) : amount;
    }

    const kind = normalizeText(discount.type || discount.kind || discount.discountType);
    const value = Number(discount.value ?? discount.amount ?? discount.percent ?? 0);

    if (!Number.isFinite(value) || value <= 0) {
        return amount;
    }

    if (kind.includes('percent')) {
        return Math.max(0, Math.round(amount - ((amount * value) / 100)));
    }

    return Math.max(0, amount - value);
};

const buildDiscountLabel = (discount) => {
    if (!discount) {
        return '';
    }

    if (typeof discount === 'number') {
        return `${formatCurrency(discount)} off`;
    }

    const kind = normalizeText(discount.type || discount.kind || discount.discountType);
    const value = Number(discount.value ?? discount.amount ?? discount.percent ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
        return '';
    }

    if (kind.includes('percent')) {
        return `${value}% off`;
    }

    return `${formatCurrency(value)} off`;
};

const getVariantId = (variant) => variant?.variantId || variant?.id || variant?.sku || '';

const normalizeVariant = (variant, fallbackTone, fallbackImageUrl, basePrice, discount) => {
    const effectiveBasePrice = Number(variant?.price ?? basePrice ?? 0);
    const finalPrice = getDiscountedPrice(effectiveBasePrice, discount);
    return {
        variantId: getVariantId(variant),
        sku: variant?.sku || '',
        name: variant?.name || '',
        design: variant?.design || variant?.style || variant?.pattern || '',
        color: variant?.color || variant?.colour || variant?.colorName || '',
        size: variant?.size || '',
        inventoryCount: Number(variant?.inventoryCount ?? 0),
        imageUrl: variant?.imageUrl || fallbackImageUrl || '',
        tone: variant?.tone || fallbackTone || 'sun',
        attributes: variant?.attributes || {},
        price: finalPrice,
        basePrice: effectiveBasePrice,
        priceDisplay: formatCurrency(finalPrice),
        basePriceDisplay: formatCurrency(effectiveBasePrice)
    };
};

const getVariantOptions = (variants) => {
    const uniqueValues = (field) => [...new Set(variants.map((variant) => variant[field]).filter(Boolean))];
    return {
        designs: uniqueValues('design'),
        colors: uniqueValues('color'),
        sizes: uniqueValues('size')
    };
};

const resolveSelectedVariant = (product, variantId) => {
    const variants = (product.variants || []).map((variant) => normalizeVariant(variant, product.tone, product.imageUrl, product.price, product.discount));
    if (!variants.length) {
        return null;
    }

    if (variantId) {
        const selected = variants.find((variant) => normalizeText(variant.variantId) === normalizeText(variantId));
        if (selected) {
            return selected;
        }
    }

    return variants.find((variant) => variant.inventoryCount > 0) || variants[0];
};

const buildReviewsPayload = (product) => {
    const reviews = [...(product.reviews || [])]
        .map((review, index) => ({
            reviewId: review.reviewId || `review-${index + 1}`,
            title: review.title || '',
            comment: review.comment || review.body || '',
            rating: Number(review.rating ?? 0),
            userName: review.userName || review.author || review.reviewer || 'Verified buyer',
            verified: !!review.verified,
            createdAt: review.createdAt || review.date || null
        }))
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());

    return {
        count: reviews.length,
        items: reviews
    };
};

const withDisplayTotals = (totals) => ({
    ...totals,
    subtotalDisplay: formatCurrency(totals.subtotal),
    shippingDisplay: formatCurrency(totals.shipping),
    totalDisplay: formatCurrency(totals.total)
});

const toProductResponse = (product, options = {}) => {
    const selectedVariant = resolveSelectedVariant(product, options.variantId);
    const variants = (product.variants || []).map((variant) => normalizeVariant(variant, product.tone, product.imageUrl, product.price, product.discount));
    const productBasePrice = Number(selectedVariant?.basePrice ?? product.price ?? 0);
    const productFinalPrice = Number(selectedVariant?.price ?? getDiscountedPrice(productBasePrice, product.discount));
    const reviews = buildReviewsPayload(product);

    const response = {
        ...product.toJSON(),
        id: product.productId,
        category: getProductCategory(product),
        price: productFinalPrice,
        basePrice: productBasePrice,
        priceDisplay: formatCurrency(productFinalPrice),
        basePriceDisplay: formatCurrency(productBasePrice),
        originalPrice: productBasePrice,
        originalPriceDisplay: formatCurrency(productBasePrice),
        hasDiscount: productFinalPrice < productBasePrice,
        discountLabel: buildDiscountLabel(product.discount),
        brandName: getBrandName(product.brand),
        categoryHierarchy: product.categoryHierarchy || [],
        reviews,
        reviewCount: reviews.count,
        rating: Number(product.rating ?? 0),
        variants,
        variantOptions: getVariantOptions(variants),
        selectedVariant
    };

    if (options.includeReviews === false) {
        delete response.reviews;
    }

    return response;
};

const toProductSnapshot = (product, variantId) => {
    const selectedVariant = resolveSelectedVariant(product, variantId);
    const price = Number(selectedVariant?.price ?? getDiscountedPrice(product.price, product.discount));

    return {
        productId: product.productId,
        name: product.name,
        category: getProductCategory(product),
        price,
        basePrice: Number(selectedVariant?.basePrice ?? product.price ?? 0),
        imageUrl: selectedVariant?.imageUrl || product.imageUrl,
        imageTone: selectedVariant?.tone || product.tone,
        shortDescription: product.shortDescription,
        brandName: getBrandName(product.brand),
        selectedVariant: selectedVariant ? {
            variantId: selectedVariant.variantId,
            sku: selectedVariant.sku,
            name: selectedVariant.name,
            design: selectedVariant.design,
            color: selectedVariant.color,
            size: selectedVariant.size
        } : null
    };
};

const formatUserStore = (user) => ({
    addresses: user.addresses || [],
    cart: (user.cart || []).map((item) => ({
        id: item._id,
        productId: item.productId,
        quantity: item.quantity,
        product: {
            ...item.productSnapshot,
            priceDisplay: formatCurrency(item.productSnapshot.price)
        }
    })),
    wishlist: (user.wishlist || []).map((item) => ({
        id: item._id,
        productId: item.productId,
        product: {
            ...item.productSnapshot,
            priceDisplay: formatCurrency(item.productSnapshot.price)
        }
    }))
});

const calculateTotals = (items) => {
    const subtotal = items.reduce((sum, item) => sum + (item.productSnapshot.price * item.quantity), 0);
    const shipping = items.length ? SHIPPING_FLAT_RATE : 0;
    return {
        subtotal,
        shipping,
        total: subtotal + shipping
    };
};

const ensureUserCollections = (user) => {
    user.addresses = Array.isArray(user.addresses) ? user.addresses : [];
    user.cart = Array.isArray(user.cart) ? user.cart : [];
    user.wishlist = Array.isArray(user.wishlist) ? user.wishlist : [];
    return user;
};

const getRazorpayCredentials = () => ({
    keyId: String(process.env.RAZORPAY_KEY_ID || '').trim(),
    keySecret: String(process.env.RAZORPAY_KEY_SECRET || '').trim()
});

const isRazorpayConfigured = () => {
    const { keyId, keySecret } = getRazorpayCredentials();
    return !!keyId && !!keySecret;
};

const createRazorpayOrder = async ({ amount, receipt, notes = {} }) => {
    const { keyId, keySecret } = getRazorpayCredentials();

    const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount,
            currency: 'INR',
            receipt,
            payment_capture: 1,
            notes
        })
    });

    const payload = await response.json();

    if (!response.ok) {
        const reason = payload?.error?.description || payload?.error?.message || 'Unable to create Razorpay order.';
        const error = new Error(reason);
        error.statusCode = response.status;
        throw error;
    }

    return payload;
};

const buildOrderDraft = async (req) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
    }

    ensureUserCollections(user);

    const source = req.body.source === 'buy-now' ? 'buy-now' : 'cart';
    const addressId = req.body.addressId;
    const shippingAddress = (user.addresses || []).id(addressId);

    if (!shippingAddress) {
        const error = new Error('A valid delivery address is required.');
        error.statusCode = 400;
        throw error;
    }

    let orderItems = [];

    if (source === 'buy-now') {
        const product = await Product.findOne({ productId: req.body.productId, active: true });
        if (!product) {
            const error = new Error('Product not found.');
            error.statusCode = 404;
            throw error;
        }

        orderItems = [{
            productId: product.productId,
            quantity: Math.max(1, Number(req.body.quantity || 1)),
            productSnapshot: toProductSnapshot(product, req.body.variantId)
        }];
    } else {
        orderItems = (user.cart || []).map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            productSnapshot: item.productSnapshot
        }));
    }

    if (!orderItems.length) {
        const error = new Error('No items available to place the order.');
        error.statusCode = 400;
        throw error;
    }

    return {
        user,
        source,
        shippingAddress,
        orderItems,
        totals: calculateTotals(orderItems),
        notes: String(req.body.notes || '').trim()
    };
};

router.get('/products', async (req, res) => {
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit || DEFAULT_PAGE_SIZE)));
    const skip = Math.max(0, Number(req.query.skip || 0));
    const searchQuery = normalizeText(req.query.q);
    const excludeId = normalizeText(req.query.excludeId);

    const filters = { active: true };

    if (searchQuery) {
        filters.$or = [
            { name: { $regex: searchQuery, $options: 'i' } },
            { category: { $regex: searchQuery, $options: 'i' } },
            { shortDescription: { $regex: searchQuery, $options: 'i' } },
            { 'brand.name': { $regex: searchQuery, $options: 'i' } }
        ];
    }

    if (excludeId) {
        filters.productId = { $ne: excludeId };
    }

    const [products, total] = await Promise.all([
        Product.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Product.countDocuments(filters)
    ]);

    res.status(200).json({
        items: products.map((product) => toProductResponse(product, { includeReviews: false })),
        pagination: {
            limit,
            skip,
            total,
            hasMore: skip + products.length < total
        }
    });
});

router.get('/products/:id', async (req, res) => {
    const product = await Product.findOne({ productId: req.params.id, active: true });
    if (!product) {
        return res.status(404).json({ message: 'Product not found.' });
    }

    return res.status(200).json(toProductResponse(product, { variantId: req.query.variantId }));
});

router.use(authJwt());

router.get('/me/store', async (req, res) => {
    const user = await User.findById(req.auth?.userId).select('addresses cart wishlist');
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json(formatUserStore(user));
});

router.get('/orders', async (req, res) => {
    const orders = await Order.find({ userId: req.auth?.userId }).sort({ placedAt: -1 });
    return res.status(200).json(orders.map((order) => ({
        ...order.toJSON(),
        totals: withDisplayTotals(order.totals)
    })));
});

router.get('/orders/:orderId', async (req, res) => {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.auth?.userId });
    if (!order) {
        return res.status(404).json({ message: 'Order not found.' });
    }

    return res.status(200).json({
        ...order.toJSON(),
        totals: withDisplayTotals(order.totals)
    });
});

router.post('/addresses', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    const nextAddress = {
        label: req.body.label,
        fullName: req.body.fullName,
        phoneNumber: req.body.phoneNumber,
        line1: req.body.line1,
        line2: req.body.line2 || '',
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        country: req.body.country || 'India',
        isDefault: !!req.body.isDefault
    };

    if (nextAddress.isDefault) {
        user.addresses = (user.addresses || []).map((address) => ({
            ...address.toObject(),
            isDefault: false
        }));
    }

    user.addresses.push(nextAddress);
    await user.save();

    return res.status(201).json(user.addresses);
});

router.put('/addresses/:addressId', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    const targetAddress = user.addresses.id(req.params.addressId);
    if (!targetAddress) {
        return res.status(404).json({ message: 'Address not found.' });
    }

    if (req.body.isDefault) {
        user.addresses.forEach((address) => {
            address.isDefault = false;
        });
    }

    Object.assign(targetAddress, {
        label: req.body.label ?? targetAddress.label,
        fullName: req.body.fullName ?? targetAddress.fullName,
        phoneNumber: req.body.phoneNumber ?? targetAddress.phoneNumber,
        line1: req.body.line1 ?? targetAddress.line1,
        line2: req.body.line2 ?? targetAddress.line2,
        city: req.body.city ?? targetAddress.city,
        state: req.body.state ?? targetAddress.state,
        postalCode: req.body.postalCode ?? targetAddress.postalCode,
        country: req.body.country ?? targetAddress.country,
        isDefault: req.body.isDefault ?? targetAddress.isDefault
    });

    await user.save();
    return res.status(200).json(user.addresses);
});

router.delete('/addresses/:addressId', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    user.addresses = (user.addresses || []).filter((address) => address.id !== req.params.addressId);
    await user.save();
    return res.status(200).json(user.addresses);
});

router.post('/cart', async (req, res) => {
    const product = await Product.findOne({ productId: req.body.productId, active: true });
    if (!product) {
        return res.status(404).json({ message: 'Product not found.' });
    }

    const quantity = Math.max(1, Number(req.body.quantity || 1));
    const selectedVariantId = req.body.variantId || '';
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    const existingItem = user.cart.find((item) =>
        item.productId === product.productId &&
        normalizeText(item.productSnapshot?.selectedVariant?.variantId) === normalizeText(selectedVariantId)
    );
    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.productSnapshot = toProductSnapshot(product, selectedVariantId);
    } else {
        user.cart.push({
            productId: product.productId,
            quantity,
            productSnapshot: toProductSnapshot(product, selectedVariantId)
        });
    }

    await user.save();
    return res.status(200).json(formatUserStore(user));
});

router.put('/cart/:itemId', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    const targetItem = user.cart.find((item) => String(item._id) === req.params.itemId || item.productId === req.params.itemId);
    if (!targetItem) {
        return res.status(404).json({ message: 'Cart item not found.' });
    }

    targetItem.quantity = Math.max(1, Number(req.body.quantity || 1));
    await user.save();
    return res.status(200).json(formatUserStore(user));
});

router.delete('/cart/:itemId', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    user.cart = user.cart.filter((item) => String(item._id) !== req.params.itemId && item.productId !== req.params.itemId);
    await user.save();
    return res.status(200).json(formatUserStore(user));
});

router.post('/wishlist', async (req, res) => {
    const product = await Product.findOne({ productId: req.body.productId, active: true });
    if (!product) {
        return res.status(404).json({ message: 'Product not found.' });
    }

    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    const exists = user.wishlist.some((item) => item.productId === product.productId);
    if (!exists) {
        user.wishlist.push({
            productId: product.productId,
            productSnapshot: toProductSnapshot(product)
        });
        await user.save();
    }

    return res.status(200).json(formatUserStore(user));
});

router.delete('/wishlist/:productId', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    user.wishlist = user.wishlist.filter((item) => item.productId !== req.params.productId);
    await user.save();
    return res.status(200).json(formatUserStore(user));
});

router.post('/orders/place', asyncHandler(async (req, res) => {
    const { user, source, shippingAddress, orderItems, totals, notes } = await buildOrderDraft(req);
    const order = await Order.create({
        userId: user._id,
        source,
        items: orderItems,
        shippingAddress: shippingAddress.toObject(),
        totals,
        status: 'placed',
        payment: {
            method: 'cod',
            provider: 'manual',
            status: 'paid',
            currency: 'INR',
            amount: totals.total,
            paidAt: new Date()
        },
        notes
    });

    if (source === 'cart') {
        user.cart = [];
        await user.save();
    }

    return res.status(201).json({
        ...order.toJSON(),
        totals: withDisplayTotals(totals)
    });
}));

router.post('/payments/razorpay/order', asyncHandler(async (req, res) => {
    if (!isRazorpayConfigured()) {
        return res.status(500).json({ message: 'Razorpay sandbox credentials are not configured on the server.' });
    }

    const { user, source, shippingAddress, orderItems, totals, notes } = await buildOrderDraft(req);
    const pendingOrder = await Order.create({
        userId: user._id,
        source,
        items: orderItems,
        shippingAddress: shippingAddress.toObject(),
        totals,
        status: 'pending-payment',
        payment: {
            method: 'razorpay',
            provider: 'razorpay',
            status: 'created',
            currency: 'INR',
            amount: totals.total
        },
        notes
    });

    try {
        const razorpayOrder = await createRazorpayOrder({
            amount: Math.round(totals.total * 100),
            receipt: pendingOrder.id,
            notes: {
                localOrderId: pendingOrder.id,
                source
            }
        });

        pendingOrder.payment.razorpayOrderId = razorpayOrder.id;
        await pendingOrder.save();

        return res.status(201).json({
            keyId: getRazorpayCredentials().keyId,
            orderId: pendingOrder.id,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            customer: {
                name: user.name || '',
                email: user.email || '',
                contact: shippingAddress.phoneNumber || ''
            }
        });
    } catch (error) {
        pendingOrder.status = 'payment-failed';
        pendingOrder.payment.status = 'failed';
        await pendingOrder.save();
        throw error;
    }
}));

router.post('/payments/razorpay/verify', asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    const { keySecret } = getRazorpayCredentials();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
        return res.status(400).json({ message: 'Missing Razorpay payment verification fields.' });
    }

    const order = await Order.findOne({ _id: orderId, userId: req.auth?.userId });
    if (!order) {
        return res.status(404).json({ message: 'Pending order not found.' });
    }

    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (expectedSignature !== razorpay_signature || order.payment?.razorpayOrderId !== razorpay_order_id) {
        order.status = 'payment-failed';
        order.payment.status = 'failed';
        await order.save();
        return res.status(400).json({ message: 'Razorpay payment verification failed.' });
    }

    order.status = 'placed';
    order.placedAt = new Date();
    order.payment.status = 'paid';
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.paidAt = new Date();
    await order.save();

    if (order.source === 'cart') {
        const user = await User.findById(req.auth?.userId);
        if (user) {
            ensureUserCollections(user);
            user.cart = [];
            await user.save();
        }
    }

    return res.status(200).json({
        ...order.toJSON(),
        totals: withDisplayTotals(order.totals)
    });
}));

router.post('/payments/razorpay/fail', asyncHandler(async (req, res) => {
    const { orderId, reason } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: 'Order id is required to update payment status.' });
    }

    const order = await Order.findOne({ _id: orderId, userId: req.auth?.userId });
    if (!order) {
        return res.status(404).json({ message: 'Pending order not found.' });
    }

    if (order.status !== 'placed') {
        order.status = 'payment-failed';
        order.payment.status = 'failed';
        order.notes = [order.notes, reason ? `Payment failed: ${String(reason).trim()}` : 'Payment failed.']
            .filter(Boolean)
            .join('\n');
        await order.save();
    }

    return res.status(200).json({
        ...order.toJSON(),
        totals: withDisplayTotals(order.totals)
    });
}));

router.get('/checkout/summary', async (req, res) => {
    const user = await User.findById(req.auth?.userId).select('cart addresses');
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    return res.status(200).json({
        cart: formatUserStore(user).cart,
        addresses: user.addresses || [],
        totals: withDisplayTotals(calculateTotals(user.cart || []))
    });
});

module.exports = router;
