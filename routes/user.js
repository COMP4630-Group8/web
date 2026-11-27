const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const { getTaskDetailed } = require('./league');

const Membership = require('../models/Membership');
const Task = require('../models/Task');
const Submission = require('../models/Submission');
const League = require('../models/League');

router.get('/feed', verifyToken(), async (req, res) => {
    const memberships = await Membership.find({
        user: req.user.id
    });
    let query = {
        league: {
            $in: memberships.map(m => m.league)
        }
    }
    const submissions = await Submission.find(query).populate('task created_by').sort({ date_created: -1 })
    let response = [];
    for (let i = 0; i < submissions.length; i++) {
        const submission_detailed = {
            ...submissions[i].toJSON(),
            task: await getTaskDetailed(submissions[i].task, req.user.id)
        }
        response.push(submission_detailed);
    }
    return res.json({
        error: false,
        message: 'Feed successfully fetched',
        data: response
    });
});

// TODO should only show between range
router.get('/agenda', verifyToken(), async (req, res) => {
    let response = [];
    const memberships = await Membership.find({
        user: req.user.id
    });
    const tasks = await Task.find({
        league: {
            $in: memberships.map(m => m.league)
        }
    });
    for (let i = 0; i < tasks.length; i++) {
        const task_detailed = await getTaskDetailed(tasks[i], req.user.id);
        if (!task_detailed.completed) {
            response.push(task_detailed);
        }
    }
    return res.json({
        error: false,
        message: 'Successfully fetched agenda',
        data: response
    });
});

router.put('/join', verifyToken(), async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({
            error: true,
            message: 'Invite code required to complete request.',
            data: null
        });
    }
    const league = await League.findOne({ invite_code: code });
    if (!league) {
        return res.status(404).json({
            error: true,
            message: 'No group found with the following invite code.',
            data: null
        });
    }
    const membership = {
        host: false,
        user: req.user.id,
        league: league._id
    }
    const existing_membership = await Membership.findOne(membership);
    if (existing_membership) {
        return res.status(409).json({
            error: true,
            message: 'Cannot rejoin group, membership already exists.',
            data: null
        });
    }
    const newMembership = await Membership.create(membership);
    return res.json({
        error: false,
        message: 'Successfully joined group',
        data: newMembership
    });
});

module.exports = router;