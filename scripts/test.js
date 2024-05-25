import { copyToS3 } from "./getAllGifs.js";

const test = async () => {
  await copyToS3(
    "https://files.slack.com/files-pri/T030D21GG-F07574DSNLC/download/well-maybe-ehhh.gif"
  );
};

test();
