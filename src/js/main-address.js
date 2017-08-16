// Integrate with address searching
ContactDataServices.address = function(options){
	// Build our new instance from user custom options
	var instance = options || {};
			
	// Initialising some defaults
	instance.enabled = true;		
	instance.lastSearchTerm = "";
	instance.currentSearchTerm = "";
	instance.lastCountryCode = "";
	instance.currentCountryCode = "";
	instance.currentSearchUrl = "";
	instance.currentFormatUrl = "";	
	instance.placeholderText = instance.placeholderText || ContactDataServices.defaults.input.placeholderText;	
	instance.editAddressText = instance.editAddressText || ContactDataServices.defaults.editAddressText; 
	instance.searchAgainText = instance.searchAgainText || ContactDataServices.defaults.searchAgainText; 
	instance.formattedAddress = instance.formattedAddress || ContactDataServices.defaults.formattedAddress;
	instance.setInitialFocus = instance.setInitialFocus !== false;
	
	// Create a new object to hold the events from the event factory
	instance.events = new ContactDataServices.eventFactory();

	// Initialise this instance
	instance.init = function(){
		// Get token from the query string
		ContactDataServices.urls.getToken(instance);
		if(!instance.token){
			// Disable searching on this instance
			instance.enabled = false;
			// Display a banner informing the user that they need a token
			ContactDataServices.ua.banner.show("<a href='https://github.com/experiandataquality/contactdataservices#tokens'>Please provide a token for ContactDataServices.</a>");
			return;
		}

		instance.setCountryList();

		if(instance.elements.input){
			instance.input = instance.elements.input;
			// Bind an event listener on the input
			instance.input.addEventListener("keyup", instance.search);
			// Set a placeholder for the input
			instance.input.setAttribute("placeholder", instance.placeholderText);
			// Disable autocomplete on the form
			instance.input.parentNode.setAttribute("autocomplete", "off");
			// Disable form submission for demo purposes
			instance.input.parentNode.addEventListener('submit', function(event){
			    event.preventDefault();
			});
			// Apply focus to input
			if (instance.setInitialFocus){
				instance.input.focus();
			}
		}
	};
	// Main function to search for an address from an input string
	instance.search = function(event){
		// Handle keyboard navigation
		var e = event || window.event;
        e = e.which || e.keyCode;
        if (e === 38/*Up*/ || e === 40/*Down*/ || e === 13/*Enter*/) {
            instance.picklist.keyup(e);
            return;
        }

		instance.currentSearchTerm = instance.input.value;
		instance.currentCountryCode = instance.countryList.value;

		// Check is searching is permitted
		if(instance.canSearch()){
			// Abort any outstanding requests
			if(instance.request.currentRequest){
				instance.request.currentRequest.abort();
			}

			// Don't employ the typedown search if we're in Verification mode
			if(instance.verification.active){
				return;
			}

			// Fire an event before a search takes place
			instance.events.trigger("pre-search", instance.currentSearchTerm);

			// Construct the new Search URL
			var url = ContactDataServices.urls.construct.address.search(instance);
			
			// Store the last search term
			instance.lastSearchTerm = instance.currentSearchTerm;	

			// Hide any previous results
			instance.result.hide();
			
			// Hide the inline search spinner
			instance.searchSpinner.hide();

			// Show an inline spinner whilst searching
			instance.searchSpinner.show();

			// Initiate new Search request
			instance.request.get(url, instance.picklist.show);				
		} else if(instance.lastSearchTerm !== instance.currentSearchTerm){
			// Clear the picklist if the search term is cleared/empty
			instance.picklist.hide();
		}
	};

	instance.setCountryList = function(){
		instance.countryList = instance.elements.countryList;
		
		// If the user hasn't passed us a country list, then create new list?
		if(!instance.countryList){
			instance.createCountryDropdown();
		}
	};
	
	// Determine whether searching is currently permitted
	instance.canSearch = function(){
				// If searching on this instance is enabled, and
		return (instance.enabled && 
				// If search term is not empty, and
				instance.currentSearchTerm !== "" && 
				// If search term is not the same as previous search term, and
				instance.lastSearchTerm !== instance.currentSearchTerm &&
				// If the country is not empty
				instance.countryList.value !== "");
	};

	instance.createCountryDropdown = function(){
		// What countries?
		// Where to position it?
	};

	// Get a final (Formatted) address
	instance.format = function(url){
		// Trigger an event
		instance.events.trigger("pre-formatting-search", url);

		// Hide the searching spinner
		instance.searchSpinner.hide();

		// Construct the format URL
		instance.currentFormatUrl = url;		

		// Initiate a new Format request
		instance.request.get(instance.currentFormatUrl, instance.result.show);
	};

	instance.verification = {
		search: function(url){
			// Trigger an event
			instance.events.trigger("pre-verification-search", url);

			// Construct the format URL
			instance.currentFormatUrl = url;
			instance.request.get(instance.currentFormatUrl, instance.verification.result);
		},
		result: function(response){
			// Trigger an event
			instance.events.trigger("post-verification-search", response);

			if(response && response.verifylevel){
				var verifyLevel = response.verifylevel;

				switch(verifyLevel.toLowerCase()) {
					case "verified":
					case "interactionrequired":
						
						var inputData = {
							address: []
						};

						if(response.fields && response.fields.length > 0){
							// Construct a formatted address object							
							for(var i = 0; i < response.fields.length; i++){
								var key = "addressLine" + (i + 1);
								var lineObject = {};
								lineObject[key] = response.fields[i].content;
								inputData.address.push(lineObject);
							}							
						}
						
						instance.result.show(inputData);
						break;
					case "premisespartial":
					case "streetpartial":
					case "mulitple":
						//response.prompt
						// add prompt above input
						// change picklist options with results
						// on click do the same again, checking the status
						
						// Create an items object to give to the picklist
						if(response.results && response.results.length > 0){
							// Set the placeholder of the input to the prompt from the response
							instance.input.value = "";
							instance.input.placeholder = response.prompt;

							var items = { results: [] };
							for(var j = 0; j < response.results.length; j++){
								items.results.push({ suggestion: response.results[j].text });
							}
							instance.picklist.show(items);
							instance.input.focus();
						}						
						break;
				}
			}			
		}
	};	

	instance.picklist = {
		// Set initial size
		size: 0,
		// Set initial max size
		maxSize: 25,
		// Render a picklist of search results
		show: function(items){
			// Store the picklist items
			instance.picklist.items = items.results;

			// Update picklist size
			instance.picklist.size = instance.picklist.items.length;

			// Get/Create picklist container element
			instance.picklist.container = instance.picklist.container || instance.picklist.createList();

			// Ensure previous results are cleared
			instance.picklist.container.innerHTML = "";

			// Reset the picklist tab count (used for keyboard navigation)
			instance.picklist.resetTabCount();

			// Hide the inline search spinner
			instance.searchSpinner.hide();

			// Prepend an option for "use address entered"
			instance.picklist.useAddressEntered.element = instance.picklist.useAddressEntered.element || instance.picklist.useAddressEntered.create();
			
			if(instance.picklist.items.length > 0){	
				// Fire an event before picklist is created
				instance.events.trigger("pre-picklist-create", instance.picklist.items);

				// Iterate over and show results
				instance.picklist.items.forEach(function(item){
					// Create a new item/row in the picklist
					var listItem = instance.picklist.createListItem(item);
					instance.picklist.container.appendChild(listItem);

					// Listen for selection on this item
					instance.picklist.listen(listItem);
				});

				// Fire an event after picklist is created
				instance.events.trigger("post-picklist-create");
			}
		},
		// Remove the picklist
		hide: function(){
			// Clear the current picklist item
			instance.picklist.currentItem = null;
			// Remove the "use address entered" option too
			instance.picklist.useAddressEntered.destroy();
			// Remove the main picklist container
			if(instance.picklist.container){
				instance.input.parentNode.removeChild(instance.picklist.container);
				instance.picklist.container = undefined;
			}
		},
		useAddressEntered: {
			// Create a "use address entered" option
			create: function(){
				var item = {
					suggestion: ContactDataServices.defaults.useAddressEnteredText,
					format: ""
				};
				var listItem = instance.picklist.createListItem(item);
				listItem.classList.add("use-address-entered");				
				instance.picklist.container.parentNode.insertBefore(listItem, instance.picklist.container.nextSibling);
				listItem.addEventListener("click", instance.picklist.useAddressEntered.click);
				return listItem;
			},
			// Destroy the "use address entered" option
			destroy: function(){
				if(instance.picklist.useAddressEntered.element){
					instance.picklist.container.parentNode.removeChild(instance.picklist.useAddressEntered.element);
					instance.picklist.useAddressEntered.element = undefined;
				}
			},
			// Use the address entered as the Formatted address
			click: function(){
				var inputData = {
					address: []
				};

				// Use the current search term
				var inputAddress = instance.currentSearchTerm;
				// Unless we're in Verification mode and refining, then take the one they selected from the picklist
				if(instance.verification.active){
					inputAddress = instance.picklist.pickedAddress;
				}
				if(inputAddress){
					// Try and split into lines by using comma delimiter
					var lines = inputAddress.split(",");
					if(lines.length > 0){
						for(var i = 0; i < lines.length; i++){
							var key = "addressLine" + (i + 1);
							var lineObject = {};
							lineObject[key] = lines[i];
							inputData.address.push(lineObject);
						}

						// Pad with additional blank fields if needed
						var maxLines = 7;
						var additionalLinesNeeded = maxLines - lines.length;
						if(additionalLinesNeeded > 0){
							var counterStart = maxLines - additionalLinesNeeded;
							for(var j = counterStart; j < maxLines; j++){
								var key1 = "addressLine" + (j + 1);
								var lineObject1 = {};
								lineObject1[key1] = "";
								inputData.address.push(lineObject1);
							}
						}
					}
				}
				
				instance.result.show(inputData);
				instance.result.editAddressManually();
			}
		},
		// Create the picklist container and inject after the input
		createList: function(){
			var list = document.createElement("div");
			list.classList.add("address-picklist");
			// Insert the picklist after the input
			instance.input.parentNode.insertBefore(list, instance.input.nextSibling);

			list.addEventListener("keydown", instance.picklist.enter);				
			return list;
		},
		// Create a new picklist item/row
		createListItem: function(item){
			var row = document.createElement("div");
			row.innerHTML = instance.picklist.addMatchingEmphasis(item);
			// Store the Format URL
			row.setAttribute("format", item.format);
			return row;
		},
		// Tab count used for keyboard navigation
		tabCount: -1,
		resetTabCount: function () {
        	instance.picklist.tabCount = -1;
    	},
		// Keyboard navigation
		keyup: function(e){
			if(!instance.picklist.container){
            	return;
            }

            if (e === 13/*Enter*/) {
                instance.picklist.checkEnter();
                return;
            }

            // Get a list of all the addresses in the picklist
            var addresses = instance.picklist.container.querySelectorAll("div"),
            				firstAddress, lastAddress;

            // Set the tabCount based on previous and direction
            if (e === 38/*Up*/) {
                instance.picklist.tabCount--;
            }
            else {
                instance.picklist.tabCount++;
            }

            // Set top and bottom positions and enable wrap-around
            if (instance.picklist.tabCount < 0) {
                instance.picklist.tabCount = addresses.length - 1;
                lastAddress = true;
            }
            if (instance.picklist.tabCount > addresses.length - 1) {
                instance.picklist.tabCount = 0;
                firstAddress = true;
            }

            // Highlight the selected address
        	var currentlyHighlighted = addresses[instance.picklist.tabCount];
        	// Remove any previously highlighted ones
        	var previouslyHighlighted = instance.picklist.container.querySelector(".selected");
        	if(previouslyHighlighted){
        		previouslyHighlighted.classList.remove("selected");
        	}
        	currentlyHighlighted.classList.add("selected");
        	// Set the currentItem on the picklist to the currently highlighted address
			instance.picklist.currentItem = currentlyHighlighted;

        	// Scroll address into view, if required
            var addressListCoords = {
                top: instance.picklist.container.offsetTop,
                bottom: instance.picklist.container.offsetTop + instance.picklist.container.offsetHeight,
                scrollTop: instance.picklist.container.scrollTop,
                selectedTop: currentlyHighlighted.offsetTop,
                selectedBottom: currentlyHighlighted.offsetTop + currentlyHighlighted.offsetHeight,
                scrollAmount: currentlyHighlighted.offsetHeight
            };
            if (firstAddress) {
                instance.picklist.container.scrollTop = 0;
            }
            else if (lastAddress) {
                instance.picklist.container.scrollTop = 999;
            }
            else if (addressListCoords.selectedBottom + addressListCoords.scrollAmount > addressListCoords.bottom) {
                instance.picklist.container.scrollTop = addressListCoords.scrollTop + addressListCoords.scrollAmount;
            }
            else if (addressListCoords.selectedTop - addressListCoords.scrollAmount - addressListCoords.top < addressListCoords.scrollTop) {
                instance.picklist.container.scrollTop = addressListCoords.scrollTop - addressListCoords.scrollAmount;
            }
		},
		// Add emphasis to the picklist items highlighting the match
		addMatchingEmphasis: function(item){
			var highlights = item.matched || [],
            	label = item.suggestion;

            for (var i = 0; i < highlights.length; i++) {
                var replacement = '<b>' + label.substring(highlights[i][0], highlights[i][1]) + '</b>';
                label = label.substring(0, highlights[i][0]) + replacement + label.substring(highlights[i][1]);
            }

            return label;
		},
		// Listen to a picklist selection
		listen: function(row){
			row.addEventListener("click", instance.picklist.pick.bind(null, row));
		},
		checkEnter: function(){
			if(instance.picklist.currentItem){
				instance.picklist.pick(instance.picklist.currentItem);
			} else if(instance.verification.active){
				// Append the original result to the premise partial info
				var originalResult = instance.picklist.items[0].suggestion;
				instance.picklist.pick({ innerText: "Apt " + instance.currentSearchTerm + " " + originalResult });
			}
		},
		// How to handle a picklist selection				
		pick: function(item){
			// Fire an event when an address is picked
			instance.events.trigger("post-picklist-selection", item);
			
			// Store the address picked from the picklist
			instance.picklist.pickedAddress = item.innerText;

			// Direct any USA or CAN selections through the V1 verification search
			if(instance.currentCountryCode.toLowerCase() === "usa" || instance.currentCountryCode.toLowerCase() === "can"){
				// Construct the new verification Search URL
				var url = ContactDataServices.urls.construct.address.verification(instance, item.innerText);
				instance.verification.active = true;
				instance.verification.search(url);
			} else {
				// Get a final address using picklist item
				instance.format(item.getAttribute("format"));
			}
		}
	};

	instance.result = {
		// Render a Formatted address
		show: function(data){
			// Hide the inline search spinner
			instance.searchSpinner.hide();

			// Hide the picklist
			instance.picklist.hide();

			// Clear search input
			instance.input.value = "";
			
			if(data.address.length > 0){
				// Fire an event to say we've got the formatted address
				instance.events.trigger("post-formatting-search", data);

				// Get formatted address container element
				instance.result.formattedAddress = instance.elements.formattedAddress || instance.result.createFormattedAddressContainer();

				// Create an array to hold the hidden input fields
				var inputArray = [];

				// Loop over each formatted address line
				for(var i = 0; i < data.address.length; i++){
					var line = data.address[i];
					// The line object will only have one property, but we don't know the key
					for(var key in line){
						if(line.hasOwnProperty(key)) {
							// Create the address line row and add to the DOM
							var row = instance.result.createAddressLine.row(line[key]);
							instance.result.formattedAddress.appendChild(row);

							// Create a hidden input to store the address line as well
							inputArray.push(instance.result.createAddressLine.input(key, line[key]));
						}
					}
				}

				// Write the list of hidden address line inputs to the DOM in one go
				instance.result.renderInputList(inputArray);

				// Write the 'Edit address' link and insert into DOM
				instance.result.createEditAddressLink();

				// Write the 'Search again' link and insert into DOM
				instance.result.createSearchAgainLink();
			}
		},
		hide: function(){
			if(instance.result.formattedAddress){
				instance.input.parentNode.removeChild(instance.result.formattedAddress);
				instance.result.formattedAddress = undefined;
			}				
		},
		// Create the formatted address container and inject after the input
		createFormattedAddressContainer: function(){
			var container = document.createElement("div");
			container.classList.add("formatted-address");
			// Create a heading for the formatted address
			if(instance.formattedAddress.heading !== false){
				var heading = document.createElement(instance.formattedAddress.headingType);
				heading.innerHTML = instance.formattedAddress.headingText;
				container.appendChild(heading);
			}
			// Insert the container after the input
			instance.input.parentNode.insertBefore(container, instance.input.nextSibling);
			return container;
		},
		createAddressLine: {
			// Create a hidden input to store the address line
			input: function(key, value){
				// Create a wrapper (and hide it)
				var div  = document.createElement("div");
				div.classList.add("hidden");
				div.classList.add("address-line-input");

				// Create the label
				var label = document.createElement("label");
				label.innerHTML = key;
				div.appendChild(label);

				// Create the input
				var input = document.createElement("input");
				input.setAttribute("type", "text");
				input.setAttribute("name", key);
				input.setAttribute("value", value);
				div.appendChild(input);
				return div;
			},
			// Create a DOM element to contain the address line
			row: function(value){
				var row = document.createElement("div");
				row.classList.add("toggle");
				row.innerHTML = value;
				return row;
			}
		},
		// Create the 'Edit address' link that allows manual editing of address
		createEditAddressLink: function(){
			var link = document.createElement("a");
			link.setAttribute("href", "#");
			link.classList.add("edit-address-link");
			link.innerHTML = instance.editAddressText;
			// Insert into the formatted address container
			instance.result.formattedAddress.appendChild(link);
			// Bind event listener
			link.addEventListener("click", instance.result.editAddressManually);
		},
		// Create the 'Search again' link that resets the search
		createSearchAgainLink: function(){
			var link = document.createElement("a");
			link.setAttribute("href", "#");
			link.classList.add("search-again-link");
			link.innerHTML = instance.searchAgainText;
			// Insert into the formatted address container
			instance.result.formattedAddress.appendChild(link);
			// Bind event listener
			link.addEventListener("click", instance.reset);
		},
		editAddressManually: function(event){
			if(event){
				event.preventDefault();
			}

			// Remove 'edit address link'
			instance.result.formattedAddress.querySelector(".edit-address-link").classList.add("hidden");

			// Change the visible formatted address to hidden
			instance.toggleVisibility(instance.result.formattedAddress);

			// Change the hidden address line inputs to show to allow editing
			var addressLineInputs = instance.result.formattedAddress.querySelectorAll(".address-line-input");
			for (var j = 0; j < addressLineInputs.length; j++) {
					addressLineInputs[j].classList.remove("hidden");
			}
		},
		// Write the list of hidden address line inputs to the DOM
		renderInputList: function(inputArray){
			if(inputArray.length > 0){
				for(var i = 0; i < inputArray.length; i++){
					instance.result.formattedAddress.appendChild(inputArray[i]);
				}
			}
		}
	};

	// Toggle the visibility of elements
	instance.toggleVisibility = function(scope){			
		scope = scope || document;
		var elements = scope.querySelectorAll(".toggle");
		for (var i = 0; i < elements.length; i++) {
			if(elements[i].classList.contains("hidden")){
				elements[i].classList.remove("hidden");
			} else {
				elements[i].classList.add("hidden");
			}
		}
	};

	instance.searchSpinner = {
		show: function(){
			// Create the spinner container
		    var spinnerContainer = document.createElement("div");
		    spinnerContainer.classList.add("loader");
		    spinnerContainer.classList.add("loader-inline");

		    // Create the spinner
			var spinner = document.createElement("div");
			spinner.classList.add("spinner");
			spinnerContainer.appendChild(spinner);

			// Insert the spinner after the field
			instance.input.parentNode.insertBefore(spinnerContainer, instance.input.nextSibling);
		},

		hide: function(){
			var spinner = instance.input.parentNode.querySelector(".loader-inline");
			if(spinner){
				instance.input.parentNode.removeChild(spinner);
			}	
		}
	};

	// Reset the search
	instance.reset = function(event){
		if(event){
			event.preventDefault();
		}
		// Enable searching
		instance.enabled = true;
		// Switch back to typedown mode
		instance.verification.active = false;
		// Hide formatted address
		instance.result.hide();
		// Show search input
		instance.toggleVisibility(instance.input.parentNode);
		// Apply focus to input
		instance.input.focus();
		// Set a placeholder for the input
		instance.input.setAttribute("placeholder", instance.placeholderText);
		// Fire an event after a reset
		instance.events.trigger("post-reset");
	};

	// How to handle unauthorised (invalid token?) requests
	instance.unauthorised = function(){
		instance.enabled = false;

		// As searching is disabled, show button to render final address instead
		var button = document.createElement("button");
		button.innerText = "Submit";
		instance.input.parentNode.insertBefore(button, instance.input.nextSibling);
		button.addEventListener("click", function(){
			// Simulate a manual "use address entered" entry
			instance.picklist.useAddressEntered.click();
			// Remove the button
			instance.input.parentNode.removeChild(button);
		});
	};

	// Use this to initiate and track XMLHttpRequests
	instance.request = {
		currentRequest: null,
		get: function(url, callback){
			instance.request.currentRequest = new XMLHttpRequest();
			instance.request.currentRequest.open('GET', url, true);
			instance.request.currentRequest.timeout = 5000; // 5 seconds
			instance.request.currentRequest.setRequestHeader("Auth-Token", instance.token);

			instance.request.currentRequest.onload = function() {
			  if (instance.request.currentRequest.status >= 200 && instance.request.currentRequest.status < 400) {
			    // Success!
			    var data = JSON.parse(instance.request.currentRequest.responseText);
			    callback(data);
			  } else {
			    // We reached our target server, but it returned an error
				instance.searchSpinner.hide();

				// If the request is unauthorized (invalid token) we should probably disable future requests
				if(instance.request.currentRequest.status === 401){
					instance.unauthorised();
					// Display a banner informing the user that they need a valid token
					ContactDataServices.ua.banner.show("<a href='https://github.com/experiandataquality/contactdataservices#tokens'>Please provide a valid token for ContactDataServices.</a>");
				}
			  }
			};

			instance.request.currentRequest.onerror = function() {
			  // There was a connection error of some sort
			  // Hide the inline search spinner
				instance.searchSpinner.hide();
			};

			instance.request.currentRequest.ontimeout = function() {
			  // There was a connection timeout	
			  // Hide the inline search spinner
				instance.searchSpinner.hide();		  
			};

			instance.request.currentRequest.send();
		}		
	};	

	// Initialise this instance of ContactDataServices
	instance.init();

	// Return the instance object to the invoker
	return instance;
};	
