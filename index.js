const { Client, SpotifyRPC, Collection } = require("discord.js-selfbot-v13");
const { DiscordStreamClient } = require("discord-stream-client");
const { CHANNEL_ID, SELF_DEAF, SELF_MUTE } = require("./config/config.json");
const axios = require("axios");
const db = new Collection();

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
  db.set("access_token", await getSpotifyToken());

  // Spotify
  await musicPlayer();
});

client.on("messageCreate", async (message) => {
  if (message.author.id !== client.user.id) return;
  if (spotifyURLCheck(message.content)) {
    let trackId = message.content.match(/track\/([a-zA-Z0-9]{22})/)[1];
    let access_token = db.get("access_token");
    let track = await axios.get(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    const { artists, name, album, id, duration_ms } = track.data;
    let songData = {
      large_image: getSongImage(album.images[0].url),
      large_text: name,
      artists: artists.map((artist) => artist.name).join(", "),
      song_name: name,
      song_id: id,
      duration: duration_ms,
      album_id: album.id,
      artists_id: artists.map((artist) => getArtistID(artist.uri)),
    };
    console.log(`[spotify] Added song: ${songData.song_name}`);
    let playlist = require("./config/playlist.json");
    if (!playlist) playlist = [];
    if (!playlist.find((song) => song.song_id === songData.song_id)) {
      playlist.push(songData);
      Bun.write("./config/playlist.json", JSON.stringify(playlist, null, 2));
    }
  }
});

function spotifyURLCheck(url) {
  return /https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]{22}/.test(url);
}

function getSongImage(url) {
  return url.replace(/https:\/\/i\.scdn\.co\/image\//, "");
}

function getArtistID(uri) {
  return uri.split(":")[2];
}

async function getSpotifyToken() {
  let token = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({
      grant_type: "client_credentials",
    }),
    {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return token.data.access_token;
}

async function musicPlayer() {
  let current_playlist = require("./config/playlist.json");
  if (!current_playlist) return;
  while (true) {
    let isPlaying = db.get("isPlaying");
    if (!isPlaying) {
      isPlaying = true;
      db.set("isPlaying", isPlaying);
    }
    if (current_playlist.length === 0) {
      current_playlist = JSON.parse(
        await Bun.file("./config/playlist.json").text()
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
    .setAssetsLargeText(nowPlaying.large_text) // Album Name
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

function server() {
  const server = Bun.serve({
    port: 8080,
    fetch(req) {
      return new Response("Welcome to Bun!");
    },
  });
  console.log(`Listening on ${server.url}`);
}

client.login(process.env.TOKEN);
