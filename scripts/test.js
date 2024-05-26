import { copyToS3 } from "./getAllGifs.js";

const test = async () => {
  await copyToS3(
    //"https://files.slack.com/files-pri/T030D21GG-F075HBPG5A5/test.gif"
    "https://files.slack.com/files-pri/T030D21GG-F075HBPG5A5/download/test.gif"
    //`https://coffee-cake.nyc3.cdn.digitaloceanspaces.com/images/gifs/out.gif`
  );
};

test();
