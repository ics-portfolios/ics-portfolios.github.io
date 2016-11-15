#! /usr/bin/env node

// Image processing: https://github.com/EyalAr/lwip

console.log('Starting update_ics_portfolios');
const request = require('request');
const fs = require('fs');
const _ = require('underscore');
const jsonfile = require('jsonfile');
const jsonic = require('jsonic');

const dataFile = '_data/data.json';
const synonymFile = '_data/synonyms.json'
const interestFile = '_data/interests.json';
const unclassifiedInterestsFile = '_data/unclassifiedInterests.json';

/** Location of the profile entries file. */
const profileEntriesFile = 'profile-entries.json';

/** Holds the profile data, initialized with profile-entries, then updated with bio.json. */
const profileData = [];

/** Holds all the term to synonyms data, defined in synonymFile **/
const synonymData = [];

/** Holds all the interest data for each person **/
const interestData = [];

/** Holds all the names that have interests unclassified **/
const unclassifiedInterests = [];

/**
 * Initializes profileData with the contents of the profile-entries file, and load synonyms from synonyms.json.
 */
function initializeData() {
  const profileContents = fs.readFileSync(profileEntriesFile, 'utf8');
  var data = jsonic(profileContents);
  _.each(data, function (entry) {
    profileData.push(entry);
  });

  const synonymContents = fs.readFileSync(synonymFile, 'utf8');
  data = jsonic(synonymContents);
  _.each(data, function(interest) {
    synonymData.push(interest);
  })

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
        console.log(`Failed to get bio.json for ${domain}.`);
        // reject(new Error(`Failed to get bio.json for ${domain}.`));
        resolve({});
      }
    });
  });
}

function canonicalHostName(name) {
  'use strict';
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
  if (!_.isEmpty(bio)) {
    // first, strip off the protocol part of the website entry.
    const bioUrl = bio.basics.website;
    const protocolIndex = _.indexOf(bioUrl, ':');
    const bioHostName = bioUrl.substring(protocolIndex + 3);
    const profileEntry = _.find(profileData, function makeEntry(entry) {
      //console.log(`${canonicalHostName(entry.techfolio)}, ${canonicalHostName(entry.techfolio).length}, ${canonicalHostName(bioHostName)}, ${canonicalHostName(bioHostName).length}`);
      return canonicalHostName(entry.techfolio) === canonicalHostName(bioHostName);
    });
    if (profileEntry) {
      var website = canonicalHostName(bio.basics.website);
      var username = website.split('.')[0].replace('https://', '').replace('http://', '');

      _.defaults(profileEntry, {
        name: bio.basics.name,
        label: bio.basics.label,
        website: website,
        username: username,
        summary: bio.basics.summary,
        picture: fixPicturePrefix(bio.basics.picture),
        interests: _.map(bio.interests, (interest) => interest.name)        
      });
      // strip any trailing slash on website url
      profileEntry.website = profileEntry.website.replace(/\/$/, '');
      var level = profileEntry.level;

      for(var i = 0; i < profileEntry.interests.length; i++) {
        groupInterest(profileEntry.interests[i], username, level);
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
    console.error(err);
  });

  /*for (var level in interestData) {
    var levelData = _.sortBy(interestData[level], function(interestGroup) {
      return interestGroup.names.length * -1;  
    });

    interestData[level] = levelData;
  }*/


  jsonfile.writeFile(interestFile, interestData, function (err) {
    console.error(err);
  });

  jsonfile.writeFile(unclassifiedInterestsFile, unclassifiedInterests, function(err) {
    console.error(err);
  });

  if (unclassifiedInterests.length > 0) {
    console.log("Check " + unclassifiedInterestsFile + " for unclassified interests");
  } else {
    console.log("All interests are mapped to a term");  
  }

}

function updateProfileDataFromLocalBio(localProfiles) {
  _.map(localProfiles, function updateLocal(localProfile) {
    const dirName = localProfile.tmpbio;
    const contents = fs.readFileSync(`_tmpbios/${dirName}/bio.json`, 'utf8');
    const bio = jsonic(contents);
    updateProfileEntry(bio);
  });
}

/* Group interest together to the corresponding interest in interestData */
function groupInterest(interest, name, level) {
  var term = "unclassified";
  var foundInSynonyms = false;

  for (var i = 0; i < synonymData.length; i++) {
    var matched = _.find(synonymData[i].synonyms, function(synonym) {  // loop through all synoyms for a given term 
      return compareInterestAndSynonym(interest, synonym);
    });

    if (matched != null) {            // a term for the interest is found
      term = synonymData[i].term;
      foundInSynonyms = true;
      break;
    } 
  }

  if (foundInSynonyms) {
    var levelIndex = findLevelIndex(level);

    if (levelIndex >= 0) {
      for (var i = 0; i < interestData[levelIndex].data.length; i++) {
        if (interestData[levelIndex].data[i].interest.toLowerCase() === term.toLowerCase()) {   // insert the interest into interestData
          interestData[levelIndex].data[i].names.push(name);
          return;
        }
      }
    }

    createInterestGroup(term, name, levelIndex, level);    // if this interest is not found in interestData, start its own group

  } else {
    insertToUnclassifiedInterests(interest);    // not found, push to unclassified Interest 
  } 
}

/* Create a new interest group using the given interest and name */
function createInterestGroup(interest, name, levelIndex, level) {
  const interestGroup = {
    interest: interest,
    names: [name]  
  }
  
  if (levelIndex >= 0) {
    interestData[levelIndex].data.push(interestGroup);
  } else {
    const levelGroup = {
      level: level,
      data: [interestGroup]
    }
    interestData.push(levelGroup);
  }
}

function findLevelIndex(level)  {
  for (var i = 0; i < interestData.length; i++) {
    if (interestData[i].level.toLowerCase() === level.toLowerCase()) {
      return i;
    }
  }
  return -1;
}

/* Insert interest to unclassifiedInterests */
function insertToUnclassifiedInterests(interest) {
  unclassifiedInterests.push(interest);
}

/* Compare the given interest and the synonym to see if they refer to the same term */
function compareInterestAndSynonym(interest, synonym) {
  interest = interest.toLowerCase().replace(/ /g, "");
  synonym = synonym.toLowerCase().replace(/ /g, "");
  if (synonym.length <= 3) {       // handle acronyms
    return interest === synonym;
  } else {
    return interest.indexOf(synonym) != -1;
  }
}

// ////////////////////  Start the script. ////////////////////////////////////////////

// Set profileData to the contents of the profile entries and sy.
initializeData();

// Create a set of promises for reading in the bio.json files associated with every entry.
// Note that profile-entries cannot yet handle non-Techfolio data.

const localProfileData = _.filter(profileData, (obj) => _.has(obj, 'tmpbio'));

updateProfileDataFromLocalBio(localProfileData);

const cloudProfileData = _.filter(profileData, (obj) => !_.has(obj, 'tmpbio'));
const bioBodyPromises = _.map(cloudProfileData, function (entry) {
  return getBioFiles(entry.techfolio);
});

// Retrieve the bio.json files, add them to the profileData object, then write out a Jekyll file
Promise.all(bioBodyPromises)
    .then(function (bios) {
      updateProfileEntries(bios);
      writeJekyllInfoFiles();
    })
    .catch(console.error);
