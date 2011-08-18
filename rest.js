var http = require('https');
var url = require('url');
var app;

var clientId, clientSecret, redirectUri = "https://login.salesforce.com/services/oauth2/success";
var authenticated = false;
var loginUrl = "https://login.salesforce.com";
var refreshToken, accessToken, apiVersion = "22.0";
var instanceUrl, id, issuedAt, signature = null;

exports.setOptions = function setOptions(options) {
	open(options.clientId, options.redirectUri, options.version, options.clientSecret, options.hostApp);
};

var open = function(cid, redirUri, version, csecret, hostApp) {
	clientId = cid;
	clientSecret = csecret;
	if (redirUri) redirectUri = redirUri;
	if (version) apiVersion = version;
	hostApp.get('/token', handleToken);
};

function handleToken(req, clientResponse) {
	if (url.parse(req.url, true).query.code) {
		var code = url.parse(req.url, true).query.code;
		var state = url.parse(req.url, true).query.state;
		
		// Got authorization token, use it to get the access token
		var post_data = 'code='+code+'&grant_type=authorization_code&client_id='+clientId+'&redirect_uri='+escape(redirectUri)+'&client_secret='+clientSecret;
		var options = {
			host: "login.salesforce.com",
			path: '/services/oauth2/token',
			method: 'POST',
			headers: {
				'host': "login.salesforce.com",
				'Content-Length': post_data.length,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept':'application/jsonrequest',
				'Cache-Control':'no-cache,no-store,must-revalidate'
			}
		};
		authenticated = true;
		
		var xhr = http.request(options, function(res) {
			var responseData;
			
			res.on('data', function(data) {
				setOAuthData(JSON.parse(data));
				responseData = data;
			});

			res.on('end', function(d) {
			  	redirectUser(clientResponse, responseData, state);
			});

		}).on('error', function(e) {
			  console.error(e);
		});

		xhr.write(post_data);
		xhr.end();
		
	}
};

function redirectUser(res, oauthResponse, state) {
   	res.setHeader('Set-Cookie', 
			[ 
			'refresh_token=' + escape(refreshToken),
			'access_token=' + escape(accessToken),
   	    	'instance_url=' + instanceUrl,
			'id=' + id,
			'issued_at=' + issuedAt,
			'signature=' + signature
			]
	); 
   	res.writeHead(301, {'Location' : state, 'Cache-Control':'no-cache,no-store,must-revalidate'});
  	res.end();
}	

function haveAuthenticated(req, res, callback) {
	// Look for oauth data in cookies
	var cookies = {};
	req.headers.cookie && req.headers.cookie.split(';').forEach(function( cookie ) {
		var parts = cookie.split('=');
		if (parts[0].trim().substring(0, 3) == "dfc") {
			cookies[ parts[ 0 ].trim() ] = unescape(( parts[ 1 ] || '' ).trim());
		}
	});

	if (!cookies.hasOwnProperty("access_token")) {
		accessToken = null;
		odataString = null;
	    var oauthURL = loginUrl + "/services/oauth2/authorize?response_type=code&" +
	        "client_id=" + clientId + "&redirect_uri=" + redirectUri + "&display=touch&state=/accounts";
		res.redirect(oauthURL);  // Redirect to salesforce.com
		res.end();
	} else {
		setOAuthData(cookies);
		authenticated = true;
		callback(req, res);
	}
};

function setOAuthData(oauthdata) {
	accessToken = oauthdata["access_token"];
	refreshToken = oauthdata["refresh_token"];
	instanceUrl = oauthdata["instance_url"];
	id = oauthdata["id"];
	issuedAt = oauthdata["issued_at"];
	signature = oauthdata["signature"];
};

/*refreshAccessToken:function(callback, error) {
	Ti.API.debug("Got to the refreshAccessToken function...");
   	var xhr = Titanium.Network.createHTTPClient();
   	
	xhr.onload = function() {
		Ti.API.debug(xhr.responseData);
		var jsonResponse = JSON.parse(xhr.responseData);
		jsonResponse["refresh_token"] = fa.refreshToken;
		fa.setOAuthData(jsonResponse);
		callback(xhr.responseData);
	};
	
	xhr.onerror = function(e) { 
		Ti.API.info("ERROR " + e.error); 
		alert(e.error); 
	 }; 
	 	
	var turl = "http://www.postbin.org/zu59sx";
    var url = fa.loginUrl + '/services/oauth2/token';
	
	Ti.API.debug("Refresh token url: " + url);
	
	xhr.open("POST", url);
	xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	
	Ti.API.debug("Grant: " + 'grant_type=refresh_token&client_id=' + fa.clientId + '&refresh_token=' + fa.refreshToken + "\n\nURL: " + url);
	
	xhr.send( 'grant_type=refresh_token&client_id=' + fa.clientId + '&refresh_token=' + fa.refreshToken );
};
*/
function makeRestCall(options) {
	var path = options.path, callback = options.callback, error = options.errorCallback;
	var method = options.method, oReq = options.origReq, oRes = options.origRes;
	var payload = options.payload, retry = options.retry;	
	
	if (authenticated === true) {
		var restUrl = instanceUrl + '/services/data' + path;
		console.log("\n\nmakeRestCall.restUrl: " + restUrl);
		
		var options = {
			host: url.parse(instanceUrl).host,
			path: '/services/data' + path,
			method: method,
			headers:  {
				'host': url.parse(instanceUrl).host,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept':'application/json',
				'Cache-Control':'no-cache,no-store,must-revalidate',
				'Authorization':'OAuth ' + accessToken
			}
		};


		var xhrReq = http.request(options, function(xhr) {
			var restData = "";
			
			if (xhr.statusCode != 200) {
				if (!refreshToken || retry) {
					// This is an error, we have retried and still don't have a token
				} else {
					if (xhr.statusCode == 401) {
						// Token is not valid, need to grab a token via refresh and then
						// retry the call
						refreshAccessToken(function(oauthResponse) {
							options.retry = true;
							makeRestCall(options);
						}, error);
					} else {
						// Not a 401, but not a success either
						// Need to bubble the error up
						console.log("\n\nXHR ERROR: " + xhr.statusCode);
					}
				} 
			}

			xhr.on('data', function(d) {
				restData += d;
			});
		
			xhr.on('end', function(restResponse) {  
				console.log("REST Response: " + restData);
				if (restData.length == 0) {
					callback("");
				} else {
					var data = JSON.parse(restData);
				}
				callback(data);
			});
			
			xhr.on('error',function(e) { 
				console.log("XHR, error handler..." + 
					"\nDbDotCom.REST.OAuth.refreshToken: " + refreshToken + 
					"\nretry: " + retry +
					"\n e: " + e.toString() +
					"\nXHR status: " + xhr.status);
			});
		});
		
		console.log("Rest url: " + restUrl);
	
		if (payload) {
			xhrReq.write(payload);
		}
		xhrReq.end();
	} else {
		// Got to go get tokens
		haveAuthenticated(oReq, oRes, function(){
			makeRestCall(options);
		});
	}
};

exports.query = function query(soql, req, res, callback, error) {
	var options = {
		path:'/v' + apiVersion + '/query/?q=' + escape(soql),
		callback:callback,
		errorCallback:error,
		method:"GET",
		origReq:req,
		origRes:res
	}
	makeRestCall(options);
};

/*
setRefreshToken : function(refreshToken) {
    fa.refreshToken = refreshToken;
};

refreshAccessToken : function(callback, error) {
	fa.refreshAccessToken(callback, error);
};
*/
// Need to verify this one as far as options are concerned
//versions : function(callback, error) {
//	makeRestCall('.json', callback, error);
//};

exports.resources = function resources(req, res, callback, error) {
	var options = {
		path:'/v' + apiVersion + '/',
		callback:callback,
		errorCallback:error,
		method:"GET",
		origReq:req,
		origRes:res
	}
	makeRestCall(options);
};
/*	,
    describeGlobal : function(callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/', callback, error);
    }
	,
    metadata : function(objtype, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype + '/'
        , callback, error);
    }
	,
    describe : function(objtype, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype
        + '/describe/', callback, error);
    }
	,
    create : function(objtype, fields, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype
        , callback, error, "POST", JSON.stringify(fields));
    }
	,
    retrieve : function(objtype, id, fieldlist, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype + '/' + id
        + '?fields=' + fieldlist, callback, error);
    }
	,
    update : function(objtype, id, fields, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype + '/' + id
        , callback, error, "PATCH", JSON.stringify(fields));
    }
	,
    del : function(objtype, id, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype + '/' + id
        , callback, error, "DELETE");
    }
	,
    search : function(sosl, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/search/?q=' + escape(sosl)
        , callback, error);
    }
    ,
    recordFeed : function(recordId, callback, error) {
    	fa.makeRestCall('/v' + fa.apiVersion + '/chatter/feeds/record/' + recordId + '/feed-items', 
    		callback, error);
    }
	,
    newsFeed : function(recordId, callback, error) {
    	fa.makeRestCall('/v' + fa.apiVersion + '/chatter/feeds/news/' + recordId + '/feed-items', 
    		callback, error);
    }
	,
    profileFeed : function(recordId, callback, error) {
    	fa.makeRestCall('/v' + fa.apiVersion + '/chatter/feeds/user-profile/' + recordId + '/feed-items', 
    		callback, error);
    }
};

exports.ForceOAuth = fa;
*/











