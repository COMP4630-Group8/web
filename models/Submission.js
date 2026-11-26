const mongoose = require('mongoose');
const moment = require('moment');

const submissionSchema = new mongoose.Schema({
    date_created: { type: Date, default: () => moment.utc().toDate() },
    summary: { type: String, required: false, default: null },
    image_url: { type: String, required: false, default: null },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    league: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
},{
    toObject: { virtuals: true },
    toJSON: {
        virtuals: true,
        transform: function (_doc, ret) {
            delete ret.__v;
            delete ret._id;
            delete ret.league;
            const { id, ...rest } = ret;
            return { id, ...rest }
        }
    }
});

module.exports = mongoose.model('Submission', submissionSchema);