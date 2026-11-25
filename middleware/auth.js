const jwt = require('jsonwebtoken');
const User = require('../models/User');
const utils = require('../utils/index.js');

const verifyToken = () => {

    return async (req, res, next) => {

        const token = req.header('Authorization') || apiKey

        if (!token) {
            return res.status(401).json({
                error: true,
                message: 'Access denied, invalid paramters provided.',
                data: null
            });
        }

        try {
            let decoded;
            try {
                let user;
                decoded = jwt.verify(token, process.env.JWT_SECRET);
                user = await User.findById(decoded.id);

                if (!user) {
                    return res.status(404).json({
                        error: true,
                        message: 'User not found',
                        data: null
                    });
                }

                /* Validate for non-client API requests */
                const expirationDate = new Date(jwt.verify(token, process.env.JWT_SECRET).exp * 1000);
                if (utils.isTokenExpired(expirationDate.toUTCString())) {
                    return res.status(401).json({
                        error: true,
                        message: 'Expired Token',
                        data: null
                    });
                }

                req.user = user;

            } catch (e) {
                return res.status(401).json({
                    error: true,
                    message: e.message,
                    data: null
                });
            }

            next();

        } catch (error) {
            return res.status(401).json({
                error: true,
                message: 'Invalid token',
                data: null
            });
        }

    }
}

module.exports = { verifyToken };