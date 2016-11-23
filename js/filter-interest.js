---
---
var interestMap = {{ site.data.interests | jsonify }};
var previousSelection = [];

normalizeInterestMap();
populateOptions();		
setHandlers();

/**
* This part normalizes the data in interestMap so that it can handles the filtering for one level or all levels
**/


/* Normalize interest map according to the target level */
function normalizeInterestMap() {
	if (targetLevel === 'all' ) {
		interestMap = mergeAllLevels();
	} else {
		for (var i = 0; i < interestMap.length; i++) {
		  if (interestMap[i].level.toLowerCase() === targetLevel) {
		    interestMap = interestMap[i].data;
		    return;
		  }
		}
	}
}

/* Merge all levels into one giant map */
function mergeAllLevels() {
	var newMap = [];
	for (var i = 0; i < interestMap.length; i++) {
	  for (var j = 0; j < interestMap[i].data.length; j++) {
	    insertToMap(interestMap[i].data[j], newMap);
	  }
	}
	return newMap;
}

/*Append if interest group exists in newMap, else insert a new one*/
function insertToMap(interestGroup, newMap) {
	for (var i = 0; i < newMap.length; i++) {
	  if (interestGroup.interest.toLowerCase() === newMap[i].interest.toLowerCase()) {
	    newMap[i].names = newMap[i].names.concat(interestGroup.names);
	    return;
	  }
	}

	newMap.push(interestGroup);
}

/**
*  This part performs the actual filtering of the cards
**/
function populateOptions() {
	for (var i = 0; i < interestMap.length; i++) {
		var interest = interestMap[i].interest;
		var count = interestMap[i].names.length
		$('#select-interest').append(createOption(interest, count, i));
	}
}

/* Add event handlers to the slider and the drop down */
function setHandlers() {
	$('#select-interest').dropdown({
		onChange: function(value,text){
			if (value.length > 0) {
				loadSheetsApi();
				filterCards(value, !$("#slider").checkbox('is checked'));
			} else {
				showAll();
			}
		}
	});

	$('#slider').checkbox({
		onChange: function(value,text){
			var valueList = $('#select-interest').dropdown('get value');  
			if (valueList[0] != null) {
				filterCards(valueList[valueList.length - 1], !$("#slider").checkbox('is checked')); 
				// returns ["interest", "interest", [Object]], the good stuff is in the last element
			}
		}
	});

}

/* Filter cards */
function filterCards(values, orFilterOn) {
	var names = [];
	var inserted = false;
	for (var i = 0; i < values.length; i++) {
		var value = parseValue(values[i]);
		var mapIndex = value.interestMapIndex;
		if (interestMap[mapIndex].interest.toLowerCase() === value.interest.toLowerCase()) {
			if (orFilterOn || !inserted) {
				names = names.concat(interestMap[mapIndex].names);
				inserted = true;
			} else {
				names = intersect(names, interestMap[mapIndex].names);
			}
		}
	}
	showTheseProfilesOnly(names);
}

/* Show the profiles that are in the names list*/
function showTheseProfilesOnly(names) {
	$('.ui.card').each(function(index, element) {
		for (var i = 0; i < names.length; i++) {
			if ($(element).is("#" + names[i])) {  // show only the elements that have the matching id 
				$(element).css("display", "flex");   
				return;
			}
		}
		
		$(element).css("display", "none");  // if not in the list
	});
}

/** Show all cards **/
function showAll() {
	$('.ui.card').each(function(index, element) {
		$(element).css("display", "flex");
	});	
}

/* Stores the index in the value to save look up times 
*  Format:   value="[3] Game Development"
*
*/
function createOption(interest, count, index) {
	var value = "[" + index + "]" + interest;
	return "<option value='" + value + "'>" + interest + " (" + count + ")</option>";
}

/*
* Parse the below format to interest and index
* Format:   value="[3] Game Development"
*/
function parseValue(value) {
	var bracketEnd = value.indexOf("]");
	var parsed = {
		interestMapIndex : parseInt(value.substring(1, bracketEnd)),
		interest : value.substring(bracketEnd + 1)
	};

	return parsed;
}

/* Returns the intersection between two lists */
function intersect(a, b) {
  var t;
  if (b.length > a.length) t = b, b = a, a = t; // indexOf to loop over shorter
  return a.filter(function (e) {
    if (b.indexOf(e) !== -1) return true;
  });
}

/* Get the selected interests */
function getSelectedInterest() {
	var currentList = $('#select-interest').dropdown('get value'); 
	currentList = currentList[currentList.length - 1] == null ? [] : currentList[currentList.length - 1];
	var diff = currentList.diff(previousSelection);
	if (diff.length > 0) {
		return parseValue(diff[0]).interest;
	} else {
		return null;
	}
}

/* Update the previously selected interests */
function updatePreviouslySelectedInterests() {
	previousSelection = $('#select-interest').dropdown('get value'); 
	previousSelection = previousSelection[previousSelection.length - 1] == null ? [] : previousSelection[previousSelection.length - 1];
}


Array.prototype.diff = function(a) {
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};