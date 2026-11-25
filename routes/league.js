const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage()
});

const utils = require('../utils/index');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuid } = require('uuid');
const { verifyToken } = require('../middleware/auth');

const League = require('../models/League');
const Membership = require('../models/Membership');
const Task = require('../models/Task');
const Submission = require('../models/Submission');

const { default: mongoose } = require('mongoose');

const s3 = new S3Client({
    endpoint: 'https://' + process.env.SPACES_ENDPOINT,
    forcePathStyle: false,
    region: process.env.SPACES_REGION,
    credentials: {
        accessKeyId: process.env.SPACES_KEY,
        secretAccessKey: process.env.SPACES_SECRET,
    },
});

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
            message: 'Submissions successfully fetched',
            data: response
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

router.post('/:id/submit', upload.single('image'), verifyToken(), async (req, res) => {
    const { task_id, summary } = req.body;
    const validMember = await isValidMember(req.params.id, req.user.id);
    const league = await League.findById(req.params.id);
    if (!validMember) {
        return res.status(401).json({
            error: true,
            message: 'Unauthorized',
            data: null
        });
    }
    const task = await Task.findById(task_id);
    if (!task) {
        return res.status(401).json({
            error: true,
            message: 'Not task found with the following ID',
            data: null
        });
    } else if (task.league.toString() != req.params.id) {
        return res.status(409).json({
            error: true,
            message: 'Conflict, task does not align with league provided.',
            data: null
        });
    } else if (task.accepts_image && !req.file) {
        return res.status(400).json({
            error: true,
            message: 'Image file required',
            data: null
        });
    } else if (!utils.isBetweenTimeWindow(league.start_date, league.end_date)) {
        return res.status(401).json({
            error: true,
            message: 'Submission can only be made between the set time window.',
            data: null
        });
    } else {
        const existingSubmission = await Submission.findOne({
            created_by: req.user.id,
            task: task._id,
            league: req.params.id
        });
        if (existingSubmission) {
            return res.status(409).json({
                error: true,
                message: 'Cannot complete request, submission already exists.',
                data: null
            });
        } else {
            let image_url = null;
            if (task.accepts_image) {
                const uploadFolder = `leagues/${req.params.id}/submissions`;
                image_url = await uploadImage(req.file, uploadFolder, {
                    uploaded_by: req.user.id,
                    campaign_id: req.params.id,
                    original_name: req.file.originalname
                });
            }
            if (!task.accepts_image && (!summary || summary == '')) {
                return res.status(400).json({
                    error: true,
                    message: 'Summary is required for submission',
                    data: null
                });
            }
            const newSubmission = new Submission({
                summary,
                image_url: image_url,
                task: task._id,
                league: req.params.id,
                created_by: req.user.id
            });
            await newSubmission.save();
            return res.status(201).json({
                error: false,
                message: 'Submission successfully created',
                data: newSubmission
            });
        }
    }
});

const uploadImage = async (file, uploadFolder, metadata) => {
    // TODO: handle accepted types and crop
    const accepted_mimes = ['image/jpeg', 'image/png'];
    const { mimetype, buffer, size } = file;
    const key = `${uploadFolder}/${uuid()}-${file.originalname}`;
    const image_url = `https://${process.env.SPACES_BUCKET}.${process.env.SPACES_ENDPOINT}/${key}`
    await s3.send(new PutObjectCommand({
        Bucket: process.env.SPACES_BUCKET,
        Key: key,
        Body: buffer,
        ACL: 'public-read',
        ContentType: mimetype,
        Metadata: metadata
    }));
    return image_url;
}

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