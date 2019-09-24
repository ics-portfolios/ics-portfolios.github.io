#! /usr/bin/env node
// Image processing: https://github.com/EyalAr/lwip

console.log('Starting update_ics_portfolios');

const request = require('request');
const fs = require('fs');
const _ = require('underscore');
const jsonic = require('jsonic');
const jsonfile = require('jsonfile');
const filterInterest = require('./interest-filter');
const hallOfFameGenerator = require('./notable-html-generator');

const dataFile = '_data/data.json';

/** Location of the profile entries file. */
const profileEntriesFile = 'profile-entries.json';

/** Holds the profile data, initialized with profile-entries, then updated with bio.json. */
const profileData = [];

/**
 * Initializes profileData with the contents of the profile-entries file, and load synonyms from synonyms.json.
 */
function initializeData() {
  const profileContents = fs.readFileSync(profileEntriesFile, 'utf8');
  const data = jsonic(profileContents);
  _.each(data, function (entry) {
    profileData.push(entry);
  });

  filterInterest.initData();
}

/**
 * Given a techfolio hostname, returns the URL to its associated bio.json file.
 * @param techfolioHostName A domain, such as 'philipmjohnson.github.io'.
 * @returns {string} The corresponding URL to the bio.json file.
 */
function getBioJsonUrl(techfolioHostName) {
  // URL: https://raw.githubusercontent.com/philipmjohnson/philipmjohnson.github.io/master/_data/bio.json
  // const username = techfolioHostName.split('.')[0];
  // return `https://raw.githubusercontent.com/${username}/${techfolioHostName}/master/_data/bio.json`;
  return `https://${techfolioHostName}/_data/bio.json`;
}

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
          resolve(jsonic(body));
        } catch (e) {
          console.log(`Error: https://${domain}/_data/bio.json\n    ${e.name} ${e.message}, line: ${e.lineNumber}`);
          // reject(new Error(`Failed to parse bio.json for ${domain}.`));
          resolve({});
        }
      } else {
        console.log(`Failed to get bio.json  ${domain}. Error: ${error}, code: ${response && response.statusCode}`);
        // reject(new Error(`Failed to get bio.json for ${domain}.`));
        resolve({});
      }
    });
  });
}

function canonicalHostName(name) {
  let canonicalName = name.toLowerCase();
  //  canonicalName.replace(/\/$/, ''); // why this doesn't work in the case of pexzabe is beyond me.
  if (canonicalName.slice(-1) === '/') {
    canonicalName = canonicalName.slice(0, -1);
  }
  if (!canonicalName.startsWith('http')) {
    canonicalName = `https://${canonicalName}`;
  }
  return canonicalName;
}

function fixPicturePrefix(pictureUrl) {
  return (pictureUrl.startsWith('http')) ? pictureUrl : `https://${pictureUrl}`;
}

function updateProfileEntry(bio) {
  // console.log('==============================================');
  // console.log(bio);
  if (!_.isEmpty(bio)) {
    // first, strip off the protocol part of the website entry.
    const bioUrl = bio.basics.website;
    const { email } = bio.basics;
    const protocolIndex = _.indexOf(bioUrl, ':');
    const bioHostName = bioUrl.substring(protocolIndex + 3);
    const profileEntry = _.find(profileData, function makeEntry(entry) {
      return canonicalHostName(entry.techfolio) === canonicalHostName(bioHostName);
    });
    if (profileEntry) {
      const website = canonicalHostName(bio.basics.website);
      const username = website.split('.')[0].replace('https://', '').replace('http://', '');

      _.defaults(profileEntry,
        {
          name: bio.basics.name,
          label: bio.basics.label,
          email,
          website,
          username,
          summary: bio.basics.summary,
          picture: bio.basics.picture ? fixPicturePrefix(bio.basics.picture) : '',
          interests: _.map(bio.interests, interest => interest.name),
        });

      // strip any trailing slash on website url
      profileEntry.website = profileEntry.website.replace(/\/$/, '');
      const { level } = profileEntry;

      for (let i = 0; i < profileEntry.interests.length; i += 1) {
        filterInterest.groupInterest(profileEntry.interests[i], username, level);
      }
    } else {
      console.log(`Could not find profile entry corresponding to ${bioHostName} (${bio.basics.name})`);
    }
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
    if (err != null) {
      console.error(err);
    }
  });

  filterInterest.writeToFile();
  hallOfFameGenerator.generateHallOfFameTemplate(profileData);
}

/**
 * From https://stackoverflow.com/questions/46155/how-to-validate-email-address-in-javascript
 */
/* eslint-disable no-useless-escape, max-len */
function validateEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}


function writeEmailAddresses() {
  let emails = _.map(profileData, profile => profile.email);
  emails = _.filter(emails, email => validateEmail(email));
  emails = _.sortBy(emails);
  const emailString = _.reduce(emails, (memo, email) => memo.concat(`\n${email}`));
  console.log('Writing _data/emails.txt');
  fs.writeFile('_data/emails.txt', emailString, (err) => { if (err) console.log('Error writing emails', err); });
}

function updateProfileDataFromLocalBio(localProfiles) {
  _.map(localProfiles, function updateLocal(localProfile) {
    const dirName = localProfile.tmpbio;
    const contents = fs.readFileSync(`_tmpbios/${dirName}/bio.json`, 'utf8');
    const bio = jsonic(contents);
    updateProfileEntry(bio);
  });
}

// ////////////////////  Start the script. ////////////////////////////////////////////

// Set profileData to the contents of the profile entries and sy.
initializeData();

// Create a set of promises for reading in the bio.json files associated with every entry.
// Note that profile-entries cannot yet handle non-Techfolio data.

const localProfileData = _.filter(profileData, obj => _.has(obj, 'tmpbio'));

updateProfileDataFromLocalBio(localProfileData);

const cloudProfileData = _.filter(profileData, obj => !_.has(obj, 'tmpbio'));
const bioBodyPromises = _.map(cloudProfileData, function (entry) {
  return getBioFiles(entry.techfolio);
});

// Retrieve the bio.json files, add them to the profileData object, then write out a Jekyll file
Promise.all(bioBodyPromises)
  .then(function (bios) {
    updateProfileEntries(bios);
    writeJekyllInfoFiles();
    writeEmailAddresses();
  })
  .catch(console.error);
