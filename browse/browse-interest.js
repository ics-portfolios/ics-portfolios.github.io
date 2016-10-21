var keywordsSynonymList = [
	["software", "engineer", "dev", "program"],
	["web", "design", "UI", "dev", "IT"],
	["security", "defense", "greyhat"],
	["ai", "artificial", "intelligence"],
	["mobile", "app", "dev"]
];

function browse() {
	var text = $("#searchBox").val().toLowerCase();
	var synonyms = querySynonyms(text);
	//console.log("searching for " + text + " in " + synonyms);
	$(".interests").each(function() {
		var interests = $(this).text().toLowerCase();
		var match = false;

		for (var i = 0; i < synonyms.length; i++) {
			if (interests.includes(synonyms[i])) {
				match = true;
				break;
			}
		}

		if (!match) {
			getCard($(this)).css("display", "none");
		} else {
			getCard($(this)).css("display", "flex");
		}
	});
}

function querySynonyms(keyword) {
	for (var i = 0; i < keywordsSynonymList.length; i++) {
		if (containsInList(keyword, keywordsSynonymList[i])) {
			return keywordsSynonymList[i];
		}
	}
	return [keyword];
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