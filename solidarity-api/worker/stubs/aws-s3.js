// The Worker build stores files in R2 (services/storage.js); the S3 SDK is never loaded there.
const unavailable = () => {
  throw new Error('@aws-sdk/client-s3 is not available in the Worker build; files are stored in R2');
};

export class S3Client {
  constructor() {
    unavailable();
  }
}
export class PutObjectCommand {}
export class GetObjectCommand {}
export class DeleteObjectCommand {}
