export const searchTenor = async (search_term) => {
  // set the apikey and limit
  const apikey = process.env.TENOR_API;
  const clientkey = "Jiffybot";
  const lmt = 8;

  // test search term

  // using default locale of en_US
  var search_url =
    "https://tenor.googleapis.com/v2/search?q=" +
    search_term.replace("-", " ") +
    "&key=" +
    apikey +
    "&client_key=" +
    clientkey +
    "&limit=" +
    lmt;

  const data = await fetch(search_url);
  const body = data.json();

  return body;
};

export const getBestGif = (gifs) => {
  console.log(gifs);
  return gifs[0]["media_formats"]["gif"]["url"];
};
