const moment = require('moment');
const crypto = require('crypto');

const isTokenExpired = exp_date => {
    const now = moment.utc();
    const expiryDate = moment.utc(exp_date);
    return expiryDate.isBefore(now);
}

const generateInviteCode = (length = 8) => {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
    }
    return code;
}

module.exports = {
    isTokenExpired,
    generateInviteCode
}