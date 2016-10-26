var keywordsSynonymList = [
	["software", "engineer", "program"],
	["web", "design", "ui", "experience", "ux"],
	["security", "defense", "greyhat"],
	["ai", "artificial", "intelligence"],
	["mobile", "app", "android", "ios"],
	["concurren", "performance", "optim"],
	["start", "business", "entrepreneur"]
];

// register enter key
$("#searchBox").keyup(function(event){
    if(event.keyCode == 13){  
        browse();
    }
});

function browse() {
	var text = $("#searchBox").val().toLowerCase();
	var synonyms = querySynonyms(text);
	//console.log("searching for " + text + " in " + synonyms);
	var or = !$("#slider").checkbox('is checked');

	$(".interests").each(function() {
		var interests = $(this).text().toLowerCase();
		var match = false;
		var matchingCount = 0;

		for (var i = 0; i < synonyms.length; i++) {
			for (var j = 0; j < synonyms[i].length; j++) {
				if (interests.includes(synonyms[i][j])) {
					match = true;
					matchingCount ++;
					break;
				} 
			}
			if (or && match) {
				break;
			}
		}

		if (!or && matchingCount < synonyms.length) {
			match = false;
		}

		if (!match) {
			getCard($(this)).css("display", "none");
		} else {
			getCard($(this)).css("display", "flex");
		}
	});
}

function querySynonyms(keyword) {
	var keywordList = keyword.split(" ");
	//console.log(keywordList);
	var synonyms = [];

	for (var i = 0; i < keywordList.length; i++) {
		var match = false;
		for (var j = 0; j < keywordsSynonymList.length; j++) {
			if (containsInList(keywordList[i], keywordsSynonymList[j])) {
				synonyms.push(keywordsSynonymList[j]);
				match = true;
				break;
			}
		}
		if (!match) {
			synonyms.push([keywordList[i]]);
		}
	}

	//console.log(synonyms);
	return synonyms;
}

function containsInList(keyword, wordList) {
	//console.log("Checking " + keyword + " in " + wordList);
	for (var i = 0; i < wordList.length; i++) {
		if (keyword.includes(wordList[i])) {
			return true;
		}
	}
	return false;
}

function getCard(interestSection) {
	return interestSection.parent().parent();
}