import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import axios from "axios";
import { writeFileSync } from "fs";

const CDN = `https://coffee-cake.nyc3.cdn.digitaloceanspaces.com/`;
const BUCKET = "coffee-cake";
const PREFIX = "images/gifs/";

const s3Client = new S3({
  forcePathStyle: false, // Configures to use subdomain/virtual calling format.
  endpoint: "https://nyc3.digitaloceanspaces.com",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.DO_BUCKET_KEY,
    secretAccessKey: process.env.DO_SECRET_KEY,
  },
});

export const copyToS3 = async (fileUrl) => {
  // Download file from web URL
  axios
    .get(fileUrl, { responseType: "stream" })
    .then(async (response) => {
      try {
        const upload = new Upload({
          client: S3Client,
          params: {
            Bucket: BUCKET,
            Key: `${PREFIX}${fileUrl.split("/").pop()}`,
            Body: response.data,
          },
        });
        const result = await upload.done();
        return result.Key;
      } catch (err) {
        console.error(err);
      }
    })
    .catch((error) => console.error("Error copying file to S3:", error));
};

export const helloS3 = async () => {
  const command = new ListObjectsV2Command({
    Bucket: "coffee-cake",
    Prefix: "images/gifs/",
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
