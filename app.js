import Bolt from "@slack/bolt";
import https from "https";
import helloS3 from "./scripts/getAllGifs.js";

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

/* app.message("hello", async ({ message, say }) => {
  console.log(`message got`, message);
  // say() sends a message to the channel where the event was triggered
  await say(`Hey there <@${message.user}>!`);
}); */

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
  }
  await respond(`try ${matchingGifs.map((gif) => gif.name).join(", ")}`);
});

// handle someone asking for a .gif file
app.message(".gif", async ({ message, say }) => {
  console.log(`gif message got`, message);
  const gif = message.text;
  const GIF_DIR = `https://coffee-cake.nyc3.cdn.digitaloceanspaces.com/images/gifs/`;
  const image_url = `${GIF_DIR}${gif}`;
  checkImageUrl(image_url)
    .then(async (result) => {
      console.log(`image_url`, image_url);
      console.log("Is valid image URL:", result);
      if (!result) {
        await say({
          text: `hmm, not a gif I know!`,
        });
      } else {
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
      }
    })
    .catch((error) => console.error(error));

  // say() sends a message to the channel where the event was triggered
  //await say(`here's yer gif <@${message.user}>!`);
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log("⚡️ Bolt app is running!");
})();
