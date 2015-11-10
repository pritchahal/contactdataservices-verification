// Generate the URLs for the various requests
ContactDataServices.urls = {
	endpoint: "http://int-test-01/capture/address/v2/search",
	endpointV1: "http://int-test-01/capture/v1/verify-address/text",
	construct: {
		address: {
			// Construct the Search URL by appending query, country & take
			search: function(instance, endpoint, searchTerm){
				var url = endpoint || ContactDataServices.urls.endpoint;
				url += "?query=" + (searchTerm || instance.currentSearchTerm);
				url += "&country=" + instance.currentCountryCode;
				url += "&take=" + (instance.maxSize || instance.picklist.maxSize);

				return url;
			},
			// Construct a search URL for the verification step (basically using the V1 endpoint)
			verification: function(instance, searchTerm){
				return ContactDataServices.urls.construct.address.search(instance, ContactDataServices.urls.endpointV1, searchTerm);
			}
		}
	},
	// Get token from query string and set on instance
	getToken: function(instance){
		instance.token = ContactDataServices.urls.getParameter("token");
	},
	getParameter: function(name) {
	    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
	        results = regex.exec(location.search);
	    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
	}
};
