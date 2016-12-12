# finpics
Use AWS Rekognition to provide a faces search of finpics.com

Web Assets
aws s3 sync . s3://finpics.com --exclude "photos/*" --exclude ".gitignore" --exclude ".idea/*" --exclude ".git/*" --storage-class REDUCED_REDUNDANCY --profile bluefin

Photos
aws s3 sync . s3://finpics-pics --exclude "*" --include "photos/*" --storage-class REDUCED_REDUNDANCY --profile bluefin

aws s3 sync s3://finpics.com/photos s3://finpics-pics/photos --storage-class REDUCED_REDUNDANCY --profile bluefin
