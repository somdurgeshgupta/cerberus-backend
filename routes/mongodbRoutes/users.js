const { User } = require('../../models/mongoModels/users');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const {
    decodeToken,
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken,
    getAccessTokenExpiry,
    setRefreshTokenCookie,
    clearRefreshTokenCookie,
    getRefreshTokenFromRequest
} = require('../../helpers/jwt');

const buildAuthResponse = async (user, res) => {
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    user.refreshTokens = [refreshToken];
    await user.save();
    setRefreshTokenCookie(res, refreshToken);

    return {
        user: user.email,
        accessToken,
        accessTokenExpiresIn: getAccessTokenExpiry()
    };
};

router.get('/', async (req, res) => {
    try {
        const userList = await User.find().select('-passwordHash');

        if (!userList) {
            return res.status(500).json({ success: false, message: 'No users found' });
        }

        res.status(200).send(userList);
    } catch (err) {
        console.error('Error fetching users:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/me/current', async (req, res) => {
    try {
        const user = await User.findById(req.auth?.userId).select('-passwordHash -refreshTokens');

        if (!user) {
            return res.status(404).json({ message: 'The user with the given ID was not found.' });
        }

        res.status(200).send(user);
    } catch (err) {
        console.error('Error fetching current user:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-passwordHash');

        if (!user) {
            return res.status(404).json({ message: 'The user with the given ID was not found.' });
        }

        res.status(200).send(user);
    } catch (err) {
        console.error(`Error fetching user with ID ${req.params.id}:`, err.message);
        res.status(500).json({ error: err.message });
    }
});




router.put('/:id', async (req, res) => {
    try {
        const userExist = await User.findById(req.params.id);
        if (!userExist) {
            return res.status(400).json({ success: false, message: "User does not exist." });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                phone: req.body.phone,
                isAdmin: req.body.isAdmin,
                street: req.body.street,
                apartment: req.body.apartment,
                zip: req.body.zip,
                city: req.body.city,
                country: req.body.country
            },
            { new: true }
        ).select('-passwordHash');

        if (!user) {
            return res.status(400).send('The user cannot be updated!');
        }

        res.send(user);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send('Internal server error');
    }
});


router.post('/forgetpassword', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        // Check if user exists
        const userExist = await User.findOne({ email });
        if (!userExist) {
            return res.status(404).json({ success: false, message: 'User does not exist.' });
        }

        // Hash the new password
        const hashedPassword = bcrypt.hashSync(password, 10);

        // Update the user's password
        const updatedUser = await User.findByIdAndUpdate(
            userExist._id, // Use the valid ObjectId from the user document
            { passwordHash: hashedPassword },
            { new: true } // Return the updated document
        );

        if (!updatedUser) {
            return res.status(500).json({ success: false, message: 'Failed to update the password.' });
        }

        res.status(200).json({ 
            success: true, 
            message: `Password has been successfully updated for ${updatedUser.name}!` 
        });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});



router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(400).send('The user not found');
        }
        if (user && bcrypt.compareSync(req.body.password, user.passwordHash)) {
            const authResponse = await buildAuthResponse(user, res);
            res.status(200).send(authResponse);
        } else {
            res.status(400).send('Password is wrong!');
        }
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).send('Internal server error');
    }
});


router.post('/register', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) {
            return res.status(400).send('The user is already registered, please login');
        }

        let new_user = new User({
            name: req.body.name,
            email: req.body.email,
            passwordHash: bcrypt.hashSync(req.body.password, 10),
        });

        new_user = await new_user.save();



        if (!new_user) {
            return res.status(400).send('The user cannot be created!');
        } else {
            const authResponse = await buildAuthResponse(new_user, res);
            res.status(200).send({ ...authResponse, user: new_user });
        }


    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).send('Internal server error');
    }
});

router.post('/refresh-token', async (req, res) => {
    try {
        const refreshToken = getRefreshTokenFromRequest(req);

        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token is required.' });
        }

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded?.userId) {
            return res.status(401).json({ message: 'Invalid refresh token.' });
        }

        const user = await User.findById(decoded.userId);
        if (!user || !user.refreshTokens?.includes(refreshToken)) {
            return res.status(401).json({ message: 'Refresh token is not recognized.' });
        }

        const nextAccessToken = createAccessToken(user);
        const nextRefreshToken = createRefreshToken(user);

        user.refreshTokens = [nextRefreshToken];
        await user.save();
        setRefreshTokenCookie(res, nextRefreshToken);

        return res.status(200).json({
            accessToken: nextAccessToken,
            accessTokenExpiresIn: getAccessTokenExpiry()
        });
    } catch (error) {
        clearRefreshTokenCookie(res);
        return res.status(401).json({ message: 'Refresh token expired or invalid.', error: error.message });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const refreshToken = getRefreshTokenFromRequest(req);

        if (!refreshToken) {
            clearRefreshTokenCookie(res);
            return res.status(200).json({ message: 'Logged out.' });
        }

        try {
            const decoded = verifyRefreshToken(refreshToken);
            if (decoded?.userId) {
                await User.findByIdAndUpdate(decoded.userId, {
                    $set: { refreshTokens: [] }
                });
            }
        } catch (error) {
            // Treat invalid/expired refresh token as already logged out.
        }

        clearRefreshTokenCookie(res);
        return res.status(200).json({ message: 'Logged out.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error logging out.', error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const userIdFromToken = req.auth?.userId;

        // Check if the id in the URL matches the userId from the token
        if (req.params.id !== userIdFromToken) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this user account!'
            });
        }

        // Proceed with deleting the user if authorized
        const user = await User.findOneAndDelete({ _id: req.params.id });
        if (user) {
            return res.status(200).json({ success: true, message: 'The user has been deleted!' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found!' });
        }
    } catch (err) {
        console.error("Error deleting user:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});


router.get(`/get/count`, async (req, res) => {
    try {
        const userCount = await User.estimatedDocumentCount();

        if (!userCount) {
            return res.status(500).json({ success: false });
        }

        res.send({
            userCount: userCount
        });
    } catch (error) {
        console.error("Error fetching user count:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

router.post(`/getuseridfromtoken`, async (req, res) => {
    try {
        res.send({ userId: req.auth?.userId });
    } catch (error) {
        console.error("Error fetching user ID:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});


module.exports = router;
