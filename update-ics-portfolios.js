#! /usr/bin/env node

// Image processing: https://github.com/EyalAr/lwip

console.log('Starting update_ics_portfolios');
const request = require('request');
const fs = require('fs');
const _ = require('underscore');
const jsonfile = require('jsonfile');
const jsonic = require('jsonic');
const cheerio = require('cheerio');
const async = require('async');

const dataFile = '_data/data.json';
const hallOfFameURLFile = '_data/Hall-Of-Fame.json'
const profileTemplateFile = '_includes/portfolio-card.html'

/** Location of the profile entries file. */
const profileEntriesFile = 'profile-entries.json';

const hallOfFameCardsFile = '_includes/hallOfFameCards.html';

const TYPE_ESSAY = 'Exceptional Essays';
const TYPE_PROJECT = 'Exceptional Projects';
const TYPE_PROFILE = 'Exceptional Profiles';


/** Holds the profile data, initialized with profile-entries, then updated with bio.json. */
const profileData = [];
var profileTemplate;

/**
 * Initializes profileData with the contents of the profile-entries file.
 */
function initializeProfileData() {
  const contents = fs.readFileSync(profileEntriesFile, 'utf8');
  const data = jsonic(contents);
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
      _.defaults(profileEntry, {
        name: bio.basics.name,
        label: bio.basics.label,
        website: canonicalHostName(bio.basics.website),
        summary: bio.basics.summary,
        picture: fixPicturePrefix(bio.basics.picture),
        interests: _.map(bio.interests, (interest) => interest.name),
      });
      // strip any trailing slash on website url
      profileEntry.website.replace(/\/$/, '');

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
    if (err) {
      console.error(err);
    }
  });

  generateHallOfFameTemplate();
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

// Set profileData to the contents of the profile entries.
initializeProfileData();

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


/* Generate template codes for hall of fame files*/
function generateHallOfFameTemplate() {  
  const hallOfFameContents = fs.readFileSync(hallOfFameURLFile, 'utf8');
  var urls = jsonic(hallOfFameContents);

  if (urls.length > 0) {
    var tasks = [];
    var essays = [];
    var projects = [];
    var profiles = [];

    for (var i = 0; i < urls.length; i++) {
      if (urls[i].indexOf('/essays/') >= 0) {
        essays.push(urls[i]);
      }
      else if (urls[i].indexOf('/projects/') >= 0) {
        projects.push(urls[i]);
      } 
      else if (urls[i].replace('https://', '').replace('http://', '').split('.').length === 3) {
        profiles.push(urls[i]);
      }
    }

    tasks.push(
      function(callback) {
        addExceptionalEssays(essays, "", callback);
      }
    );

    tasks.push(
      function(html, callback) {
        addExceptionalProjects(projects, html, callback);
      }
    );

    tasks.push(
      function(html, callback) {
        addExceptionalProfiles(profiles, html, callback);
      }
    );

    async.waterfall(tasks, function(err, result) {
      if (err) {
        console.log(err);
      }
      fs.writeFile(hallOfFameCardsFile, result, function(err) {
        console.log("Writing to " + hallOfFameCardsFile);
        if(err) {
          return console.log(err);
        }
      });
    });
  } 
}

/* Get profile card HTML */
function getProfileHTML(url, html, callback) {
  console.log("Reading " + url + " as a profile card for hall of fame");
  var profile = getProfileData(url);
  if (profile != null) {
    if (profileTemplate == null || profileTemplate.length === 0) {
      profileTemplate = fs.readFileSync(profileTemplateFile, 'utf8').replace(/{%.*%}/g, '');
    }
    var interests = "";
    _.each(profile.interests, function(interest) {
      interests += interest + ', ';
    });
    interests = interests.substring(0, interests.length - 2);

    var profileHTML = profileTemplate.format(profile.picture, profile.name, profile.label, profile.summary, interests, profile.website)
                        .replace(/href/g, 'target="_blank" href');

    callback(null, html + profileHTML + '\n');
  } else {
    console.log("Unable to get data for " + url + ", perhaps the person's data is not in our database");
    callback(null, html + '\n');
  }
}

/* Get profile data based on the url for that profile's homepage */
function getProfileData(url) {
  var matchingProfile = _.find(profileData, function(profile) {
    return profile.website.replace(/\//g, '') === url.replace(/\//g, '');
  });

  return matchingProfile; 
}


/* Get the card's HTML */
function getExceptionalWorkHTML(url, html, callback) {
  console.log("Reading " + url + " as a essay or project for hall of fame");
  var summaryPageURL = url.substring(url.substring(0, url.length - 1), url.lastIndexOf("/") + 1);
  var documentName = url.substring(summaryPageURL.length);
  var baseURL = summaryPageURL.substring(0, summaryPageURL.length - 1);
  baseURL = baseURL.substring(0, baseURL.lastIndexOf("/"));
  
  request(summaryPageURL, function (error, response, body) {
    'use strict';
    if (!error && response.statusCode == 200) {
      let $ = cheerio.load(body);
      $(".card").each(function(index, card) {
        var cardHTML = $.html($(this));
        if (cardHTML.indexOf(documentName) >= 0) {
          var cardObject = replaceLinksToAbsolutePath($, cardHTML, baseURL);
          callback(null, html + cardObject.html() + '\n');
        }
      });
    }
  });
}

/* Add section header to the hall of fame section */
function addSectionHeader(header, html, callback) {
  var headerTemplate =  
    `<div class="ui raised segment">
      <h1 class="ui header"> 
        <i class="trophy icon"></i> {{ header }}} 
      </h1>
      <div class="ui divider"></div>
      <div class="ui four centered stackable cards">`;

  callback(null, html + headerTemplate.format(header) + '\n');
}

/* Add section closing divs to the hall of fame section */
function addSectionClosingDivs(html, callback) {
  callback(null, html + '</div></div>' + '\n');
}

/* Add exceptional essays from the URLs */
function addExceptionalEssays(urls, startHtml, callback) {
  addSection(urls, startHtml, TYPE_ESSAY, getExceptionalWorkHTML, callback);
}

/* Add exceptional projects from the URLs */
function addExceptionalProjects(urls, startHtml, callback) {
  addSection(urls, startHtml, TYPE_PROJECT, getExceptionalWorkHTML, callback);
}

/* Add exceptional profiles from the URLs */
function addExceptionalProfiles(urls, startHtml, callback) {
  addSection(urls, startHtml, TYPE_PROFILE, getProfileHTML, callback);
}

/* Add a section appened to the startHtml */
function addSection(urls, startHtml, type, generator, callback) {
  if (urls.length > 0) {
    var iterator = makeIterator(urls);
    var tasks = [];
    
    tasks.push(
      function(callback1) {
        addSectionHeader(type, startHtml, callback1);
      }
    );
    
    for (var i = 0; i < urls.length ; i++) { 
      tasks.push(
        function(html, callback1) {
          generator(iterator.next().value, html, callback1);
        }
      );
    }

    tasks.push(
      function(html, callback1) {
        addSectionClosingDivs(html, callback1);
      }
    );

    async.waterfall(tasks, function(err, result) {
      callback(null, result);
    });
  } else {
    callback(null, startHtml + '\n');
  }
}

function makeIterator(array){
    var nextIndex = 0;
    
    return {
       next: function() {
           return nextIndex < array.length ?
               {value: array[nextIndex++], done: false} :
               {done: true};
       }
    }
}

/* Replace card's href and src to absolute paths*/
function replaceLinksToAbsolutePath($, cardHTML, baseURL) {
  var cardObject = $('<div>' + cardHTML + '</div>');
  cardObject.find('a').each(function() {
    var href = $(this).attr('href');
    $(this).attr('href', toAbsoluteURL(href, baseURL));
    $(this).attr('target', '_blank');
  });

  cardObject.find('img').each(function() {
    var href = $(this).attr('src');
    $(this).attr('src', toAbsoluteURL(href, baseURL));
  });  

  return cardObject;
}

/* convert relative url to absolute url */
function toAbsoluteURL(relativeURL, base) {
  if (relativeURL.indexOf("http") < 0) {
    if (!base.endsWith("/")) {
      base += "/";
    }
    if (relativeURL.startsWith("/")) {
      relativeURL = relativeURL.substring(1);
    }
    return base + relativeURL;
  } else {
    return relativeURL;
  }
}



String.prototype.format = function() {
    var formatted = this;
    for(arg in arguments) {
        formatted = formatted.replace(/{{.*}}/, arguments[arg]);
    }
    return formatted;
};



