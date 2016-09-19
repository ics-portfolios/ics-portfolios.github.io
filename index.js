#! /usr/bin/env node

// 1. Merge the bio.json file into the profile data. Match the techfolio key against the website field.
//    This will fail for me, unfortunately, unless I update my bio.json.
//    I should do that for now, then when I implement defaults, I can override somehow.
//    The website is the only unique key I can use to match profile entries to the bio.json file.
// 3. Write out a data file to the _data directory with appropriate info for Jekyll.
// 4. Start on HTML.
// 10. Image processing: https://github.com/EyalAr/lwip

console.log('Starting update_ics_portfolios');
const request = require('request');
const fs = require('fs');
const _ = require('underscore');

/** Location of the profile entries file. */
const profileEntriesFile = 'profile-entries.json';

/** Holds the profile data, initialized with profile-entries, then updated with bio.json. */
const profileData = [];

/**
 * Initializes profileData with the contents of the profile-entries file.
 */
function initializeProfileData() {
  const contents = fs.readFileSync(profileEntriesFile, 'utf8');
  const data = JSON.parse(contents);
  _.each(data, function (entry) { profileData.push(entry); });
}

/**
 * Given a techfolio hostname, returns the URL to its associated bio.json file.
 * @param techfolioHostName A domain, such as 'philipmjohnson.github.io'.
 * @returns {string} The corresponding URL to the bio.json file.
 */
function getBioJsonUrl(techfolioHostName) {
  // URL: https://raw.githubusercontent.com/philipmjohnson/philipmjohnson.github.io/master/_data/bio.json
  const username = techfolioHostName.split('.')[0];
  return `https://raw.githubusercontent.com/${username}/${techfolioHostName}/master/_data/bio.json`;
}

/**
 * Returns a Promise which, when resolved, results in pushing the bio.json onto bioJsons.
 * If an error occurs, prints out a message to the console with the problematic URL.
 * @param url The URL to get the body of.
 * @returns {Promise} A Promise to push that body onto bioJsons.
 */
function getBioFiles(domain) {
  return new Promise(function (resolve, reject) {
    request.get(getBioJsonUrl(domain), function processUrl(error, response, body) {
      if (!error && response.statusCode === 200) {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse bio.json for ${domain}.`));
        }
      } else {
        reject(new Error(`Failed to get bio.json for ${domain}.`));
      }
    });
  });
}

// ////////////////////  Start the script. ////////////////////////////////////////////

// Set profileData to the contents of the profile entries.
initializeProfileData();

// Create a set of promises for reading in the bio.json files associated with every entry.
// Note that profile-entries cannot yet handle non-Techfolio data.
const urlBodyPromises = _.map(profileData, function (entry) { return getBioFiles(entry.techfolio); });

// Retrieve the bio.json files.
Promise.all(urlBodyPromises)
    .then(function (body) {
      console.log(body);
    })
    .catch(console.error);
