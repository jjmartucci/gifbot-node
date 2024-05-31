import { copyToS3 } from "./getAllGifs.js";
import { getBestGif, searchTenor } from "./tenor.js";

const test = async () => {
  /*   await copyToS3(
    //"https://files.slack.com/files-pri/T030D21GG-F075HBPG5A5/test.gif"
    "https://files.slack.com/files-pri/T030D21GG-F075HBPG5A5/download/test.gif"
    //`https://coffee-cake.nyc3.cdn.digitaloceanspaces.com/images/gifs/out.gif`
  ); */

  const gifs = await searchTenor("show-me-the-money");
  const best = getBestGif(gifs.results);
  console.log(best);
};

test();
