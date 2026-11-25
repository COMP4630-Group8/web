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

function isBetweenTimeWindow(startDateIso, endDateIso) {
  const now = moment();
  const start = moment(startDateIso);
  const end = moment(endDateIso);
  if (!start.isValid() || !end.isValid()) {
    throw new Error("Invalid start or end ISO 8601 date string");
  }
  return now.isBetween(start, end, undefined, "[]");
}

module.exports = {
    isTokenExpired,
    generateInviteCode,
    isBetweenTimeWindow
}