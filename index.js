#! /usr/bin/env node

console.log('Starting update_ics_portfolios');
const request = require('request');

const urls = ['http://www.google.com', 'http://philipmjohnson.org'];
const urlBodies = [];

const urlBodyPromises = urls.map(function (url) {
  return new Promise(function (resolve) {
    request.get(url, function processUrl(error, response, body) {
      if (!error && response.statusCode === 200) {
        urlBodies.push(body);
      } else {
        console.log(`Failed to get body of ${url}.`);
      }
      resolve();
    });
  });
});


Promise.all(urlBodyPromises)
    .then(function () { console.log(`finished, got ${urlBodies.length} bodies`); })
    .catch(console.error);
