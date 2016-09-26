#! /usr/bin/env node

// 1. WriteJekyllInfoFiles: Write out a data file to the _data directory with appropriate info for Jekyll.
// 2. Start on HTML.
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

function updateProfileEntry(bio) {
  // first, strip off the protocol part of the website entry.
  const bioUrl = bio.basics.website;
  const protocolIndex = _.indexOf(bioUrl, ':');
  const bioHostName = bioUrl.substring(protocolIndex + 3);
  const profileEntry = _.find(profileData, function (entry) { return entry.techfolio === bioHostName; });
  if (profileEntry) {
    profileEntry.bio = bio;
  } else {
    console.log(`Could not find profile entry corresponding to ${bio}`);
  }
}

/* Returns the profile entry object whose techfolio entry matches the website entry in the passed bio object. */
function updateProfileEntries(bios) {
  _.each(bios, updateProfileEntry);
}

/**
 * To simplify Jekyll parsing, write out four files: undergrads.json, grads.json, faculty.json, and all.json.
 * Each file is written in sorted order by the last field.
 * Each field contains: bio.basics.name, bio.basics.picture, bio.basics.website, bio.basics.summary, bio.interests
 */
function writeJekyllInfoFiles() {
  console.log('starting write jekyll info files.', profileData);
}


// ////////////////////  Start the script. ////////////////////////////////////////////

// Set profileData to the contents of the profile entries.
initializeProfileData();

// Create a set of promises for reading in the bio.json files associated with every entry.
// Note that profile-entries cannot yet handle non-Techfolio data.
const bioBodyPromises = _.map(profileData, function (entry) { return getBioFiles(entry.techfolio); });

// Retrieve the bio.json files, add them to the profileData object, then write out a Jekyll file
Promise.all(bioBodyPromises)
    .then(function (bios) {
      updateProfileEntries(bios);
      writeJekyllInfoFiles();
    })
    .catch(console.error);


