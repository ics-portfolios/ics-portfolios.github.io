module.exports = {
  generateHallOfFameTemplate: generateHallOfFameTemplate
}

/* libraries */
const request = require('request');
const fs = require('fs');
const _ = require('underscore');
const jsonic = require('jsonic');
const async = require('async');

/* Files */
const hallOfFameURLFile = '_data/Hall-Of-Fame.json'
const profileTemplateFile = '_includes/portfolio-card.html'
const hallOfFameCardsFile = '_includes/hallOfFameCards.html';

/* constant */
const TYPE_ESSAY = 'essay';
const TYPE_PROJECT = 'project';
const TYPE_PROFILE = 'site';


/* Generate template codes for hall of fame files*/
function generateHallOfFameTemplate(profileData) {  
  const hallOfFameContents = fs.readFileSync(hallOfFameURLFile, 'utf8');
  var works = jsonic(hallOfFameContents);
  
  if (works.length > 0) {
    var tasks = [];
    var essays = [];
    var projects = [];
    var profiles = [];

    for (var i = 0; i < works.length; i++) {

      var work = attachIdentificationFields(works[i], profileData);

      if (work != null) {
        if (work.type === TYPE_ESSAY) {
          essays.push(work);
        }
        else if (work.type === TYPE_PROJECT) {
          projects.push(work);
        } 
        else if (work.type === TYPE_PROFILE) {
          profiles.push(work);
        }
      } else {
        console.log("Cannot find the author in data.json for " + works[i].title + " using the given github username");
      }
    }

    tasks.push(
      function(callback) {
        addExceptionalWorkHTML("Sites", profiles, "", callback);
      },
      function(html, callback) {
        addExceptionalWorkHTML("Projects", projects, html, callback);
      },
      function(html, callback) {
        addExceptionalWorkHTML("Essays", essays, html, callback);
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

/* Get the card's HTML */
function addCardHTML(data, html, callback) {
  const template =
  `        
  <div class="ui centered fluid card">
    <div class="content">
      <h5 class="header">{{ title }}}</h5>
      <h3 class="ui header">
        <img class="ui avatar image left floated" src="{{ img_url }}}">
        {{ author }}
      </h3>
      <h4 class="ui sub header"> Selected Reason: </h4>
      <div class="ui description"> 
        <p> {{ reason }} </p>
      </div>
      <div class="meta">
        <span class="right floated time">{{ date }}</span>
      </div>
    </div>
    <div class="ui bottom attached button">
      <a href={{ url }}> <i class="external icon"></i> View Work </a>
    </div>
  </div>
  `;
  var entry = template.format(data.title, data.imgURL, data.author, data.reason, data.date, data.url);
  callback(null, html + entry + "\n");
}

/* Add section header to the hall of fame section */
function addSectionHeader(header, html, callback) {
  var headerTemplate =  
    ` 
    <div class="column">
      
      <h3 class="ui centered header"> 
        <img src="img/trophy.png"></i> 
        {{ header }}
      </h3> 
    `;

  callback(null, html + headerTemplate.format(header) + '\n');
}

/* Add section closing divs to the hall of fame section */
function addSectionClosingDivs(html, callback) {
  callback(null, html + '</div>' + '\n');
}

/* Append exceptional works to startHtlm */
function addExceptionalWorkHTML(type, works, startHtml, callback) {
  if (works.length > 0) {
    var iterator = makeIterator(works);
    var tasks = [];
    
    tasks.push(
      function(callback1) {
        addSectionHeader(type, startHtml, callback1);
      }
    );
    
    for (var i = 0; i < works.length ; i++) { 
      tasks.push(
        function(html, callback1) {
          addCardHTML(iterator.next().value, html, callback1);
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

/* Attach extra fields to the work by looping through profileData to find the author's name and avatar url*/
function attachIdentificationFields(work, profileData) {
  var matchingProfile = _.find(profileData, function(profile) {
    return profile.username.toLowerCase() === work.github.toLowerCase()
  });

  if (matchingProfile != null) {
    work.author = matchingProfile.name;
    work.imgURL = matchingProfile.picture;
    return work;
  } else {
    return null;
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

