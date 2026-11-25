const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();

const User = require('../models/User');

/* Endpoint: /api/auth/register */
router.post('/register', async (req, res) => {
    const { display_name, full_name } = req.body;
    const password = "apple pie dinner";
    try {
        const existingUser = await User.findOne({ display_name });
        if (existingUser) {
            return res.status(400).json({
                error: true,
                message: 'Display name taken.',
                date: null
            });
        }
        const user = new User({
            display_name, full_name,
            points_earned: 0,
            auth: {
                password
            }
        });
        const jwt_token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        const expirationDate = new Date(jwt.verify(jwt_token, process.env.JWT_SECRET).exp * 1000);
        user.auth.token = jwt_token;
        await user.save();
        return res.json({
            error: false,
            message: 'Registration Successful',
            data: {
                key: password,
                jwt_token,
                expires: expirationDate.toISOString()
            }
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            error: true,
            message: 'Error Registering User',
            data: null
        });
    }
});

/* Endpoint: /api/auth/signin */
router.post('/signin', async (req, res) => {

    const { display_name, key } = req.body;

    try {
        const user = await User.findOne({ display_name });
        if (!user) {
            return res.status(401).json({
                error: true,
                message: 'Invalid Display Name or Password',
                data: null
            });
        }

        const passwordValidation = await bcrypt.compare(key, user.auth.password);
        if (!passwordValidation) {
            return res.status(401).json({
                error: true,
                message: 'Invalid Display Name or Password',
                data: null
            });
        }

        const jwt_token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        const expirationDate = new Date(jwt.verify(jwt_token, process.env.JWT_SECRET).exp * 1000);

        user.auth.token = jwt_token;
        await user.save();

        let res_body = {
            error: false,
            message: 'Sign in successful!',
            data: {
                jwt_token,
                expires: expirationDate.toISOString()
            }
        }
        
        return res.json(res_body);

    } catch(e) {
        return res.status(500).json({
            error: true,
            message: 'Error signing in user.',
            data: null
        });
    }
});

module.exports = router;