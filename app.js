var express = require("express"),
    app = express(),
    MongoClient = require('mongodb').MongoClient;
var http = require('http'),
    fs = require('fs');
var db = null;

app.configure("development", function() {
  app.use(express.logger({'format': 'dev'}));
});

app.configure("production", function() {
  app.use(express.logger({'stream': fs.createWriteStream('log.txt')}));
});

app.configure(function() {  
  app.engine("html", require("ejs").renderFile);
  app.set('view engine', 'html');
  app.set('views', __dirname + '/views');
  app.set('port', (process.env.PORT || process.argv[2] || 5000));
  
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  
  app.use(express.session({ secret: 'keyboard cat' }));
  
  app.use(app.router);
  app.use(express.static(__dirname + '/static'));

});

app.get('/', function(req, res) {
  res.render("index.html");
});

// get this week's assignments, with req.session.username, req.body.monday.
// return 404 if it doesn't exist, and let the client deal with it.
/* Functional */
app.get('/planner', function(req, res) {
  res.type('text/json');
  db.collection("assignments").find({$and: [{'name': req.session.username}, {'monday': req.param('monday')}]}).toArray(function(err, docs) {
    if (docs[0])
      res.send({'assignments': docs[0].data});
    else
      res.send(404);
  });

});

// update this week's assignments, with req.session.username, req.body.monday and req.body.data
/* Functional */
app.post('/planner', function(req, res) {
  res.type('text/json');
  var assignments = db.collection("assignments").find(
  {
    $and: 
    [
      {'name': req.session.username},
      {'monday': req.body.monday}
    ]
  }).toArray(function(err, docs) {
    if (!err) {
      if (docs[0]) { // doc exists
        db.collection("assignments").findOneAndUpdate({_id: docs[0]._id}, {
          $set: {'data': req.body.data}
        }, function (err, result) {
          if (!err)
            res.send(200);
          else
            res.send(500, err);
        });
      } else {
        db.collection("assignments").insert({
          'name': req.session.username, 'monday': req.body.monday, 'data': req.body.data}, 
        function(err, result) {
          if (!err)
            res.send(200);
          else
            res.send(500, err);
        });
      }
    } else {
      res.send(500, err);
    }
  });
});

// get req.session.username's settings and return it in JSON.
/* Functional */
app.get('/settings', function(req, res) {
  res.type('text/json');
  db.collection("users").find({'name': req.session.username}).toArray(function (err, docs) {
    if (!err) {
      if (docs[0])  {
        res.send({'settings': docs[0].settings});
      }
      else
        res.send(403)
    } else {
      res.send(500, err);
    }
  });
});

// update req.session.username's settings with req.body.settings.
/* Functional */
app.post('/settings', function(req, res) {
  res.type('text/json');
  console.log(req.body.data)
  db.collection("users").findOneAndUpdate(
    {'name': req.session.username}, 
    {$set: {'settings': req.body.settings}}, 
    function(err, result) {
      if (!err) {
        res.send({'settings': result.value.settings});
      } else {
        res.send(500);
      }
    }
  );
})

app.post('/signup', signup);

app.post('/login', login);

app.get('/logout', function(req, res) {
  req.session.username = undefined;
  res.redirect('/');
});

app.get('/session', function(req, res) {
  res.send({
    "username": req.session.username,
  });
});

function login(req, res) {
  res.type('text/json');
  var options = {host: 'compsci.dalton.org',port: 8080, path: '/zbuttenwieser/validation/index.jsp?username='+req.body.username+'&password='+req.body.password};
  http.get(options, function(r) {
    switch (r.statusCode) {
      case 200: // user exists in Dalton db
        // check if they exist in our db:
        db.collection("users").find({'name': req.body.username}).toArray(function(err, docs) {
          if (!err) {
            if (docs[0]) {
              req.session.username = req.body.username;
              res.send({'settings': docs[0].settings, 'user': req.body.username}); // send back that login went swimmingly
            } else {
              signup(req, res);
            }
          } else {
            res.send(500, err);
          }
        });
        break;
      case 404: // not found in Dalton
        res.send(403, {'message': 'The username and password entered do not match.'});
        break;
    }
  }).on('error', function(e) {
    res.end(500);
  });
}

function signup(req, res) {
  res.type('text/json');
  db.collection("users").find({'name': req.body.username}).toArray(function(err, docs) {
    if (!err) {
      if (docs[0] == undefined) {
        var user = { // create the user schema
        name: req.body.username,
        settings: {
                    'rows': [
                              "English", 
                              "History", 
                              "Math", 
                              "Science", 
                              "Language",
                              "Other"
                            ],
                    'theme': "default"
                  }
        };
        
        db.collection("users").insert(user, function(err, result) {
          if (!err) {
            login(req, res);
          }
          else
            res.send(500, err);
        });
      } else {
        res.send(403, {'message': 'The username and password entered do not match.'});
      }
    } else {
      res.send(500, err);
    }
  });
}

MongoClient.connect('mongodb://localhost/planner', function(err, dbase) {
  if (!err) {
    db = dbase;
    var server = app.listen(app.get('port'), function() {
      console.info('Listening on port %d', server.address().port);
    });
  } else {
    console.error(err);
  }
});