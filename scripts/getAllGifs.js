import { ListObjectsV2Command, PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import axios from "axios";

const CDN = process.env.BUCKET_ENDPOINT;
const BUCKET = process.env.BUCKET_NAME;
const PREFIX = process.env.BUCKET;
const SLACK_BOT_TOKEN = process.env.SLACK_OAUTH_U_TOKEN;

const s3Client = new S3({
  forcePathStyle: false, // Configures to use subdomain/virtual calling format.
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_BUCKET_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

export const copyToS3 = async (fileUrl) => {
  // Download file from web URL
  const config = {
    decompress: false,
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    responseType: "arraybuffer",
  };
  axios
    .get(fileUrl, config)
    .then(async (response) => {
      // Create a command to upload the file to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${PREFIX}${fileUrl.split("/").pop()}`,
        Body: response.data,
        ACL: "public-read",
        ContentType: "image/gif",
      });

      try {
        const response = await s3Client.send(uploadCommand);
        console.log(`S3 success:`, response);
        return fileUrl.split("/").pop();
      } catch (err) {
        console.error(`S3 error:`, err);
      }
    })
    .catch((error) => console.error("Error copying file to S3:", error));
};

export const helloS3 = async () => {
  const command = new ListObjectsV2Command({
    Bucket: process.env.BUCKET_NAME,
    Prefix: process.env.BUCKET_PATH,
  });

  try {
    let isTruncated = true;

    console.log("Got bucket contents");
    let contents = [];

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } =
        await s3Client.send(command);
      const contentsList = Contents.map((c) => ({
        name: c.Key.split("/").pop().split(".")[0],
        url: `${CDN}${c.Key}`,
      }));
      contents = contentsList;
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
    }
    console.log(`Found ${contents.length} gifs`);

    return contents;
    //writeFileSync("./gifs.json", JSON.stringify(contents, null, 2), "utf8");
  } catch (err) {
    console.error(err);
  }
};

export default helloS3;
