const express = require('express');
const { authJwt } = require('../../helpers/jwt');
const { User } = require('../../models/mongoModels/users');
const { Order } = require('../../models/mongoModels/orders');
const { Product } = require('../../models/mongoModels/products');

const router = express.Router();

const SHIPPING_FLAT_RATE = 99;

const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
}).format(amount);

const withDisplayTotals = (totals) => ({
    ...totals,
    subtotalDisplay: formatCurrency(totals.subtotal),
    shippingDisplay: formatCurrency(totals.shipping),
    totalDisplay: formatCurrency(totals.total)
});

const toProductResponse = (product) => ({
    ...product.toJSON(),
    id: product.productId,
    priceDisplay: formatCurrency(product.price)
});

const toProductSnapshot = (product) => ({
    productId: product.productId,
    name: product.name,
    category: product.category,
    price: product.price,
    imageUrl: product.imageUrl,
    imageTone: product.tone,
    shortDescription: product.shortDescription
});

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

router.get('/products', async (req, res) => {
    const products = await Product.find({ active: true }).sort({ createdAt: -1 });
    res.status(200).json(products.map(toProductResponse));
});

router.get('/products/:id', async (req, res) => {
    const product = await Product.findOne({ productId: req.params.id, active: true });
    if (!product) {
        return res.status(404).json({ message: 'Product not found.' });
    }

    return res.status(200).json(toProductResponse(product));
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
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const existingItem = (user.cart || []).find((item) => item.productId === product.productId);
    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.productSnapshot = toProductSnapshot(product);
    } else {
        user.cart.push({
            productId: product.productId,
            quantity,
            productSnapshot: toProductSnapshot(product)
        });
    }

    await user.save();
    return res.status(200).json(formatUserStore(user));
});

router.put('/cart/:productId', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const targetItem = (user.cart || []).find((item) => item.productId === req.params.productId);
    if (!targetItem) {
        return res.status(404).json({ message: 'Cart item not found.' });
    }

    targetItem.quantity = Math.max(1, Number(req.body.quantity || 1));
    await user.save();
    return res.status(200).json(formatUserStore(user));
});

router.delete('/cart/:productId', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    user.cart = (user.cart || []).filter((item) => item.productId !== req.params.productId);
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

    const exists = (user.wishlist || []).some((item) => item.productId === product.productId);
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

    user.wishlist = (user.wishlist || []).filter((item) => item.productId !== req.params.productId);
    await user.save();
    return res.status(200).json(formatUserStore(user));
});

router.post('/orders/place', async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

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
            productSnapshot: toProductSnapshot(product)
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

    return res.status(200).json({
        cart: formatUserStore(user).cart,
        addresses: user.addresses || [],
        totals: withDisplayTotals(calculateTotals(user.cart || []))
    });
});

module.exports = router;
