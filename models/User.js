const mongoose = require('mongoose');
const moment = require('moment');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    date_created: { type: Date, default: () => moment.utc().toDate() },
    display_name: { type: String, required: true },
    full_name: { type: String, required: true },
    points_earned: { type: Number, required: true, default: 0 },
    auth: {
        required: true,
        type: new mongoose.Schema({
            password: { type: String, required: false, default: null },
            token: { type: String, required: false, default: null }
        }, {
            _id: false
        })
    }
},{
    toObject: { virtuals: true },
    toJSON: {
        virtuals: true,
        transform: function (_doc, ret) {
            delete ret.__v;
            delete ret._id;
            delete ret.auth;
            const { id, ...rest } = ret;
            return { id, ...rest }
        }
    }
});

userSchema.pre('save', async function () {
    if (!this.auth || !this.auth.isModified('password')) return;
    if (!this.auth.password) return;
    const salt = await bcrypt.genSalt(10);
    this.auth.password = await bcrypt.hash(this.auth.password, salt);
});

module.exports = mongoose.model('User', userSchema);