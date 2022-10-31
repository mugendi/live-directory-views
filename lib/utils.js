const crypto = require('crypto');

function md5(str) {
	if ('string' !== typeof str) str = JSON.stringify(str, 0, 4);
    // console.log({str});
	return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = {md5}