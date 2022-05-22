const AWS = require('aws-sdk')
const s3 = new AWS.S3()

const BUCKET_NAME = 'bad-debt'

const uploadJsonFile = (jsonString, fileName) => {
  console.log("========================uploadJsonFile")
  return new Promise((resolve, reject) => {
     // Read content from the file
     
    // Setting up S3 upload parameters
    const params = {
        Bucket: BUCKET_NAME,
        Key: fileName, // File name you want to save as in S3
        Body: jsonString,
        ACL: 'private'
    };

    console.log(params)

    // Uploading files to the bucket
    s3.upload(params, function(err, data) {
        if (err) {
            reject(err)
            return
        }
        console.log(`File uploaded successfully.`);
        resolve(data)
    });

  })
}

const getJsonFile = (fileName) => {
  return new Promise((resolve, reject) => {
    // Read content from the file

    // Setting up S3 parameters
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName, // File name you want in S3
    };

    // Uploading files to the bucket
    s3.getObject(params, function(err, data) {
        if (err) {
            reject(err)
            return
        }
        resolve(data)
      });

  })
}

const listJsonFiles = () => {
  return new Promise((resolve, reject) => {

    // Setting up S3 parameters
    const params = {
      Bucket: BUCKET_NAME,
    };

    // Uploading files to the bucket
    s3.listObjects(params, function(err, data) {
        if (err) {
            reject(err)
            return
        }
        resolve(data)
      });
  })
}

module.exports = {
  uploadJsonFile, 
  listJsonFiles,
  getJsonFile
}