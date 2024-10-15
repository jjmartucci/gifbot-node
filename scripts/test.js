import { getBestGif, searchTenor } from "./tenor.js";

const test = async () => {
  const gifs = await searchTenor("show-me-the-money");
  const best = getBestGif(gifs.results);
};

test();
