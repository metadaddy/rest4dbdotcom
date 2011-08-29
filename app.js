var express = require('express');
var rest = require('./rest.js');
var oauth = require('./oauth.js');
var url = require('url');

var port = process.env.PORT || 4000;

var cid = process.env.CLIENT_ID || "3MVG9yZ.WNe6byQDx8PTnyUjr2WlyNlUMd1KUjo_rgVJUsxE4caF.iyHex5XZCj1kkO_2pHJx6kNW.B4lvyQj";
var csecr = process.env.CLIENT_SECRET || "7362529764017494785";
var lserv = process.env.LOGIN_SERVER || "https://login.salesforce.com";
var redir = process.env.REDIRECT_URI || "http://localhost:" + port + "/token";

// Middleware to call identity service and attach result to session
function idcheck() {
	return function(req, res, next) {
		// Invoke identity service if we haven't got one or access token has 
		// changed since we got it
    if (!req.session || !req.session.identity || req.session.identity_check != req.oauth.access_token) {
			rest.api(req).identity(function(data) {
				console.log(data);
				req.session.identity = data;
				req.session.identity_check = req.oauth.access_token;
				next();
			});					
		} else {
			next();			
		}
	}
}

var app = express.createServer(
    express.cookieParser(),
    express.session({ secret: csecr }),
    express.query(),
    oauth.oauth({
        clientId: cid,
        clientSecret: csecr,
        loginServer: lserv,
        redirectUri: redir,
    }),
		idcheck()
);

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.configure(function(){
	app.use(express.logger());
	app.use(express.static(__dirname + '/static'));
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
	app.use(express.bodyParser());
});

app.get('/', function(req, res) {
	res.render('index');
});


app.get('/accounts', function(req, res) {
	rest.api(req).query("Select Id, Name From Account", function(data) {
		res.render("accounts", { accounts:data.records, user:req.session.identity } );
	});
/*	var options = {
	    oauth: oauth,
		refresh: refresh,
		path: '/v' + apiVersion + '/chatter/feeds/user-profile/' + id + '/feed-items',
		callback: callback,
		error: error,
	}
	rest.request(options)*/
});

app.get('/detail', function(req, res) {
	var id = (req.params.id ? req.params.id : url.parse(req.url, true).query.id);
	rest.api(req).retrieve('Account', id, null, function(data) {
		res.render('detail', { account:data });
	});
});

app.get('/edit', function(req, res) {
	var id = url.parse(req.url, true).query.id;
	if (id) {
		rest.api(req).retrieve('Account', id, null, function(data) {
			res.render('edit', { account:data });
		});
	} else {
		res.render('edit', {account:{}})
	}
});

app.post('/save', function(req, res) {
	console.log('Save for id: ' + req.body.id);
	if (req.body.id != 'undefined') {
		rest.api(req).update("Account", req.body.id, { Name:req.body.name, BillingStreet:req.body.street, BillingCity:req.body.city, BillingState:req.body.state },
			function(data) {
				res.redirect('/detail?id=' + req.body.id);
				res.end();
			});
	} else {
		rest.api(req).create("Account", { Name:req.body.name, BillingStreet:req.body.street, BillingCity:req.body.city, BillingState:req.body.state },
		function(data) {
			if (data.success == true) {
				res.redirect('/detail?id=' + data.id);
				res.end();
			}
		});
	}
});

app.get('/test', function(req, res) {
    // More efficient to get the API object once if we're doing many 
    // interactions
    var api = rest.api(req);
	var id;
	res.write('creating account\n\n');
	api.create('account', {'name':'xxtestxx'}, function(data){
		console.log(data);
		res.write('success: '+JSON.stringify(data)+'\n\n');
		id = data.id;
		// Test refresh by stomping on the access token
		req.oauth.access_token = 'deadbeef';
    	res.write('retrieving account\n\n');
    	api.retrieve('account', id, ['name'], function(data){
    		console.log(data);
    		res.write('success: '+JSON.stringify(data)+'\n\n');
        	res.write('deleting account\n\n');
        	api.del('account', id, function(data){
        		console.log(data);
        		res.write('success: '+JSON.stringify(data)+'\n\n');
        		res.end();	    
        	}, function(data, response){
        		console.log(data);
        		res.write('error: '+JSON.stringify(data)+'\n\n');
        		res.end();	    
        	});		
    	}, function(data, response){
    		console.log(data);
    		res.write('error: '+JSON.stringify(data)+'\n\n');
    		res.end();	    
    	});		
	}, function(data, response){
		console.log(data);
		res.write('error: '+JSON.stringify(data)+'\n\n');
		res.end();	    
	});
});

var port = process.env.PORT || 4000;

app.listen(port);
console.log("listening on port " + port);
