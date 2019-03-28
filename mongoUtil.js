var MongoClient = require('mongodb').MongoClient
    , assert = require('assert');

var _db;

module.exports = {
    connectToServer: function (callback) {
        MongoClient.connect("mongodb://localhost:27017", function (err, client) {
            
            _db = client.db('trashcan')
            return callback(err);
        });
    }

    , getDb: function () {
        return _db;
    }
}
