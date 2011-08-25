var express = require('express');
var rest = require('./rest.js');
var oauth = require('./oauth.js');
var app = express.createServer(
    express.cookieParser(),
    express.session({ secret: process.env.CLIENT_SECRET }),
    express.query(),
    oauth.oauth({
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        loginServer: process.env.LOGIN_SERVER,
        redirectUri: process.env.REDIRECT_URI
    })
);

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.configure(function(){
	app.use(express.logger());
	app.use(express.static(__dirname + '/static'));
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.get('/', function(req, res) {
	res.render('index');
});

app.get('/accounts', function(req, res) {
	rest.api(req).query("Select Id, Name From Account", function(data) {
		for (var i=0;i<data.records.length; i++) {
			console.log(data.records[i].Name);
			res.write(data.records[i].Name + "\n");
		};
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
