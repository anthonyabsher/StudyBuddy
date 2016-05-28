var express           		= require ('express'),
	app    			 		= express(),
	bodyParser              = require('body-parser'),
	mongoose                = require('mongoose'),
	url 					= require('url'),
	cookieParser			= require('cookie-parser'),
	http 					= require("http"),
	uriUtil					= require("mongodb-uri"),
	util 					= require('util'),
	morgan 					= require('morgan'),
	methodOverride 			= require('method-override'),
	session 				= require('express-session'),
	MongoStore 				= require('connect-mongo')(session),
	crypto 					= require('crypto');

//global variables to access the schema models
var Sets;
var Cards;

/*const hmac = crypto.createHmac('sha256', 'a secret');
console.log("hash is"+ hmac);*/

//initializing mongoose connection to the MongoDB database
//route to database held in 'db.config'

//put config url behind file to hide passwords and username
var mongoDBConnection = require('./db.config');
mongoose.connect(mongoDBConnection.uri);
console.log(mongoDBConnection.uri);

var mongooseUri = uriUtil.formatMongoose(mongoDBConnection.uri);
console.log("mongooseDB URI:" + mongooseUri);

var idGen = 5;

app.set('port', process.env.PORT || 8080); //3000);
app.use(morgan('combined'));
//app.use(bodyParser());
app.use(bodyParser.urlencoded({extend: false}));
app.use(bodyParser.json());
app.use(methodOverride());

//app.use('/js', express.static('./client/js/controllers'));
//app.use('/images', express.static('./images'));

// create application/json parser
var jsonParser = bodyParser.json();
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

var options = { server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } } }; 
mongoose.createConnection(mongooseUri, options);

app.use(session({ 
		secret: 'keyboard cat',
		store: new MongoStore({ 
			mongooseConnection: mongoose.connection,
			collection: 'sessions'
		})
}));

console.log('Sending connecting request with Mongo db');
mongoose.connection.on('error', function() {
	console.log("problems connecting to the MongoDB server");
});

mongoose.connection.on('open', function(){
	console.log("After connecting to Mongo");

	var Schema = mongoose.Schema;

	var AccountSchema = new Schema({
		email: String,
		firstName: String,
		lastName: String,
		//password: String,
		username: String,
		dob: String,
		hashed_pwd: String
	},
	{collection: 'accounts'}
	);	
	Accounts = mongoose.model('Accounts', AccountSchema);

	var CardSetSchema = new Schema({
		setIdNum: String,
		Name : String,
		Category: String,
		numCards : Number,
		Author: String,
		DateCreated: Date,
		email: String
	},
	{collection: 'sets'}
	);
	Sets = mongoose.model('Sets', CardSetSchema);
	
	var CardListSchema = new Schema({
		setIdNum: String,
		Author: String,
		cards : [{
			cardId: Number,
			front : String,
			back : String
		}]
	},
	{collection: 'cards'}
	);
	Cards = mongoose.model('Cards', CardListSchema);
	
	console.log('Models Created!');
});

function displayDBError(err){
	if (err) { 
		console.log("error 1: " + err);
		for (p in err) {
			console.log(p + ":" + err[p]);
		}
	}
	else {
		console.log("no errors querying the db");
	}
}


function retrieveUserIdWithPwd(req, res, query) {
	console.log("calling retrieve user Id");
	var query = Accounts.findOne(query);
	query.exec(function (err, user) {
		if (!user) {
			req.session.user = undefined;
			res.sendStatus(404);
			return;
		}
		else {
			//req.session.regenerate(function(){
				var pwd = req.query.password;
				console.log("pwd is: "+ pwd);

				var hashedPwd = crypto.createHash('sha256').update(pwd).digest('base64').toString();
				
				if (hashedPwd == user.hashed_pwd) {
				req.session.user = user.id.valueOf();
				req.session.username = user.username;
				req.session.email = user.email;
				console.log('user information is correct');
			}
			else {
				console.log('incorrect password');
			}
			
		}
		if (err) {
			console.log("errors accessing users");
		}
		else {
			console.log("----------->user info:" + user);
			res.sendStatus(200);
			//res.json(req.session.user);
		}
	});	
}


console.log("before defining app static route");
app.use(express.static('./'));


app.get('/checklogin/:username', function(req, res) {
	console.log("making a login request to server");
	console.log(req);
	var id = req.params.username;

	retrieveUserIdWithPwd(req, res, {username: id});

}); 

app.get('/homeSets', function(req, res){
	
	Sets.find({}, function(err, found){
		if(err)
			res.send(err);
		else
			res.json(found);
	});
});

app.get('/relatedSets/:category', function(req, res) {

	var searchrequest = req.params.category;
	
	Sets.find({Category: searchrequest}, function(err, found){
		if(err)
			res.send(err);
		else
			res.json(found);
	});
});

app.get('/setDet/:setIdNum', function(req, res) {

	var searchrequest = req.params.setIdNum;

	Sets.find({setIdNum: searchrequest}, function(err, found) {
		if(err)
			res.send(err);
		else
			res.json(found);
	});
});

app.get('/card/:setIdNum', function(req, res) {

	var searchrequest = req.params.setIdNum;
	//console.log(searchrequest);
	Cards.find({setIdNum: searchrequest}, function(err, found) {
		// if there is an error retrieving, send the error. nothing after res.send(err) will execute
		if (err)
			res.send(err);
		else
		//console.log(res.json);
		res.json(found); // return all cards in JSON format
	});
});	         

app.post('/signup', function(req, res) {

	var jsonObj= req.body;
	console.log(jsonObj);

	Accounts.create(jsonObj, function(err, found){
		if (err)
     		res.send(err)
     	else
        //console.log(res.json);
       // res.json(found); // return all accounts in JSON format
        console.log("Res is"+res.json(found));
	}); 
});                 


app.get('/getUserFlashcardsets/:email', function(req, res) {
 
    var email = req.params.email;
    //var password = req.params.pswd;
 
    Sets.find({useremail: email}, function(err, found) {
			// if there is an error retrieving, send the error. nothing after res.send(err) will execute
        if (err)
            res.send(err)
            else
            res.json(found); // return all accounts in JSON format
        });
    }); 

app.post('/createSet', function(req, res){
	var jsonObj = req.body;
	jsonObj.setIdNum = idGen;
	console.log(jsonObj);
	Sets.create({jsonObj}, function(err){
		if(err)
			res.send(err)
	});
	res.send(jsonObj);
	idGen++;
});

app.delete('userSets/delete/:setId', function(req,res){
	Sets.findOneAndRemove({setIdNum: req.params.setId}, 
		function(err,set){
			if (err){
				res.send(err);
			}
			else{
				console.log("set deleted!");
				res.send(set);
			}

		});
});


/*app.listen(3000, function() {
	console.log('Server listening on port 3000...');
})*/
http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});	
console.log("after callintg http: createServer");