'use strict';
var _ = require('lodash');
var winston = require('winston');
var AWS = require('aws-sdk');
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});
var dynamodb = new AWS.DynamoDB();

module.exports.search = (event, context, callback) => {

  var params = {
    CollectionId: 'finpics', /* required */
    FaceId: event.faceid
  };
  rekognition.searchFaces(params, function(err, data) {
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
      _.forEach(data.FaceMatches, function(FaceMatch) {
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
          _.forEach(data.FaceMatches, function(FaceMatch) {
            if (!_.includes(imageids, FaceMatch.Face.ImageId)) {
              var raw_item = _.find(results.Responses.pics_by_image_id, {image_id:{S:FaceMatch.Face.ImageId}});
              if (!_.isNil(raw_item)) {
                var item = {
                  image_id: raw_item.image_id.S,
                  image_path: raw_item.image_path.S
                };
                var faces = [];
                _.forEach(raw_item.data.M.FaceRecords.L, function(FaceRecord) {
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

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
