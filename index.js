var bodyParser = require("body-parser");
var express = require("express");
var app = express();
const nodemailer = require("nodemailer");
const process = require("process");
var xhub = require("express-x-hub");
const bizSdk = require("facebook-nodejs-business-sdk");
let redispkg = require("redis");
let redis = redispkg.createClient(process.env.REDIS_URL);

const YOUR_EMAIL_ADDRESS = "leads@adfusion.cloud";
const SEND_TO = ["jordin@kelley-law.net", "adam@adfusion.cloud", "sam@adfusion.cloud"];
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    type: "OAuth2",
    user: YOUR_EMAIL_ADDRESS,
    serviceClient: process.env.CLIENT_ID,
    privateKey: process.env.PRIVATE_KEY,
  },
});

const Lead = bizSdk.Lead;

const access_token = process.env.FACEBOOK_TOKEN;
const api = bizSdk.FacebookAdsApi.init(access_token);
const showDebugingInfo = true; // Setting this to true shows more debugging info.
if (showDebugingInfo) {
  api.setDebug(true);
}



app.set("port", process.env.PORT || 5000);
app.listen(app.get("port"));

app.use(xhub({ algorithm: "sha1", secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

var token = process.env.TOKEN || "token";

app.get("/", function (req, res) {
  console.log(req);
  res.send("<pre>" + JSON.stringify(received_updates, null, 2) + "</pre>");
});

app.get(["/facebook", "/instagram"], function (req, res) {
  if (
    req.query["hub.mode"] == "subscribe" &&
    req.query["hub.verify_token"] == token
  ) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(400);
  }
});

app.post("/facebook", async function (req, res) {
  console.log("Facebook request body:", req.body);

  // Process the Facebook updates here
  redis.get("leads", (leads) => {
    leads = JSON.parse(leads)
    if (leads == null) {
      redis.set("leads", JSON.stringify([req.body]));
    } else {
      leads.push(req.body);
      redis.set("leads", JSON.stringify(leads));
    }
  });

  new Lead(req.body.entry[0].changes[0].value.leadgen_id)
    .get()
    .then(async (data) => {
      try {
        await transporter.verify();
        await transporter.sendMail({
          from: YOUR_EMAIL_ADDRESS,
          to: SEND_TO,
          subject: "Lead Form",
          text: `There is a new lead from ${data.field_data[0].values[0]} and their phone number is ${data.field_data[1].values[0]}. `,
        });
      } catch (err) {
        console.error(err);
      }
    });

  res.sendStatus(200);
});

app.post("/instagram", function (req, res) {
  console.log("Instagram request body:");
  console.log(req.body);
  // Process the Instagram updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.listen(8080);
