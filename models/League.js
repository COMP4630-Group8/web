const mongoose = require('mongoose');
const moment = require('moment');

const leagueSchema = new mongoose.Schema({
    date_created: { type: Date, default: () => moment.utc().toDate() },
    title: { type: String, required: true },
    invite_code: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true }
},{
    toObject: { virtuals: true },
    toJSON: {
        virtuals: true,
        transform: function (_doc, ret) {
            delete ret.__v;
            delete ret._id;
            const { id, ...rest } = ret;
            return { id, ...rest }
        }
    }
});

module.exports = mongoose.model('League', leagueSchema);