var http = require('http'),
    https = require('https');
var express = require("express"),
    app = express();
var MongoClient = require('mongodb').MongoClient,
    RedisStore = require('connect-redis')(express.session);
var fs = require('fs');

var routes = require('./routes/index.js');


global.whitelist = require('whitelist').whitelist;
global.db = null;

app.configure("development", function() {
  app.use(express.cookieParser());

  app.use(express.logger({'format': 'dev'}));
  app.use(express.session({
    cookie: {maxAge: 7 * 24 * 60 * 60 * 1000},
    secret: "keyboard cat",
  }));

  app.set('port', process.env.PORT || process.argv[2] || 5000);
});

app.configure("production", function() {
  app.use(express.cookieParser());

  app.use(express.logger({'stream': fs.createWriteStream('log.txt')}));
  app.use(express.session({
    cookie: {maxAge: 7 * 24 * 60 * 60 * 1000},
    secret: "keyboard cat",
    store: new RedisStore({ host: 'localhost', port: 6379})
  }));

  app.set('port', process.env.PORT || 80);
  app.set('sslPort', 443);
  app.use(requireHTTPS); 

});

app.configure(function() { 
  app.engine("html", require("ejs").renderFile);
  app.set('view engine', 'html');
  app.set('views', __dirname + '/views');
  
  app.use(express.bodyParser());
  
  app.use(app.router);
  app.use(express.static(__dirname + '/static'));
});

function requireHTTPS(req, res, next) {
  if (!req.secure) {
      //FYI this should work for local development as well
      return res.redirect('https://' + req.get('host') + req.url);
  }
  next();
}

// render the planner or the homepage depending on if you're logged in or not.
app.get('/', function(req, res) {
  if (req.session.username) // if logged in
    res.render("planner.html"); // render planner
  else {
    var agent = req.headers['user-agent'].toLowerCase();
    // if 'iphone', 'ipad', or 'android' can't be found in the user agent
    if (agent.indexOf('mobile') <= 0 || agent.indexOf('ipad') >= 0) // if 'mobile' isn't there or 'ipad' is there
      res.render("homepage.html");
    else
      res.render("signin.html", {"error": ""});
  }
});


app.get('/login', routes.login.get);
app.post('/login', routes.login.post);
app.get('/logout', function(req, res) { // remove cookie from client, redirect to homepage.
  req.session.username = undefined;
  res.redirect('/');
});

app.get('/planner', routes.planner.get);
app.post('/planner', routes.planner.post);

app.get('/settings', routes.settings.get);
app.post('/settings', routes.settings.post);

app.get('/reminders', routes.reminders.get);
app.post('/reminders', routes.reminders.post);

app.get('/feedback', function(req, res) {
  res.send('<center><a href="/">Back to Planner</a><br><iframe style="width:100%; height: 100%;" src="https://docs.google.com/forms/d/15stup9XejMQ0nAFdn-Ucbumv6s6KN92tssBrlAj3A3c/viewform?embedded=true" width="760" height="500" frameborder="0" marginheight="0" marginwidth="0">Loading...</iframe>');
})

MongoClient.connect('mongodb://localhost/planner', function(err, dbase) {
  if (!err) {
    db = dbase;

    var insecure = http.createServer(app)

    insecure.listen(app.get('port'), function() {
      console.info('Listening on port %d', app.get('port'));
    });
    if (app.get('sslPort')) {
      var secure = https.createServer({
        cert: fs.readFileSync('/home/ubuntu/sslcert/server.crt', 'utf8'), 
        key: fs.readFileSync('/home/ubuntu/sslcert/server.key', 'utf8'),
        ca: [
          fs.readFileSync('/home/ubuntu/sslcert/intermediate.pem', 'utf8'),
          fs.readFileSync('/home/ubuntu/sslcert/root.pem', 'utf8')
        ]
      }, app)
      secure.listen(app.get('sslPort'), function() {
        console.info('HTTPS listening on port %d', app.get('sslPort'));
      });
    }

    /* var emailLoop = setInterval(function() {
      db.collection('reminders').find({query: {
        dueDate: {$gte: new Date(req.param('today'))},
        startReminding: {$lt: new Date(req.param('today'))
      }, 
      $orderby: {'name': 1}
     }, 1000*60*30);*/

  } else {
    console.error(err);
  }
});
