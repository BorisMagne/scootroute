// Scooter routing profiles, expressed as Valhalla `motor_scooter` costing options.
//
// Valhalla's motor_scooter costing already models moped behaviour: it honours OSM
// `moped=*` access tags and avoids motorways. We tune it per Dutch plate class.
// The Amsterdam legal overlay (see ../../overlay) is what makes the moped=* tags
// correct inside the Ring A10 — costing alone cannot know local law.

/** @typedef {'snorfiets'|'bromfiets'} ProfileName */

const PROFILES = {
  // Blue plate, max 25 km/h. Strongly prefers the smallest roads and living streets;
  // inside the ring the overlay forces it off the cycleway onto the rijbaan.
  snorfiets: {
    costing: 'motor_scooter',
    costing_options: {
      motor_scooter: {
        top_speed: 25,
        use_primary: 0.2, // avoid big through-roads
        use_hills: 0.5,
        use_living_streets: 0.8, // happy on quiet streets
        shortest: false,
      },
    },
  },

  // Yellow plate, max 45 km/h. More willing to take primaries; still no motorway.
  bromfiets: {
    costing: 'motor_scooter',
    costing_options: {
      motor_scooter: {
        top_speed: 45,
        use_primary: 0.6,
        use_hills: 0.5,
        use_living_streets: 0.4,
        shortest: false,
      },
    },
  },
};

/** @param {string} name @returns {boolean} */
function isProfile(name) {
  return Object.prototype.hasOwnProperty.call(PROFILES, name);
}

module.exports = { PROFILES, isProfile };
