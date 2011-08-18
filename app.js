var express = require('express');
var app = express.createServer();
var rest = require('./rest.js');

rest.setOptions({
	clientId:"3MVG9yZ.WNe6byQDx8PTnyUjr2a4a.OdYg93iPmUozOXRFqA66C29hNnaZX737QieXbbiK.OIeeq2vPuFFWQN",
	redirectUri:"https://syds.herokuapp.com/token",
	version:"22.0",
	clientSecret: "947286122166300729",
	hostApp:app
	});
		
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
	//rest.resources(req, res, function(data){ console.log(data);});
	rest.query("Select Id, Name From Account", req, res, function(data) {
		for (var i=0;i<data.records.length; i++) {
			console.log(data.records[i].Name);
			res.write(data.records[i].Name + "\n");
		};
		res.write("dood");
		res.end();
	});
});

app.listen(process.env.PORT || 4000);
console.log("listening on port " + process.env.PORT || 4000);
