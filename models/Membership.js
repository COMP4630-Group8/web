const mongoose = require('mongoose');
const moment = require('moment');

const membershipSchema = new mongoose.Schema({
    date_created: { type: Date, default: () => moment.utc().toDate() },
    host: { type: Boolean, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    league: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true }
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

module.exports = mongoose.model('Membership', membershipSchema);