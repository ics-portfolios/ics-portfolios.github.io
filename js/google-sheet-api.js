// Your Client ID can be retrieved from your project in the Google
// Developer Console, https://console.developers.google.com
var CLIENT_ID = '810634059364-u8kpp48pmf2ev6kineajphdoe2gp1p8a.apps.googleusercontent.com';

var SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * Check if current user has authorized this application.
 */
function checkAuth() {
  gapi.auth.authorize(
    {
      'client_id': CLIENT_ID,
      'scope': SCOPES.join(' '),
      'immediate': true
    }, handleAuthResult);
}

/**
 * Handle response from authorization server.
 *
 * @param {Object} authResult Authorization result.
 */
function handleAuthResult(authResult) {
  if (authResult && !authResult.error) {
    console.log("authenticated");
  } else {  
    console.log("not authenticated");
  }
}

/**
 * Initiate auth flow in response to user clicking authorize button.
 *
 * @param {Event} event Button click event.
 */
function handleAuthClick(event) {
  gapi.auth.authorize(
    {
      client_id: 
      CLIENT_ID, 
      scope: SCOPES, 
      immediate: false
    }, handleAuthResult);
  return false;
}

/**
 * Load Sheets API client library.
 */
function loadSheetsApi() {
  var discoveryUrl =
      'https://sheets.googleapis.com/$discovery/rest?version=v4';
  gapi.client.load(discoveryUrl).then(perform,  function(response) {
    console.log(response);
  } );
}


function readRange(range, handler) {
  gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: '1OtLpwjrYfCcyH1reWY8uUwb7FfSWdJyP0txVhGtZ0lg',
    range: range
  }).then(function(response) {
    handler(response);
  }, function(response) {
    console.log(response);
  });
}

function writeToSheet(range, values) {
  gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: '1OtLpwjrYfCcyH1reWY8uUwb7FfSWdJyP0txVhGtZ0lg',
    range: range,
    valueInputOption: 'RAW',
    values: values
  }).then(function(response) {
    console.log(response);
  });;
}
