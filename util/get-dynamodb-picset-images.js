var winston = require('winston');
var _ = require('lodash');
var async = require('async');
var AWS = require('aws-sdk');

var docClient = new AWS.DynamoDB.DocumentClient();

var functions = {};

//
// Handles DynamoDB calls.
//
functions.query = function(callback) {
    var params = {
        TableName: 'pics',
        KeyConditionExpression: "primarykey = :primarykey",
        ExpressionAttributeValues: {
            ":primarykey": '/'
        }
    };
    winston.debug(JSON.stringify(params));
    docClient.query(params, function(err, data) {
        if (err)  winston.error(err);
        callback(err, data);
    });
};

functions.query(function(err, data) {
    winston.info(JSON.stringify(data, null, 3));
});