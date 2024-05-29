import Bolt from "@slack/bolt";
import https from "https";
import helloS3, { copyToS3 } from "./scripts/getAllGifs.js";
import { channel } from "diagnostics_channel";
import { findClosestMatch } from "./scripts/closeEnough.js";

const checkImageUrl = (imageUrl) => {
  // Determine if we should use http or https
  const protocol = imageUrl.startsWith("https") ? https : http;

  return new Promise((resolve, reject) => {
    const request = protocol.get(imageUrl, (response) => {
      if (
        response.statusCode === 200 &&
        response.headers["content-type"].includes("image")
      ) {
        resolve(true); // Image URL is valid
      } else {
        resolve(false); // Image URL is not valid
      }
    });

    request.on("error", (err) => {
      reject(err); // Error checking the image URL
    });
  });
};

// Initializes your app with your bot token and signing secret
const app = new Bolt.App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

/* General message handler to look for files, then check if it's a DM to Jiffy,
 * and if, check if it is a gif, and if it is, upload it to S3.
 */
app.message("", async ({ message, say }) => {
  if (message.channel_type === "im") {
    console.log(`Jiffy DM:`, message);
    if (message.subtype === "file_share") {
      if (message.files[0].filetype !== "gif") {
        await say(`DO NOT TRICK ME WITH YOUR NON GIF FILES!`);
        return;
      }
      try {
        // assumes only 1 file
        const slackURL = message.files[0].url_private;
        await copyToS3(slackURL);
        await say(`Your file should now be up at ${slackURL.split("/").pop()}`);
      } catch (e) {
        console.error(e);
        await say(`tell Joe I threw this error and I'm sad now: ${e}`);
      }
    }
  }
});

// search for gifs
app.command("/jiffy-search", async ({ command, ack, respond }) => {
  // Acknowledge command request
  await ack();
  console.log(command);
  const gifs = await helloS3();
  const matchingGifs = gifs.filter((gif) => gif.name.includes(command.text));
  console.log(matchingGifs);
  console.log(`Found ${matchingGifs.length} matching gifs`);

  if (matchingGifs.length === 0) {
    await respond(`nothing found for the search, try simplifying it`);
  } else {
    await respond(`try ${matchingGifs.map((gif) => gif.name).join(", ")}`);
  }
});

// handle someone asking for a .gif file
app.message(".gif", async ({ message, say }) => {
  console.log(`gif message got`, message);
  // ignore URLs to Gifs
  const ignoreText = ["`", "https://", "http://"];
  const shouldIgnore = ignoreText.filter((text) => message.text.includes(text));
  if (shouldIgnore.length > 0) {
    return true;
  }
  const gifs = await helloS3();
  const gif = message.text.split(".")[0];
  const gifNames = gifs.map((gif) => gif.name);
  const GIF_DIR = `https://coffee-cake.nyc3.cdn.digitaloceanspaces.com/images/gifs/`;

  // we've got an exact match
  if (gifNames.includes(gif)) {
    const image_url = `${GIF_DIR}${gif}.gif`;
    await say({
      text: gif,
      blocks: [
        {
          type: "image",
          image_url: image_url,
          alt_text: "A gif!",
        },
      ],
    });
  } else {
    // yolo it
    const closest = findClosestMatch(gif, gifNames);
    console.log(`${closest} was the best match for ${gif}`);
    const close_image_url = `${GIF_DIR}${closest}.gif`;
    await say({
      text: gif,
      blocks: [
        {
          type: "image",
          image_url: close_image_url,
          alt_text: "A gif!",
        },
      ],
    });
  }
  // say() sends a message to the channel where the event was triggered
  //await say(`here's yer gif <@${message.user}>!`);
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log("⚡️ Bolt app is running!");
})();
