var winston = require('winston');
var _ = require('lodash');
var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';

var docClient = new AWS.DynamoDB.DocumentClient();

var params = {
    TableName: 'pics'
};
docClient.scan(params, onScan);

function onScan(err, data) {
    if (err) {
        winston.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        async.eachSeries(data.Items, function(item, next) {
            if (!_.isNil(item.data) && !_.isNil(item.data.FaceRecords) && !_.isEmpty(item.data.FaceRecords) &&
                !_.isNil(item.data.FaceRecords[0].Face) && !_.isNil(item.data.FaceRecords[0].Face.ImageId)) {
                var item = {
                    image_id: item.data.FaceRecords[0].Face.ImageId,
                    data: item.data,
                    image_path: item.primarykey+'/'+item.sortkey
                };
                var params = {
                    TableName: 'pics_by_image_id',
                    Item: item
                };
                docClient.put(params, function(err, data) {
                    if (err) winston.error(err);
                    next(err)
                });
            } else next(null);
        }, function(err) {
            if (err) winston.error(err);
            else if (!_.isNil(data.LastEvaluatedKey)) {
                winston.info("Scanning for more...");
                params.ExclusiveStartKey = data.LastEvaluatedKey;
                docClient.scan(params, onScan);
            } else
                process.exit();
        });
    }
}