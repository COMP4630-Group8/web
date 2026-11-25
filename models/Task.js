const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    league: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
    points: { type: Number, required: true },
    description: { type: String, required: true },
    accepts_image: { type: Boolean, required: true }
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

module.exports = mongoose.model('Task', taskSchema);