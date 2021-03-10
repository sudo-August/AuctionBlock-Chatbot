/**
 * AuctionBlock
 *
 * 
 * 
 *
 */

'use strict';

// Use dotenv to read .env vars into Node
require('dotenv').config();

// Imports dependencies and set up http server
const
  request = require('request'),
  express = require('express'),
  { urlencoded, json } = require('body-parser'),
  { DynamoDBClient, ListTablesCommand } = require("@aws-sdk/client-dynamodb"),
  app = express();

// The page access token we have generated in your app settings
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Parse application/x-www-form-urlencoded
app.use(urlencoded({ extended: true }));

// Parse application/json
app.use(json());

// Respond with 'Hello World' when a GET request is made to the homepage
app.get('/', function (_req, res) {
  res.send('Hello World');
});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {

    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Creates the endpoint for your webhook
app.post('/webhook', (req, res) => {
  let body = req.body;

  // Checks if this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhookEvent = entry.messaging[0];
      console.log(webhookEvent);

      // Get the sender PSID
      let senderPsid = webhookEvent.sender.id;
      console.log('Sender PSID: ' + senderPsid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhookEvent.message) {
        console.log(webhookEvent.message)
        handleMessage(senderPsid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        handlePostback(senderPsid, webhookEvent.postback);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {

    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// BEGINNING OF WORKING AREA
// This is the area for us to work in


// API request to facebook for the users profile information
// first and last names and profile pic
async function getProfileInfoAPI(sender_psid) {
  const config = {
      withCredentials: true,
      crossdomain: true,
      method: 'get',
      url: "https://graph.facebook.com/"+sender_psid+"?fields=first_name,last_name,profile_pic&access_token="+PAGE_ACCESS_TOKEN,
      headers: { },
  };
  try {
      const res = await axios(config);
      let data = res.data;
      let profile = {
          "firstName": data['first_name'],
          "lastName": data.last_name,
          "profilePic": data.profile_pic,
      };
      return profile;
  } catch (error) {
      console.log(error)
  }
}


// NLP Section

// Handles responses to NLP Traits
function handleTrait(firstName, traitName) {

  switch (traitName) {
      case "wit$greetings":
          return {
              "text": `Well hello to you too, ${firstName}! How can I help you?`
          };
      case "wit$bye":
          return {
              "text": `Goodbye, ${firstName}!`
          };
      case "wit$thanks":
          return {
              "text": `You're most welcome, ${firstName}!`
          };
      default:
          return {
              "text": `You just sent a message, ${firstName}`
          };
  }
}


// Determines Intent and returns object with intent and notable entities
function determineIntent(intents, entities) {
  let primaryIntent, confidence, ents = [], x, y, z;
  // check the entites and use the one with the higher confidence
  for (x in intents) {
      if (primaryIntent != undefined) {
          if (intents[x].confidence > confidence) {
              primaryIntent = intents[x].name;
              confidence = intents[x].confidence;
          }
      } else {
          primaryIntent = intents[x].name;
          confidence = intents[x].confidence;
      }
  }
  for (y in entities) {
      for (z in entities[y]) {
          if (entities[y][z]['confidence'] > 0.5) {
              ents.push(entities[y][z])
          }
      }
  }
  let data = {
      intent: primaryIntent,
      confidence: confidence,
      entities: ents 
  }
  console.log(data)
  return data
}


async function handleIntent(intent) {
  console.log(intent.intent)
  switch (intent.intent) {
    case "learn_about_auction_block":
      return {
        "text": `Looks like you would like to learn about Auction Block`
      }
    case "create_new_auction_block":
      return {
        "text": `Create a new Auction`
      }
    case "participate_in_auction":
      return {
        "text": `Which auction would you like to participate in?`
      }
    default:
      return {
          "text": `my apologies. that intent isn't yet supported`
      }
  }
}


//    MARK - Database Area

// List database table
async function listDbTables() {
  const client = new DynamoDBClient({ region: "us-west-2" });
  const command = new ListTablesCommand({});
  try {
    const results = await client.send(command);
    console.log(results.TableNames.join("\n"));
  } catch (err) {
    console.error(err);
  }
}


// END OF WORKING AREA

// Handles messages events
async function handleMessage(senderPsid, receivedMessage) {
  let response;

  const profile = await getProfileInfoAPI(senderPsid);

  // Checks if the message contains text 
  if (receivedMessage.text) { 
    if (receivedMessage.nlp) {
      const intents = receivedMessage.nlp.intents;
      const entities = receivedMessage.nlp.entities;
      const traits = receivedMessage.nlp.traits;
      const nlpInfo = determineIntent(intents, entities);
  
      response = await handleIntent(nlpInfo)
  
      console.log(JSON.stringify(nlpInfo));
    } else {
      // Create the payload for a basic text message, which
      // will be added to the body of your request to the Send API
      response = {
        'text': `You sent the message: '${receivedMessage.text}'. Now send me an attachment!`
      };
    }
    // overrides for special commands
    switch (receivedMessage.text) {
      case 'who am i??':
        response = {
          'text': `why, you're ${senderPsid}, doncha know`
        }
      case 'show me the tables':
        listDbTables();
        response = {
          'text': 'now, you must know where to look...'
        }
      default:
        break;
    }
  } else if (receivedMessage.attachments) {

    // Get the URL of the message attachment
    let attachmentUrl = receivedMessage.attachments[0].payload.url;
    response = {
      'attachment': {
        'type': 'template',
        'payload': {
          'template_type': 'generic',
          'elements': [{
            'title': 'Is this the right picture?',
            'subtitle': 'Tap a button to answer.',
            'image_url': attachmentUrl,
            'buttons': [
              {
                'type': 'postback',
                'title': 'Yes!',
                'payload': 'yes',
              },
              {
                'type': 'postback',
                'title': 'No!',
                'payload': 'no',
              }
            ],
          }]
        }
      }
    };
  }

  // Send the response message
  callSendAPI(senderPsid, response);
}

// Handles messaging_postbacks events
function handlePostback(senderPsid, receivedPostback) {
  let response;

  // Get the payload for the postback
  let payload = receivedPostback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { 'text': 'Thanks!' };
  } else if (payload === 'no') {
    response = { 'text': 'Oops, try sending another image.' };
  }
  // Send the message to acknowledge the postback
  callSendAPI(senderPsid, response);
}

// Sends response messages via the Send API
function callSendAPI(senderPsid, response) {

  // Construct the message body
  let requestBody = {
    'recipient': {
      'id': senderPsid
    },
    'message': response
  };

  // Send the HTTP request to the Messenger Platform
  request({
    'uri': 'https://graph.facebook.com/v2.6/me/messages',
    'qs': { 'access_token': PAGE_ACCESS_TOKEN },
    'method': 'POST',
    'json': requestBody
  }, (err, _res, _body) => {
    if (!err) {
      console.log('Message sent!');
    } else {
      console.error('Unable to send message:' + err);
    }
  });
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
