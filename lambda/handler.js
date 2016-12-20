'use strict';
var _ = require('lodash');
var winston = require('winston');
var async = require('async');
var gm = require('gm').subClass({ imageMagick: true });
var util = require('util');
var AWS = require('aws-sdk');
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();

// constants
var MAX_WIDTH  = 300;
var MAX_HEIGHT = 300;
var S3_THUMBS_BUCKET = 'finpics-thumbs';
var COLLECTION_ID = 'finpics';

module.exports = {
  search: function(event, context, callback) {

    var params = {
      CollectionId: 'finpics', /* required */
      FaceId: event.faceid
    };
    rekognition.searchFaces(params, function (err, data) {
      if (err) {
        var response = {
          statusCode: 500,
          err: err,
          params: params
        };
        callback(null, response);
      } else {
        var keys = [];
        var imageids = [];
        _.forEach(data.FaceMatches, function (FaceMatch) {
          if (!_.includes(imageids, FaceMatch.Face.ImageId)) {
            keys.push({"image_id": {"S": FaceMatch.Face.ImageId}});
            imageids.push(FaceMatch.Face.ImageId);
          }
        });
        var params = {
          "RequestItems": {
            "pics_by_image_id": {
              "Keys": _.slice(keys, 0, 100)
            }
          }
        };
        dynamodb.batchGetItem(params, function (err, results) {
          if (err) {
            var response = {
              statusCode: 500,
              err: err,
              params: params
            };
            callback(null, response);
          } else {
            var output = [];
            var imageids = [];
            _.forEach(data.FaceMatches, function (FaceMatch) {
              if (!_.includes(imageids, FaceMatch.Face.ImageId)) {
                var raw_item = _.find(results.Responses.pics_by_image_id, {image_id: {S: FaceMatch.Face.ImageId}});
                if (!_.isNil(raw_item)) {
                  var item = {
                    image_id: raw_item.image_id.S,
                    image_path: raw_item.image_path.S
                  };
                  var faces = [];
                  _.forEach(raw_item.data.M.FaceRecords.L, function (FaceRecord) {
                    faces.push({
                      Face: {
                        Confidence: FaceRecord.M.Face.M.Confidence.N,
                        ImageId: FaceRecord.M.Face.M.ImageId.S,
                        BoundingBox: {
                          Top: FaceRecord.M.Face.M.BoundingBox.M.Top.N,
                          Height: FaceRecord.M.Face.M.BoundingBox.M.Height.N,
                          Width: FaceRecord.M.Face.M.BoundingBox.M.Width.N,
                          Left: FaceRecord.M.Face.M.BoundingBox.M.Left.N
                        },
                        FaceId: FaceRecord.M.Face.M.FaceId.S,
                      }
                    });
                  });
                  item.data = {
                    FaceRecords: faces
                  };
                  output.push(item);
                }
                imageids.push(FaceMatch.Face.ImageId);
              }
            });
            var response = {
              statusCode: 200,
              output: output
            };
            callback(null, response);
          }
        });
      }
    });
  },

  s3: function(event, context, callback) {
    //- Add feature pic in DynamoDB.
    //- Index image.
    //- Store face information in dynamodb. x2
    //- Generate thumb.
    // Read options from the event.

    winston.info("Reading options from event:\n", util.inspect(event, {depth: 5}));
    var srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey    =
        decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    var dstBucket = S3_THUMBS_BUCKET;
    var dstKey    = srcKey;

    // Sanity check: validate that source and destination are different buckets.
    if (srcBucket == dstBucket) {
      callback("Source and destination buckets are the same.");
      return;
    }

    // Infer the image type.
    var typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
      callback("Could not determine the image type.");
      return;
    }
    var imageType = _.toLower(typeMatch[1]);
    if (imageType != "jpg" && imageType != "jpeg" && imageType != "png") {
      callback('Unsupported image type: ${imageType}');
      return;
    }

    // Download the image from S3, transform, and upload to a different S3 bucket.
    async.waterfall([
          function download(next) {
            // Download the image from S3 into a buffer.
            s3.getObject({
                  Bucket: srcBucket,
                  Key: srcKey
                },
                next);
          },
          function transform(response, next) {
            gm(response.Body).size(function(err, size) {
              // Infer the scaling factor to avoid stretching the image unnaturally.
              var scalingFactor = Math.min(
                  MAX_WIDTH / size.width,
                  MAX_HEIGHT / size.height
              );
              var width  = scalingFactor * size.width;
              var height = scalingFactor * size.height;

              // Transform the image buffer in memory.
              this.resize(width, height).autoOrient()
                  .toBuffer(imageType, function(err, buffer) {
                    if (err) {
                      next(err);
                    } else {
                      next(null, response.ContentType, buffer);
                    }
                  });
            });
          },
          function upload(contentType, data, next) {
            // Stream the transformed image to a different S3 bucket.
            s3.putObject({
                  Bucket: dstBucket,
                  Key: dstKey,
                  Body: data,
                  ContentType: contentType,
                  StorageClass: 'REDUCED_REDUNDANCY'
                },
                next);
          },
          function add_feature_pic(response, next) {
            var image_parts = _.drop(_.split(srcKey, '/'));
            var params = {
              TableName: 'pics',
              Key: {
                primarykey: '/',
                sortkey: _.head(image_parts)
              },
              UpdateExpression: "set pic = :pic",
              ConditionExpression: "attribute_not_exists(pic)",
              ExpressionAttributeValues:{
                ':pic': _.last(image_parts)
              }
            };
            winston.info(JSON.stringify(params));
            docClient.update(params, function(err, results) {
              if (err && _.isEqual(err.code, 'ConditionalCheckFailedException')) next(null, null);
              else next(err, results);
            });
          },
          function rekognize(response, next) {
            var params = {
              CollectionId: COLLECTION_ID, /* required */
              Image: { /* required */
                S3Object: {
                  Bucket: srcBucket,
                  Name: srcKey
                }
              }
            };
            winston.info('Index faces');
            winston.info(JSON.stringify(params));
            rekognition.indexFaces(params, next);
          },
          function add_pics(data, next) {
            var image_parts = _.drop(_.split(srcKey, '/'));
            var item = {
              primarykey: _.head(image_parts),
              sortkey: _.nth(image_parts, 1),
              data: data
            };
            var params = {
              TableName: 'pics',
              Item: item
            };
            winston.info('Put DynamoDB');
            winston.info(JSON.stringify(params));
            docClient.put(params, function(err, respose) {
              if (err)  winston.error(err);
              next(err, data);
            });
          },
          function add_pics_by_image_id(data, next) {
            if (!_.isNil(data) && !_.isNil(data.FaceRecords) && !_.isEmpty(data.FaceRecords) &&
                !_.isNil(data.FaceRecords[0].Face) && !_.isNil(data.FaceRecords[0].Face.ImageId)) {
              var image_parts = _.drop(_.split(srcKey, '/'));
              var item = {
                image_id: data.FaceRecords[0].Face.ImageId,
                data: data,
                image_path: _.join(image_parts, '/')
              };
              var params = {
                TableName: 'pics_by_image_id',
                Item: item
              };
              winston.info('Put DynamoDB');
              winston.info(JSON.stringify(params));
              docClient.put(params, next);
            } else next(null, null);
          }
        ], function (err) {
          if (err) {
            winston.error(
                'Unable to resize ' + srcBucket + '/' + srcKey +
                ' and upload to ' + dstBucket + '/' + dstKey +
                ' due to an error: ' + err
            );
          } else {
            winston.info(
                'Successfully resized ' + srcBucket + '/' + srcKey +
                ' and uploaded to ' + dstBucket + '/' + dstKey
            );
          }

          callback(null, "message");
        }
    );
  }
};
