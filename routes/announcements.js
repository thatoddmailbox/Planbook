module.exports = {
  get: function(req, res) {
    res.type('text/json');
    db.collection("announcements").find({'monday': req.param('monday')}).toArray(function(err, docs) {
      if (docs[0])
        res.send({'announcements': docs[0].data});
      else
        res.send(404); // client deals with the 404.
    });
  },
  post: function(req, res) {
    // check that user is admin
    // we can't access app.get from here, so parse the config again
    // TODO: find a better way than re-reading the file
    var config = JSON.parse(require("fs").readFileSync("config.json"));

    if (config.admins.indexOf(req.session.username) == -1) {
      res.send(403); // You're not an admin! 403 forbidden, go away
      return;
    }

    // search the announcements collection for an entry that's the same week as the one we're trying to save
    db.collection("announcements").find({'monday': req.body.monday}).toArray(function(err, docs) {
      if (!err) {
        if (docs[0]) { // if there is an entry that fits the criteria, update it.
          db.collection("announcements").findOneAndUpdate({_id: docs[0]._id}, {
            $set: {'data': req.body.data}
          }, function (err, result) {
            if (!err)
              res.send(200);
            else
              res.send(500, err);
          });
        } else { // if there's no entry in that spot, make a new one and inset it into the db.
          db.collection("announcements").insert({'monday': req.body.monday, 'data': req.body.data}, function(err, result) {
            if (!err)
              res.send(200);
            else
              res.send(500, err);
          });
        }
      }
      else { // if there's an error, respond correctly and send the error to the client to handle.
        res.send(500, err);
      }
    });
    console.log(req.body.data);
  }
}