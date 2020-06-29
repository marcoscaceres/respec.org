require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const compression = require("compression");
const helmet = require("helmet");
const logging = require("./utils/logging");
const viewEngine = require("./utils/view-engine");

const app = express();
app.use(compression());

// logging
app.enable("trust proxy"); // for :remote-addr
app.use(logging.stdout());
app.use(logging.stderr());

app.use(express.static(__dirname + "/static"));
viewEngine.register(app);

// Security
// Defaults https://www.npmjs.com/package/helmet#how-it-works
app.use(helmet({
  frameguard: false, // Allow for UI inclusion as iframe in ReSpec pill.
}));

app.use("/xref", require("./routes/xref/").routes);
app.use("/caniuse", require("./routes/caniuse/").routes);
app.use("/github/:org/:repo", require("./routes/github/").routes);
app.use("/respec", require("./routes/respec/").routes);
app.use("/w3c", require("./routes/w3c/").routes);

const port = parseInt(process.env.PORT, 10) || 8000;
app.listen(port, () => console.log(`Listening on port ${port}!`));
