require("dotenv").config();
const { Client, SpotifyRPC } = require("discord.js-selfbot-v13");
const { DiscordStreamClient } = require("discord-stream-client");
const { CHANNEL_ID, SELF_DEAF, SELF_MUTE } = require("./config/config.json");
const fs = require("fs");
const server = require("./server");

const client = new Client();
new DiscordStreamClient(client);
server();

client.on("ready", async () => {
  console.log(`[ready] Logged in as ${client.user.tag}!`);

  const voiceChannel = client.channels.cache.get(CHANNEL_ID);
  if (!voiceChannel) return console.error("[error] Voice channel not found!");
  await client.streamClient.joinVoiceChannel(voiceChannel, {
    selfDeaf: SELF_DEAF,
    selfMute: SELF_MUTE,
    selfVideo: false,
  });
 
  // Spotify
  await musicPlayer();
});

async function musicPlayer() {
  let current_playlist = JSON.parse(
    fs.readFileSync("./config/playlist.json", "utf-8")
  );
  if (!current_playlist) return;
  while (true) {
    if (current_playlist.length === 0) {
      current_playlist = JSON.parse(
        fs.readFileSync("./config/playlist.json", "utf-8")
      );
    }
    let nowPlaying = current_playlist.shift();
    console.log(`[spotify] Now playing: ${nowPlaying.song_name}`);
    playingSong(nowPlaying);
    await delay(nowPlaying.duration);
  }
}

function playingSong(nowPlaying) {
  const spotify = new SpotifyRPC(client)
    .setAssetsLargeImage(nowPlaying.large_image) // Image ID
    .setAssetsLargeText(nowPlaying.album_name) // Album Name
    .setState(nowPlaying.artists) // Artists
    .setDetails(nowPlaying.song_name) // Song name
    .setStartTimestamp(Date.now())
    .setEndTimestamp(Date.now() + nowPlaying.duration) // Song length = 2m56s
    .setSongId(nowPlaying.song_id) // Song ID
    .setAlbumId(nowPlaying.album_id) // Album ID
    .setArtistIds(nowPlaying.artists_id); // Artist IDs
  client.user.setPresence({ activities: [spotify] });
  return nowPlaying;
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

client.login(process.env.TOKEN);
