var winston = require('winston');
var _ = require('lodash');
var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var s3 = new AWS.S3();

var s3_bucket_pics = 'finpics-pics';

var done = false;
var next_marker = null;
var count = 0;
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
                _.forEach(data.Contents, function(item) {
                    next_marker = item.Key;
                    if (item.Key.indexOf('/thumbs/') > 0 && !_.endsWith(item.Key, '.html') && (_.endsWith(_.toLower(item.Key), '.jpg') || _.endsWith(_.toLower(item.Key), '.jpeg') || _.endsWith(_.toLower(item.Key), '.png'))) {
                        count ++;
                    }
                });
                winston.info(next_marker);
            }
            asyncCallback(err);
        });
    }, function(err) {
        if (err) winston.error(err);
        winston.info(next_marker);
        winston.info(count);
    });