//
// Upload a new picset folder.
//
var winston = require('winston');
var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var gm = require('gm').subClass({ imageMagick: true });
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var s3 = new AWS.S3();

var s3_bucket_pics = 'finpics-pics';

// Get folder name
if (process.argv.length != 3) {
    winston.error('Please provide a folder of pics to upload.');
    process.exit(-1);
}
var path = process.argv[2];
winston.info(path);

// Fetch all images within the folder.
fs.readdir(path, function(err, items) {

    // Validate each image.
    var images = [];
    _.forEach(items, function(item) {
        if (_.endsWith(_.toLower(item), '.jpg') || _.endsWith(_.toLower(item), '.jpeg') || _.endsWith(_.toLower(item), '.png')) {
            images.push(item);
        }
    });
    if (images.length == 0) {
        winston.error(path + ' is empty.  Please add some photos and try again.');
    }

    // Process each image.
    async.eachSeries(images, function(image, eachNext) {
        var image_path = _.join([path, image], '/');
        winston.info(image_path);
        async.waterfall([
            function autoOrient(next) {
                // Lets make sure the orientation is correct.  We don't want any sidways images.
                winston.info('autoOrient');
                gm(image_path).autoOrient().write(image_path, function(err) {
                    next(err, null);
                });
            },
            function getFormat(results, next) {
                // Get the format so we can set the contentType.
                winston.info('getFormat');
                gm(image_path).format(next);
            },
            function upload(format, next) {
                // Upload the image to S3.
                winston.info('upload');
                var params = {
                    Bucket: s3_bucket_pics,
                    Key: image_path,
                    Body: fs.createReadStream(image_path),
                    StorageClass: 'REDUCED_REDUNDANCY',
                    ContentType: 'image/'+format
                };
                s3.upload(params, next);
            }
        ], eachNext);
    }, function(err) {
        if (err) {
            winston.error(err);
            process.exit(-1);
        } else {
            winston.info('Done!');
            process.exit();
        }
    });
});