/* libraries */
const fs = require('fs');
const _ = require('underscore');
const jsonic = require('jsonic');

/* Files */
const hallOfFameURLFile = '_data/notable-entries.json';
const hallOfFameCardsFile = '_includes/notableCards.html';

/* constant */
const TYPE_ESSAY = 'essay';
const TYPE_PROJECT = 'project';
const TYPE_PROFILE = 'site';

/* Util method for simulating printf("%s", arg1) function */
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
      if (nextIndex < array.length) {
        return {
          value() {
            const element = array[nextIndex];
            nextIndex += 1;
            return element;
          },
        };
      }
      return {
        value() {
          return null;
        },
      };
    },
  };
}

/* Util method to get the next piece of work in the order of site, project, essay */
function createWorkRotationalIterator(sites, projects, essays) {
  const sitesIterator = makeIterator(sites);
  const projectsIterator = makeIterator(projects);
  const essaysIterator = makeIterator(essays);

  const iterators = [sitesIterator, projectsIterator, essaysIterator];
  const totalCount = sites.length + projects.length + essays.length;
  let nextIteratorIndex = 0;
  let currentIndex = 0;

  return {
    hasNext() {
      return currentIndex < totalCount;
    },
    next() {
      return {
        value() {
          const work = iterators[nextIteratorIndex].next().value();
          if (work != null) {
            currentIndex += 1;
          }
          nextIteratorIndex = (nextIteratorIndex + 1) % 3;
          return work;
        },
      };
    },
  };
}

/* Attach extra fields to the work by looping through profileData to find the author's name and avatar url */
function attachIdentificationFields(work, profileData) {
  const matchingProfile = _.find(profileData, function (profile) {
    return profile.username && work.github && profile.username.toLowerCase() === work.github.toLowerCase();
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
function getCardHtml(data) {
  const template =
    `        
  <div class="ui centered fluid card">
    <div class="content">
      <img class="right floated tiny ui image" src="{{ img_url }}}">
      <div class="header">{{ title }}}</div>
      <div class="meta">{{ author }}</div>
      <div class="description">{{{ reason }}}</div>
    </div>
    <a class="ui bottom attached button" href="{{ url }}" target="_blank">
      <p> <i class="external icon"></i> View Work </p>
    </a>  
  </div>
  `;

  const entry = formatString(template, data.imgURL, data.title, data.author, data.reason, data.url);
  return entry;
}

/* Generate a row of exceptional work */
function getRowHtml(site, project, essay) {
  let html = '<div class="three column stretched row">';

  const works = [site, project, essay];
  for (let i = 0; i < works.length; i += 1) {
    html += '<div class="column">';
    if (works[i] != null) {
      html += getCardHtml(works[i]);
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/* Generate template codes for hall of fame files */
function generateHallOfFameTemplate(profileData) {
  const hallOfFameContents = fs.readFileSync(hallOfFameURLFile, 'utf8');
  const works = jsonic(hallOfFameContents);

  if (works.length > 0) {
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

    const workRotationalIterator = createWorkRotationalIterator(profiles, projects, essays);
    let html = '';
    while (workRotationalIterator.hasNext()) {
      html += getRowHtml(workRotationalIterator.next().value(),
        workRotationalIterator.next().value(),
        workRotationalIterator.next().value());
    }

    fs.writeFile(hallOfFameCardsFile, html, function (IOerr) {
      console.log(`Writing to ${hallOfFameCardsFile}`);
      if (IOerr) {
        return console.log(IOerr);
      }
      return null;
    });
  }
}

module.exports = {
  generateHallOfFameTemplate,
};
