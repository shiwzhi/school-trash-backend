var MongoClient = require('mongodb').MongoClient
    , assert = require('assert');

var _db;

module.exports = {
    connectToServer: function (callback) {
        MongoClient.connect("mongodb://192.168.2.127:27017",{ useNewUrlParser: true } ,  function (err, client) {
            
            _db = client.db('trashcan')
            return callback(err);
        });
    }

    , getDb: function () {
        return _db;
    }
}
