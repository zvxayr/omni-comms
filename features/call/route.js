const Router = require("@koa/router");
const twilio = require("twilio"); // Import Twilio library
const path = require("path");
const fs = require("fs");
const handlebars = require("handlebars");

const router = new Router();

// GET endpoint to render the HTML template
router.get("/call", async (ctx) => {
  if (!ctx.state.user) return ctx.redirect("/login");

  const template_path = path.join(__dirname, `index.hbs`);
  const template_str = fs.readFileSync(template_path, "utf-8");
  const template = handlebars.compile(template_str);

  ctx.type = "html";
  ctx.body = template({ user: ctx.state.user });
});

// POST endpoint for Twilio TwiML
router.post("/call", async (ctx) => {
  // Notify the client about an incoming call
  ctx.io.emit('initiate_call', { message: 'Incoming call...' });

  const twiml = new twilio.twiml.VoiceResponse();

  // Use <Record> to capture the caller's voice
  twiml.say("Please leave a message after the beep.");
  
  // Record the caller's message
  twiml.record({
    action: '/handle-recording',
    method: 'POST',
    maxLength: 30,
  });

  // Respond with the TwiML
  ctx.type = "text/xml";
  ctx.body = twiml.toString();
});

// Endpoint to handle the recorded audio
router.post('/handle-recording', async (ctx) => {
  const recordingUrl = ctx.request.body.RecordingUrl; // Get the URL of the recorded audio

  const twiml = new twilio.twiml.VoiceResponse();
  
  // Play back the recorded message
  twiml.say("Goodbye.");
  // twiml.play(recordingUrl);

  ctx.io.to('accept_call').emit('receive_call', {audioUrl: recordingUrl});

  ctx.type = "text/xml";
  ctx.body = twiml.toString();
});

module.exports = router;