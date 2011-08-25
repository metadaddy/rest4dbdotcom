var express = require('express');
var rest = require('./rest.js');
var oauth = require('./oauth.js');
var url = require('url');

var port = process.env.PORT || 4000;

var cid = process.env.CLIENT_ID || "";
var csecr = process.env.CLIENT_SECRET || "";
var lserv = process.env.LOGIN_SERVER || "https://login.salesforce.com";
var redir = process.env.REDIRECT_URI || "http://localhost:" + port + "/token";

var app = express.createServer(
    express.cookieParser(),
    express.session({ secret: csecr }),
    express.query(),
    oauth.oauth({
        clientId: cid,
        clientSecret: csecr,
        loginServer: lserv,
        redirectUri: redir
    })
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
			res.render("accounts", { accounts:data.records } );
	});
});

app.get('/detail', function(req, res) {
	var id = (req.params.id ? req.params.id : url.parse(req.url, true).query.id);
	rest.api(req).retrieve('Account', id, null, function(data) {
		res.render('detail', { account:data });
	});
});

app.get('/edit', function(req, res) {
	var id = url.parse(req.url, true).query.id;
	rest.api(req).retrieve('Account', id, null, function(data) {
		res.render('edit', { account:data });
	});
});

app.post('/save', function(req, res) {
	rest.api(req).update("Account", req.body.id, { Name:req.body.name, BillingStreet:req.body.street, BillingCity:req.body.city, BillingState:req.body.state },
		function(data) {
			res.redirect('/detail?id=' + req.body.id);
			res.end();
		});
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
