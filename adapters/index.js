const generic = require('./generic');
const beisen = require('./beisen');
const moka = require('./moka');
const tupu360 = require('./tupu360');

const map = { generic, beisen, moka, tupu360, custom: generic };

function getAdapter(t) {
  return map[t] || generic;
}

module.exports = { getAdapter };
