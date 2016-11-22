module.exports = {
  generateHallOfFameTemplate: generateHallOfFameTemplate
}

/* libraries */
const request = require('request');
const fs = require('fs');
const _ = require('underscore');
const jsonic = require('jsonic');
const cheerio = require('cheerio');
const async = require('async');

/* Files */
const hallOfFameURLFile = '_data/Hall-Of-Fame.json'
const profileTemplateFile = '_includes/portfolio-card.html'
const hallOfFameCardsFile = '_includes/hallOfFameCards.html';

/* constant */
const TYPE_ESSAY = 'Exceptional Essays';
const TYPE_PROJECT = 'Exceptional Projects';
const TYPE_PROFILE = 'Exceptional Profiles';

/* placeholder variable to cache template */
var profileTemplate;
var storedProfileData;

/* Generate template codes for hall of fame files*/
function generateHallOfFameTemplate(profileData) {  
  const hallOfFameContents = fs.readFileSync(hallOfFameURLFile, 'utf8');
  var urls = jsonic(hallOfFameContents);
  storedProfileData = profileData;

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
      },
      function(html, callback) {
        addExceptionalProjects(projects, html, callback);
      },
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

    var profileHTML = profileTemplate.format(profile.username, profile.picture, profile.name, profile.label, profile.summary, interests, profile.website)
                        .replace(/href/g, 'target="_blank" href');

    callback(null, html + profileHTML + '\n');
  } else {
    console.log("Unable to get data for " + url + ", perhaps the person's data is not in our database");
    callback(null, html + '\n');
  }
}

/* Get profile data based on the url for that profile's homepage */
function getProfileData(url) {
  var matchingProfile = _.find(storedProfileData, function(profile) {
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

/* Util method for simulating printf("%s", arg1) function*/
String.prototype.format = function() {
    var formatted = this;
    for(arg in arguments) {
        formatted = formatted.replace(/{{.*}}/, arguments[arg]);
    }
    return formatted;
};


/* Util method for making an iterator for array */
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

