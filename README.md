# Gifs, in your Slack? It's more likely than you think.

This project stemmed from a desire to be SUPER LAZY about getting .gif reactions in Slack. As a group we started "shortcutting" gifs with something like: `marc-cuban-notes.gif`, since we all knew what it meant in our heads, but why not just type those words and have the gif appear.

Thus, this project! It watches Slack channels for messages like `cat-in-space.gif` or `very long and descriptive statement with .gif in it` and either:

- String matches from a remote file store for the gif, if you have a collective store of gifs and want _very_ specific accuracy for the gif returned.
- Searches tenor for a close match and returns that. This works... pretty well. Like 9 times out of 10 you'll probably be happy.

## Setup
You'll need 3 things to use all the features here:
1. A Slack app in your local workspace.
2. An S3 bucket
3. Hosting on a PAAS of your choice.

### Slack app
Set up a [Slack single workspace app](https://api.slack.com/distribution)

### S3 Bucket
I use [Digital Ocean spaces](https://www.digitalocean.com/products/spaces) but you do you. This allows you to do 1:1 matching against the bucket or let users upload to it.

### Hosting
I personally use [Render](https://render.com) on the cheapest plan (not a free plan, those spin down and won't be available when you send a .gif message). 


## You'll need to set some environment variables:
This was a one off hobby project so... these might not all be necessary, but they're all in use! 🤣

| Variable Name | What is it |
| --- | --- |
| TENOR_API | [Tenor API key](https://tenor.com/gifapi/documentation). These are free. |
| SLACK_SIGNING_SECRET | You'll get this from setting up the Slack app |
| SLACK_BOT_TOKEN | Same as above |
| SLACK_OAUTH_U_TOKEN | Same as above |
| S3_ENDPOINT | You'll get this from the S3 comptabile bucket you configured. |
| S3_REGION | Same as above |
| S3_BUCKET_KEY | Same as above |
| S3_SECRET_KEY | Same as above |
| BUCKET_NAME | Shortname for your S3 Bucket |
| BUCKET_PATH | Path from the S3 root, e.g. `images/gifs/` |
| BUCKET_ENDPOINT | Where the gif actually gets served from. The in the case of DO spaces this is a CDN e.g. `https://yo|u.nyc3.cdn.digitaloceanspaces.com/` |