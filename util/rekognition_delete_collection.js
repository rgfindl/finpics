var AWS = require('aws-sdk');
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});

var params = {
    CollectionId: 'finpics' /* required */
};
rekognition.deleteCollection(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
});

//{ StatusCode: 200,
//    CollectionArn: 'aws:rekognition:us-east-1:132093761664:collection/finpics' }
