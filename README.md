# finpics
Use AWS Rekognition to provide a faces search of finpics.com

## DynamoDB
### pics table
* primaykey (Primary Key)
* sortKey (Sort Key)
* ... Rekognition IndexFaces response

*Picsets*
* primaykey: '/' (Primary Key)
* sortkey: '014_newportboston' (Sort Key)
* pic: 'Newport_pic_3.jpg'

*Pics*
* primaykey: '014_newportboston' (Primary Key)
* sortkey: 'Newport_pic_3.jpg' (Sort Key)
* ... Rekognition IndexFaces response

## Develop locally
npm run serve

## Deploy
Install AWS CLI and configure profile credentials.

### Web Assets
npm run deploy-site

### Photos
npm ren deploy-pics

## TODO
- Script to process existing images.
 - (Maybe) Rename each image using uuid.  Must be sortable and in original order.
 - Move thumbs to another bucket with same path as original.
 - Index each image.
 - Store face information in dynamodb.
- Use dynamodb to load picset pics instead of S3 scan.
- Build lambda to handle S3 events.
 - Add feature pic.
 - Index image.
 - Store face information in dynamodb.
 - Generate thumb.