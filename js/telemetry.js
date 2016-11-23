/* Read and write */
function perform() {
	readRange("Sheet1!A:B", function(response) {
		var selectedInterest = getSelectedInterest();
		if (selectedInterest != null) {
			var existsInSheetResult = existsInSheet(response, getSelectedInterest());
			if (existsInSheetResult.exist) {
				var range = 'Sheet1!B' + existsInSheetResult.index + ':B' + existsInSheetResult.index;
				writeToSheet(range, [[existsInSheetResult.count + 1]]);
			} else {
				var cellIndex = getNextCellIndex(response);
				var range = 'Sheet1!A' + cellIndex + ':B' + cellIndex;
				writeToSheet(range, [[selectedInterest , 1]]);
			}
		}
		updatePreviouslySelectedInterests();
	});
}

/* Check if the interest exists in sheet */
function existsInSheet(response, interest) {
	var interests = response.result.values;
	var result = {
		exist: false,
		index: -1,
		count: 0
	};

	if (interests == null) {
		return result;
	} 
	else {
		for (var i = 0; i < interests.length; i++) {
			if (interests[i][0] === interest)	 {
				result.exist = true;
				result.index = i + 1;
				result.count = parseInt(interests[i][1]);
				return result;
			}
		}
		return result;
	}
}

/* Get the cell's next index */
function getNextCellIndex(response) {
	var values = response.result.values;
	if (values == null) {
		return 1;
	} else {
		return values.length + 1;
	}
}
