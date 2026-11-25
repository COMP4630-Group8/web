const express = require('express');
const router = express.Router();

const utils = require('../utils/index');
const { verifyToken } = require('../middleware/auth');

const League = require('../models/League');
const Membership = require('../models/Membership');
const Task = require('../models/Task');
const Submission = require('../models/Submission');
const { default: mongoose } = require('mongoose');

/* Endpoint: GET /api/leagues */
router.get('/', verifyToken(), async (req, res) => {
    const memberships = await Membership.find({
        user: req.user.id
    });
    const leagues_query = {
        _id: {
            $in: memberships.map(m => m.league)
        }
    }
    const leagues = await League.find(leagues_query).populate('host');
    let response = [];
    for (let i = 0; i < leagues.length; i++) {
        const league_detailed = await getLeagueDetailed(leagues[i]);
        response.push(league_detailed);
    }
    return res.json({
        error: false,
        message: 'Successfully fetched leagues',
        data: response
    });
});

/* Endpoint: POST /api/leagues/create */
router.post('/create', verifyToken(), async (req, res) => {
    const { title, start_date, end_date, tasks } = req.body;
    // TODO: Validate inputs first including start and stop date
    // TODO: add fallbacks if something in chain fails
    const league = new League({
        title, start_date, end_date,
        host: req.user.id,
        invite_code: utils.generateInviteCode(8) // TODO: add logic to retry
    });
    await league.save();
    const membership = new Membership({
        host: true,
        user: req.user.id,
        league: league._id
    });
    await membership.save();
    await Task.insertMany(tasks.map(task => {
        return {
            league: league._id,
            ...task
        }
    }));
    const response = await getLeagueDetailed(league);
    return res.json({
        error: false,
        message: 'League successfully created',
        data: response
    });
});

router.get('/:id', verifyToken(), async (req, res) => {
    const league = await League.findById(req.params.id);
    if (!league) {
        return res.status(404).json({
            error: true,
            message: 'No league found with the provided ID',
            data: null
        });
    } else {
        const validMember = await isValidMember(league._id, req.user.id);
        if (validMember) {
            const response = await getLeagueDetailed(league);
            return res.json({
                error: false,
                message: 'League successfully fetched',
                data: response
            });
        } else {
            return res.status(401).json({
                error: true,
                message: 'Unauthorized',
                data: null
            });
        }
    }
});

router.get('/:id/submissions', verifyToken(), async (req, res) => {
    const { task } = req.query; // task filter (optional)
    const validMember = await isValidMember(req.params.id, req.user.id);
    if (!validMember) {
        return res.status(401).json({
            error: true,
            message: 'Unauthorized',
            data: null
        });
    } else {
        let query = {
            league: new mongoose.Types.ObjectId(req.params.id)
        }
        if (task) {
            query.task = new mongoose.Types.ObjectId(task)
        }
        const submissions = await Submission.find(query);
        return res.json({
            error: false,
            message: 'Submissions successfully fetched',
            data: submissions
        });
    }
});

router.get('/:id/tasks', verifyToken(), async (req, res) => {
    const validMember = await isValidMember(req.params.id, req.user.id);
    if (!validMember) {
        return res.status(401).json({
            error: true,
            message: 'Unauthorized',
            data: null
        });
    } else {
        let response = [];
        const tasks = await Task.find({
            league: new mongoose.Types.ObjectId(req.params.id)
        });
        for (let i = 0; i < tasks.length; i++) {
            const task_detailed = await getTaskDetailed(tasks[i], req.user.id);
            response.push(task_detailed);
        }
        return res.json({
            error: false,
            message: 'Successfully fetched tasks',
            data: response
        });
    }
});

router.get('/:id/members', verifyToken(), async (req, res) => {
    const validMember = await isValidMember(req.params.id, req.user.id);
    if (!validMember) {
        return res.status(401).json({
            error: true,
            message: 'Unauthorized',
            data: null
        });
    } else {
        let response = [];
        const query = {
            league: new mongoose.Types.ObjectId(req.params.id)
        }
        const memberships = await Membership.find(query).populate('user');
        const tasks = await Task.find({ league: req.params.id });
        for (let i = 0; i < memberships.length; i++) {
            const member = memberships[i];
            const user_stats = await getUserLeagueStats(member._id, req.params.id);
            response.push({
                points: user_stats.total_points,
                tasks_completed: user_stats.completed_tasks,
                user: member.user.toJSON()
            });
        }
        return res.json({
            error: false,
            message: 'Successfully fetched members',
            data: response
        });
    }
});

router.post('/:id/submit', verifyToken(), async (req, res) => {
    // TODO: Check to make sure user in league
    // TODO: Check to make sure user has not submitted already
    // TODO: For image submission ensure image has been passed over
    // TODO: Ensure submission notes (for non image uploads) has characters
    // TODO: Ensure submission is actually done between start-end time of the league
});

const isValidMember = async (leagueID, userID) => {
    const league = await League.findById(leagueID);
    if (!league) {
        throw new Error("No league found with the following ID provided");
    } else {
        const membership = await Membership.findOne({
            user: userID,
            league: league._id
        });
        if (!membership) return false;
    }
    return true;
}

const getLeagueDetailed = async (league) => {
    const league_members = await Membership.find({ league: league._id });
    const league_tasks = await Task.find({ league: league._id });
    const completed_tasks = await Submission.find({
        league: league._id,
        task: { $in: league_tasks.map(t => t._id) }
    });
    return {
        ...league.toJSON(),
        participant_count: league_members.length,
        progress: Math.round(completed_tasks.length / league_tasks.length),
        total_tasks: league_tasks.length,
        tasks_completed: completed_tasks.length
    }
}

const getTaskDetailed = async (task, userID) => {
    const league = await League.findById(task.league);
    const submission = await Submission.findOne({
        created_by: userID,
        task: task._id,
        league: task.league
    });
    return {
        ...task.toJSON(),
        completed: (submission) ? true : false,
        league_id: task.league.toString(),
        league_title: league.title
    }
}

const getUserLeagueStats = async (userID, leagueID) => {
    let total_points = 0;
    const submissions = await Submission.find({
        created_by: userID,
        league: leagueID
    }).populate('task')
    for (let i = 0; i < submissions.length; i++) {
        total_points += submissions[i].task.points;
    }
    return {
        completed_tasks: submissions.length,
        total_points
    }
}

module.exports = router;