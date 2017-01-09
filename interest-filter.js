/* Libraries */

const jsonic = require('jsonic');
const jsonfile = require('jsonfile');
const _ = require('underscore');
const fs = require('fs');

/* Files */
const synonymFile = '_data/synonyms.json';
const interestFile = '_data/interests.json';
const unclassifiedInterestsFile = '_data/unclassifiedInterests.json';

/* Data */
const synonymData = [];
const interestData = [];
const unclassifiedInterests = [];

/* Read synonym data */
function initData() {
  const synonymContents = fs.readFileSync(synonymFile, 'utf8');
  const data = jsonic(synonymContents);
  _.each(data, function (interest) {
    synonymData.push(interest);
  });
}

/* Write to file */
function writeToFile() {
  for (let i = 0; i < interestData.length; i += 1) {
    const levelData = _.sortBy(interestData[i].data, 'interest');
    interestData[i].data = levelData;
  }

  jsonfile.writeFile(interestFile, interestData, function (err) {
    if (err != null) {
      console.error(err);
    }
  });

  jsonfile.writeFile(unclassifiedInterestsFile, unclassifiedInterests, function (err) {
    if (err != null) {
      console.error(err);
    }
  });

  if (unclassifiedInterests.length > 0) {
    console.log(`Check ${unclassifiedInterestsFile} for unclassified interests`);
  } else {
    console.log('All interests are mapped to a term');
  }
}


/* Compare the given interest and the synonym to see if they refer to the same term */
function compareInterestAndSynonym(interest, synonym) {
  const genericInterest = interest.toLowerCase().replace(/ /g, '');
  const genericSynonym = synonym.toLowerCase().replace(/ /g, '');

  if (synonym.length <= 3) {       // handle acronyms
    return genericInterest === genericSynonym;
  }
  return genericInterest.indexOf(genericSynonym) !== -1;
}

/* Create a new interest group using the given interest and name */
function createInterestGroup(interest, name, levelIndex, level) {
  const interestGroup = {
    interest,
    names: [name],
  };

  if (levelIndex >= 0) {
    interestData[levelIndex].data.push(interestGroup);
  } else {
    const levelGroup = {
      level,
      data: [interestGroup],
    };
    interestData.push(levelGroup);
  }
}

/* Insert interest to unclassifiedInterests */
function insertToUnclassifiedInterests(interest) {
  unclassifiedInterests.push(interest);
}

/* Find the index in the interestData array for the certain level */
function findLevelIndex(level) {
  for (let i = 0; i < interestData.length; i += 1) {
    if (interestData[i].level.toLowerCase() === level.toLowerCase()) {
      return i;
    }
  }
  return -1;
}

/* Group interest together to the corresponding interest in interestData */
function groupInterest(interest, name, level) {
  let term = 'unclassified';
  let foundInSynonyms = false;

  for (let i = 0; i < synonymData.length; i += 1) {
    const matched = _.find(synonymData[i].synonyms, function (synonym) {  // loop through all synoyms for a given term
      return compareInterestAndSynonym(interest, synonym);
    });

    if (matched != null) {            // a term for the interest is found
      term = synonymData[i].term;
      foundInSynonyms = true;
      break;
    }
  }

  if (foundInSynonyms) {
    const levelIndex = findLevelIndex(level);

    if (levelIndex >= 0) {
      for (let i = 0; i < interestData[levelIndex].data.length; i += 1) {
        if (interestData[levelIndex].data[i].interest.toLowerCase() === term.toLowerCase()) {
          // insert the interest into interestData
          interestData[levelIndex].data[i].names.push(name);
          return;
        }
      }
    }

    // if this interest is not found in interestData, start its own group
    createInterestGroup(term, name, levelIndex, level);
  } else {
    // not found, push to unclassified Interest
    insertToUnclassifiedInterests(interest);
  }
}

module.exports = {
  groupInterest,
  writeToFile,
  initData,
};

