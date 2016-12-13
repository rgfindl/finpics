var winston = require('winston');
var _ = require('lodash');
var async = require('async');
var AWS = require('aws-sdk');

var docClient = new AWS.DynamoDB.DocumentClient();

var functions = {};

//
// Handles DynamoDB calls.
//
functions.put = function(folder, image, callback) {
    var params = {
        TableName: 'pics',
        Item: {
            primarykey: '/',
            sortkey: folder,
            pic: image
        }
    };
    winston.debug(JSON.stringify(params));
    docClient.put(params, function(err, data) {
        if (err)  winston.error(err);
        callback(err);
    });
};

var picset_images = require('./picset-images.json');
async.eachSeries(picset_images, function(image, next){
    var split = _.split(image, '/');
    functions.put(split[0], split[2], next);
}, function(err) {
    winston.info('Done');
});