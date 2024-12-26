const { User } = require('../../models/mongoModels/users');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.get(`/`, async (req, res) => {
    const userList = await User.find().select('-passwordHash');

    if (!userList) {
        res.status(500).json({ success: false });
    }
    res.send(userList);
});

router.get('/:id', async (req, res) => {
    const user = await User.findById(req.params.id).select('-passwordHash');

    if (!user) {
        res.status(500).json({ message: 'The user with the given ID was not found.' });
    }
    res.status(200).send(user);
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

router.put('/forgetpassword/:id', async (req, res) => {
    try {
        const userExist = await User.findById(req.params.id);
        if (!userExist) {
            return res.status(400).json({ success: false, message: "User does not exist." });
        }

        const newPassword = req.body.password ? bcrypt.hashSync(req.body.password, 10) : userExist.passwordHash;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { passwordHash: newPassword },
            { new: true }
        );

        if (!user) {
            return res.status(400).send('The user cannot be updated!');
        }

        res.status(200).send(`The user password is updated for ${user.name}!`);
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).send('Internal server error');
    }
});







router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        const secret = process.env.SECRET_KEY;
        if (!user) {
            return res.status(400).send('The user not found');
        }
        if (user && bcrypt.compareSync(req.body.password, user.passwordHash)) {
            const token = jwt.sign(
                {
                    userId: user.id,
                    isAdmin: user.isAdmin
                },
                secret,
                { expiresIn: '1d' }
            );

            res.status(200).send({ user: user.email, token: token });
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
            // Send the JSON response
            res.json(new_user);
        }


    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).send('Internal server error');
    }
});

router.delete('/:id', async (req, res) => {
    try {
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

module.exports = router;
