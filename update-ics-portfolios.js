#! /usr/bin/env node

// 1. Start on HTML.
// 10. Image processing: https://github.com/EyalAr/lwip

console.log('Starting update_ics_portfolios');
const request = require('request');
const fs = require('fs');
const _ = require('underscore');
const jsonfile = require('jsonfile');

const dataFile = '_data/data.json';
const countFile = '_data/counts.json';

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
  _.each(data, function (entry) {
    profileData.push(entry);
  });
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
          console.log(`Failed to parse bio.json for ${domain}.`);
          reject(new Error(`Failed to parse bio.json for ${domain}.`));
        }
      } else {
        console.log(`Failed to get bio.json for ${domain}.`);
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
  const profileEntry = _.find(profileData, function makeEntry(entry) {
    // console.log(bioHostName, entry.techfolio);
    return entry.techfolio === bioHostName;
  });
  if (profileEntry) {
    _.defaults(profileEntry, {
      name: bio.basics.name,
      label: bio.basics.label,
      website: bio.basics.website,
      summary: bio.basics.summary,
      picture: bio.basics.picture,
      interests: _.map(bio.interests, (interest) => interest.name),
    });
  } else {
    console.log(`Could not find profile entry corresponding to ${bioHostName} (${bio.basics.name})`);
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
  console.log('Writing jekyll info files.');
  jsonfile.spaces = 2;
  jsonfile.writeFile(dataFile, _.sortBy(profileData, 'last'), function (err) {
    console.error(err);
  });
  // now write out a file indicating the number of entries for each type.
  const profileDataGroups = _.countBy(profileData, 'level');
  _.defaults(profileDataGroups, { faculty: 0, undergrad: 0, grad: 0, alumni: 0 });
  profileDataGroups.all = profileDataGroups.faculty + profileDataGroups.undergrad + profileDataGroups.grad +
      profileDataGroups.alumni;
  jsonfile.writeFile(countFile, profileDataGroups, function (err) {
    console.error(err);
  });
}

// ////////////////////  Start the script. ////////////////////////////////////////////

// Set profileData to the contents of the profile entries.
initializeProfileData();

// Create a set of promises for reading in the bio.json files associated with every entry.
// Note that profile-entries cannot yet handle non-Techfolio data.
const bioBodyPromises = _.map(profileData, function (entry) {
  return getBioFiles(entry.techfolio);
});

// Retrieve the bio.json files, add them to the profileData object, then write out a Jekyll file
Promise.all(bioBodyPromises)
    .then(function (bios) {
      updateProfileEntries(bios);
      writeJekyllInfoFiles();
    })
    .catch(console.error);
