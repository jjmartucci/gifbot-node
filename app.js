import Bolt from "@slack/bolt";
import https from "https";
import helloS3, { copyToS3 } from "./scripts/getAllGifs.js";

const JIFFY_API = "https://jiffy.builtwith.coffee";
const IMAGE_CDN = "https://coffee-cake.nyc3.cdn.digitaloceanspaces.com/images/gifs";

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

// Helper to search Jiffy and return all results
async function searchJiffy(searchTerm) {
  const response = await fetch(
    `${JIFFY_API}/api/search?query=${encodeURIComponent(searchTerm)}`
  );
  const json = await response.json();
  return json.gifs || [];
}

// Build the gif URL from a filename
function getGifUrl(filename) {
  return `${IMAGE_CDN}/${filename}`;
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

  const searchTerm = message.text.split(".")[0];
  const thread_ts = message.thread_ts || undefined;

  // Search Jiffy for all matching gifs
  const gifs = await searchJiffy(searchTerm);

  if (gifs.length === 0) {
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `No gifs found for "${searchTerm}"`,
    });
    return;
  }

  const totalResults = Math.min(gifs.length, 10); // Cap at 10 results
  const gifUrl = getGifUrl(gifs[0].filename);

  // Store minimal context - we'll re-fetch results on "Try another"
  const actionContext = JSON.stringify({
    c: message.channel,       // channel
    t: thread_ts,             // thread_ts
    u: message.user,          // user
    s: searchTerm,            // searchTerm
    i: 0,                     // currentIndex
    n: totalResults,          // total count
  });

  // Send ephemeral preview to user with confirmation buttons
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: `Preview for "${searchTerm}"`,
    blocks: [
      {
        type: "image",
        image_url: gifUrl,
        alt_text: searchTerm,
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Result 1 of ${totalResults}`,
          },
        ],
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
          ...(totalResults > 1
            ? [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Try another",
                  },
                  action_id: "gif_retry",
                  value: actionContext,
                },
              ]
            : []),
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
  const ctx = JSON.parse(body.actions[0].value);

  // Re-fetch to get the filename for current index
  const gifs = await searchJiffy(ctx.s);
  const gifUrl = getGifUrl(gifs[ctx.i].filename);

  // Post the gif publicly
  await client.chat.postMessage({
    channel: ctx.c,
    thread_ts: ctx.t,
    text: ctx.s,
    blocks: [
      {
        type: "image",
        image_url: gifUrl,
        alt_text: ctx.s,
      },
    ],
  });

  // Replace the ephemeral message to show it was posted
  await respond({
    replace_original: true,
    text: `Posted "${ctx.s}" gif!`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Posted "${ctx.s}" gif!`,
        },
      },
    ],
  });
});

// Handle "Try another" button click
app.action("gif_retry", async ({ ack, body, respond }) => {
  await ack();
  const ctx = JSON.parse(body.actions[0].value);

  // Move to next gif, wrap around if at the end
  const nextIndex = (ctx.i + 1) % ctx.n;

  // Re-fetch to get the filename for next index
  const gifs = await searchJiffy(ctx.s);
  const newGifUrl = getGifUrl(gifs[nextIndex].filename);

  // Update context with new index
  const newContext = JSON.stringify({
    ...ctx,
    i: nextIndex,
  });

  // Replace the ephemeral message with new gif
  await respond({
    replace_original: true,
    text: `Preview for "${ctx.s}"`,
    blocks: [
      {
        type: "image",
        image_url: newGifUrl,
        alt_text: ctx.s,
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Result ${nextIndex + 1} of ${ctx.n}`,
          },
        ],
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
  const ctx = JSON.parse(body.actions[0].value);

  // Replace the ephemeral message to show cancellation
  await respond({
    replace_original: true,
    text: `Cancelled "${ctx.s}" gif`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Cancelled "${ctx.s}" gif`,
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
