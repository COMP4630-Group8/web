const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const { getTaskDetailed } = require('./league');

const League = require('../models/League');
const Membership = require('../models/Membership');
const Task = require('../models/Task');
const Submission = require('../models/Submission');


router.get('/feed', verifyToken(), async (req, res) => {
    const memberships = await Membership.find({
        user: req.user.id
    });
    let query = {
        league: {
            $in: memberships.map(m => m.league)
        }
    }
    const submissions = await Submission.find(query).populate('task created_by');
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

module.exports = router;