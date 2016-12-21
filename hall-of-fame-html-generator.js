/* libraries */
const fs = require('fs');
const _ = require('underscore');
const jsonic = require('jsonic');
const async = require('async');

/* Files */
const hallOfFameURLFile = '_data/Hall-Of-Fame.json';
const hallOfFameCardsFile = '_includes/hallOfFameCards.html';

/* constant */
const TYPE_ESSAY = 'essay';
const TYPE_PROJECT = 'project';
const TYPE_PROFILE = 'site';

/* Util method for simulating printf("%s", arg1) function*/
function formatString(string, ...args) {
  let formatted = string;
  for (let i = 0; i < arguments.length; i += 1) {
    formatted = formatted.replace(/{{.*}}/, args[i]);
  }
  return formatted;
}

/* Util method for making an iterator for array */
function makeIterator(array) {
  let nextIndex = 0;
  return {
    next() {
      return nextIndex < array.length ?
      {
        value() {
          const element = array[nextIndex];
          nextIndex += 1;
          return element;
        },
        done: false,
      } :
      {
        done: true,
      };
    },
  };
}

/* Attach extra fields to the work by looping through profileData to find the author's name and avatar url*/
function attachIdentificationFields(work, profileData) {
  const matchingProfile = _.find(profileData, function (profile) {
    return profile.username.toLowerCase() === work.github.toLowerCase();
  });

  if (matchingProfile != null) {
    const identifiedWork = work;
    identifiedWork.author = matchingProfile.name;
    identifiedWork.imgURL = matchingProfile.picture;
    return identifiedWork;
  }

  console.log(`Cannot find the owner for ${work.url}`);
  return null;
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
    <a class="ui bottom attached button" href="{{ url }}" target="_blank">
      <p> <i class="external icon"></i> View Work </p>
    </a>  
  </div>
  `;

  const entry = formatString(template, data.title, data.imgURL, data.author, data.reason, data.date, data.url);
  callback(null, `${html} ${entry} \n`);
}

/* Add section header to the hall of fame section */
function addSectionHeader(header, html, callback) {
  const headerTemplate =
      ` 
    <div class="column">
      
      <h3 class="ui centered header"> 
        <img src="img/trophy.png"></i> 
        {{ header }}
      </h3> 
    `;

  callback(null, `${html} ${formatString(headerTemplate, header)} \n`);
}

/* Add section closing divs to the hall of fame section */
function addSectionClosingDivs(html, callback) {
  callback(null, `${html} </div> \n`);
}

/* Append exceptional works to startHtlm */
function addExceptionalWorkHTML(type, works, startHtml, callback) {
  if (works.length > 0) {
    const iterator = makeIterator(works);
    const tasks = [];

    let createHtmlTask = function (callback1) {
      addSectionHeader(type, startHtml, callback1);
    };

    tasks.push(createHtmlTask);

    for (let i = 0; i < works.length; i += 1) {
      createHtmlTask = function (html, callback1) {
        addCardHTML(iterator.next().value(), html, callback1);
      };
      tasks.push(createHtmlTask);
    }

    createHtmlTask = function (html, callback1) {
      addSectionClosingDivs(html, callback1);
    };

    tasks.push(createHtmlTask);

    async.waterfall(tasks, function (err, result) {
      callback(null, result);
    });
  } else {
    callback(null, `${startHtml} \n`);
  }
}

/* Generate template codes for hall of fame files*/
function generateHallOfFameTemplate(profileData) {
  const hallOfFameContents = fs.readFileSync(hallOfFameURLFile, 'utf8');
  const works = jsonic(hallOfFameContents);

  if (works.length > 0) {
    const tasks = [];
    const essays = [];
    const projects = [];
    const profiles = [];

    for (let i = 0; i < works.length; i += 1) {
      const work = attachIdentificationFields(works[i], profileData);

      if (work != null) {
        if (work.type === TYPE_ESSAY) {
          essays.push(work);
        } else if (work.type === TYPE_PROJECT) {
          projects.push(work);
        } else if (work.type === TYPE_PROFILE) {
          profiles.push(work);
        }
      } else {
        console.log(`Cannot find the author in data.json for ${works[i].title} using the given github username`);
      }
    }

    tasks.push(
        function (callback) {
          addExceptionalWorkHTML('Sites', profiles, '', callback);
        },
        function (html, callback) {
          addExceptionalWorkHTML('Projects', projects, html, callback);
        },
        function (html, callback) {
          addExceptionalWorkHTML('Essays', essays, html, callback);
        });

    async.waterfall(tasks, function (err, result) {
      if (err) {
        console.log(err);
      }
      fs.writeFile(hallOfFameCardsFile, result, function (IOerr) {
        console.log(`Writing to ${hallOfFameCardsFile}`);
        if (IOerr) {
          return console.log(IOerr);
        }
        return null;
      });
    });
  }
}

module.exports = {
  generateHallOfFameTemplate,
};
