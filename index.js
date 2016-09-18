#! /usr/bin/env node

// 1. Create a profile-data.json file.
//    [{ domain: 'philipmjohnson.github.io', techfolio: true, bio-overrides: { name: 'Philip Johnson' }}]
// 2. Read the profiles.json file in as text, convert to JSON, store as profileData.
// 3. Add a default field called bio with name, homepage, picture, interests, summary fields.
// 2  If techfolio, update bio field based on bio.json file data.
// 4. Override bio fields with bio-overrides.
// 3. Write out a data file to this _data directory with info for Jekyll.

console.log('Starting update_ics_portfolios');
const request = require('request');

// URL: https://raw.githubusercontent.com/philipmjohnson/philipmjohnson.github.io/master/_data/bio.json

function getBioJsonUrl(domain) {
  const username = domain.split('.')[0];
  return `https://raw.githubusercontent.com/${username}/${domain}/master/_data/bio.json`;
}

const domains = ['philipmjohnson.github.io'];

const bioJsons = [];

/**
 * Returns a Promise which, when resolved, results in pushing the bio.json onto bioJsons.
 * If an error occurs, prints out a message to the console with the problematic URL.
 * @param url The URL to get the body of.
 * @returns {Promise} A Promise to push that body onto bioJsons.
 */
function getBioFiles(domain) {
  return new Promise(function (resolve) {
    request.get(getBioJsonUrl(domain), function processUrl(error, response, body) {
      if (!error && response.statusCode === 200) {
        try {
          bioJsons.push(JSON.parse(body));
        } catch (e) {
          console.log(`Failed to parse bio.json for ${domain}.`);
        }
      } else {
        console.log(`Failed to get bio.json for ${domain}.`);
      }
      resolve();
    });
  });
}

const urlBodyPromises = domains.map(getBioFiles);

Promise.all(urlBodyPromises)
    .then(function () {
      console.log(bioJsons);
    })
    .catch(console.error);
