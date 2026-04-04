const express = require('express');
const { authJwt } = require('../../helpers/jwt');
const { User } = require('../../models/mongoModels/users');
const { Order } = require('../../models/mongoModels/orders');
const { Product } = require('../../models/mongoModels/products');

const router = express.Router();

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

router.post('/orders/place', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    ensureUserCollections(user);

    const source = req.body.source === 'buy-now' ? 'buy-now' : 'cart';
    const addressId = req.body.addressId;
    const shippingAddress = (user.addresses || []).id(addressId);

    if (!shippingAddress) {
        return res.status(400).json({ message: 'A valid delivery address is required.' });
    }

    let orderItems = [];

    if (source === 'buy-now') {
        const product = await Product.findOne({ productId: req.body.productId, active: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
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
        return res.status(400).json({ message: 'No items available to place the order.' });
    }

    const totals = calculateTotals(orderItems);
    const order = await Order.create({
        userId: user._id,
        items: orderItems,
        shippingAddress: shippingAddress.toObject(),
        totals,
        notes: req.body.notes || ''
    });

    if (source === 'cart') {
        user.cart = [];
        await user.save();
    }

    return res.status(201).json({
        ...order.toJSON(),
        totals: withDisplayTotals(totals)
    });
});

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
