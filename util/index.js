//- Script to process existing images.
//- Move thumbs to another bucket with same path as original.
//- Index each image.
//- Store face information in dynamodb.
var winston = require('winston');
var _ = require('lodash');
var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';

var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});

var s3_bucket_pics = 'finpics-pics';
var s3_bucket_thumbs = 'finpics-thumbs';
var COLLECTION_ID = 'finpics';

var functions = {};

//
// Add to DynamoDB
//
functions.put = function(folder, image, data, callback) {
    var params = {
        TableName: 'pics',
        Item: {
            primarykey: folder,
            sortkey: image,
            data: data
        }
    };
    winston.info('Put DynamoDB');
    winston.info(JSON.stringify(params));
    docClient.put(params, function(err, data) {
        if (err)  winston.error(err);
        callback(err);
    });
};

//
// Move S3 thumbnail
//
functions.copy = function(source, dest, callback) {
    var params = {
        CopySource: encodeURIComponent(s3_bucket_pics+'/'+source),
        Bucket: s3_bucket_thumbs,
        Key: dest,
        StorageClass: 'REDUCED_REDUNDANCY'
    };
    winston.info('Copy S3');
    winston.info(JSON.stringify(params));
    s3.copyObject(params, function(err, data) {
        if (err)  winston.error(err);
        callback(null, data);
    });
};

//
// Delete S3 thumbnail
//
functions.delete = function(key, callback) {
    var params = {
        Bucket: s3_bucket_pics,
        Key: key
    };
    winston.info('Delete S3');
    winston.info(JSON.stringify(params));
    s3.deleteObject(params, function(err, data) {
        if (err)  winston.error(err);
        callback(null, data);
    });
};

//
// Index faces
//
functions.index = function(key, callback) {
    var params = {
        CollectionId: COLLECTION_ID, /* required */
        Image: { /* required */
            S3Object: {
                Bucket: s3_bucket_pics,
                Name: key
            }
        }
    };
    winston.info('Index faces');
    winston.info(JSON.stringify(params));
    rekognition.indexFaces(params, function(err, data) {
        if (err)  winston.error(err);
        callback(err, data);
    });
};

functions.process = function(key, callback) {
    var parts = _.split(key, '/');
    var image = _.last(parts);
    var folder = _.nth(parts, -2);
    var thumb_key = _.join(_.union(_.dropRight(parts), ['thumbs', image]), '/');
    winston.info('Process Image');
    winston.info(JSON.stringify({
        parts: parts,
        image: image,
        folder: folder,
        thumb_key: thumb_key
    }));
    async.waterfall([
        function(next) {
            functions.copy(thumb_key, key, next);
        },
        function(results, next) {
            functions.delete(thumb_key, next);
        },
        function(results, next) {
            functions.index(key, next);
        },
        function(results, next) {
            functions.put(folder, image, results, next);
        }
    ], callback);
};

//
// Loop through and process all existig finpics.com images.
//
var done = false;
var next_marker = null;
async.until(
    function() {
        return done;
    }, function(asyncCallback) {
        var params = {
            Bucket: s3_bucket_pics, /* required */
            Prefix: 'photos/'
        };
        if (next_marker) {
            params.Marker = next_marker;
        }
        s3.listObjects(params, function(err, data) {
            if (err) winston.error(err);
            else {
                done = !data.IsTruncated;
                async.eachSeries(data.Contents, function(item, eachCallback) {
                    next_marker = item.Key;
                    if (item.Key.indexOf('/thumbs/') <= 0 && !_.endsWith(item.Key, '.html') && (_.endsWith(_.toLower(item.Key), '.jpg') || _.endsWith(_.toLower(item.Key), '.jpeg') || _.endsWith(_.toLower(item.Key), '.png'))) {
                        functions.process(item.Key, eachCallback);
                    } else
                        eachCallback(null);
                }, asyncCallback);
            }
        });
    }, function(err) {
        if (err) winston.error(err);
        winston.info(next_marker);
        winston.info('Done!');
    });