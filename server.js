const express = require("express");
const app = express();

module.exports = async () => {
  app.get("/", (req, res) => {
    res.send("Hello World!");
  });
  app.listen(8080, () => {
    console.log("Server is ready");
  });
};
