const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.js');
const leagueRoutes = require('./league.js');
const userRoutes = require('./user.js');

router.get('/api', (_req, res) => {
    return res.status(200).json({
        error: false,
        message: `API ${require('../package.json').version}`,
        data: null
    });
});

/* Main Routes */
router.use('/api/auth', authRoutes);
router.use('/api/leagues', leagueRoutes.router);
router.use('/api/user', userRoutes);

module.exports = router;