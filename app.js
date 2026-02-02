import Bolt from "@slack/bolt";
import https from "https";
import helloS3, { copyToS3 } from "./scripts/getAllGifs.js";
import { getBestGif, searchTenor } from "./scripts/tenor.js";

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

// Helper to fetch a gif URL from Jiffy or Tenor
async function fetchGifUrl(searchTerm) {
  const jiffyRequest = await fetch(
    `https://jiffy.builtwith.coffee/api/search/yolo?q=${searchTerm}`
  );
  const json = await jiffyRequest.json();
  const jiffy_url = json.gif;
  console.log(`Jiffy gave us ${jiffy_url}`);

  if (jiffy_url !== "") {
    return { url: jiffy_url, source: "jiffy" };
  } else {
    // fall back to Tenor search
    const gifs = await searchTenor(searchTerm);
    const best = getBestGif(gifs.results);
    return { url: best, source: "tenor" };
  }
}

// handle someone asking for a .gif file
app.message(".gif", async ({ message, client }) => {
  console.log(`gif message got`, message);
  // ignore URLs to Gifs
  const ignoreText = ["`", "https://", "http://"];
  const shouldIgnore = ignoreText.filter((text) => message.text.includes(text));
  if (shouldIgnore.length > 0) {
    return true;
  }

  const gif = message.text.split(".")[0];
  const thread_ts = message.thread_ts || undefined;
  const { url: gifUrl, source } = await fetchGifUrl(gif);

  // Store context in action value for button handlers
  const actionContext = JSON.stringify({
    channel: message.channel,
    thread_ts,
    user: message.user,
    searchTerm: gif,
    gifUrl,
    source,
  });

  // Send ephemeral preview to user with confirmation buttons
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: `Preview for "${gif}"`,
    blocks: [
      {
        type: "image",
        image_url: gifUrl,
        alt_text: gif,
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Post it!",
            },
            style: "primary",
            action_id: "gif_confirm",
            value: actionContext,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Try another",
            },
            action_id: "gif_retry",
            value: actionContext,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel",
            },
            style: "danger",
            action_id: "gif_cancel",
            value: actionContext,
          },
        ],
      },
    ],
  });
});

// Handle "Post it!" button click
app.action("gif_confirm", async ({ ack, client, body, respond }) => {
  await ack();
  const context = JSON.parse(body.actions[0].value);

  // Post the gif publicly
  await client.chat.postMessage({
    channel: context.channel,
    thread_ts: context.thread_ts,
    text: context.searchTerm,
    blocks: [
      {
        type: "image",
        image_url: context.gifUrl,
        alt_text: context.searchTerm,
      },
    ],
  });

  // Replace the ephemeral message to show it was posted
  await respond({
    replace_original: true,
    text: `Posted "${context.searchTerm}" gif!`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Posted "${context.searchTerm}" gif!`,
        },
      },
    ],
  });
});

// Handle "Try another" button click
app.action("gif_retry", async ({ ack, body, respond }) => {
  await ack();
  const context = JSON.parse(body.actions[0].value);

  // Fetch from Tenor and pick a random result
  const tenorResults = await searchTenor(context.searchTerm);
  const randomIndex = Math.floor(Math.random() * tenorResults.results.length);
  const newGifUrl = tenorResults.results[randomIndex]?.media_formats?.gif?.url;

  // Update context with new gif
  const newContext = JSON.stringify({
    ...context,
    gifUrl: newGifUrl,
    source: "tenor",
  });

  // Replace the ephemeral message with new gif
  await respond({
    replace_original: true,
    text: `Preview for "${context.searchTerm}"`,
    blocks: [
      {
        type: "image",
        image_url: newGifUrl,
        alt_text: context.searchTerm,
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Post it!",
            },
            style: "primary",
            action_id: "gif_confirm",
            value: newContext,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Try another",
            },
            action_id: "gif_retry",
            value: newContext,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel",
            },
            style: "danger",
            action_id: "gif_cancel",
            value: newContext,
          },
        ],
      },
    ],
  });
});

// Handle "Cancel" button click
app.action("gif_cancel", async ({ ack, body, respond }) => {
  await ack();
  const context = JSON.parse(body.actions[0].value);

  // Replace the ephemeral message to show cancellation
  await respond({
    replace_original: true,
    text: `Cancelled "${context.searchTerm}" gif`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Cancelled "${context.searchTerm}" gif`,
        },
      },
    ],
  });
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log("⚡️ Bolt app is running!");
})();
