const Router = require("@koa/router");
const handlebars = require("handlebars");
const path = require("path");
const fs = require("fs");
const client = require('twilio');
const { koaBody } = require("koa-body");

const router = new Router();

router.use(koaBody({
  multipart: true,
  formidable: {
    uploadDir: path.join(__dirname, '../../uploads'),
    keepExtensions: true,
  }
}));

router.get("/sms", async (ctx) => {
  if (!ctx.state.user) return ctx.redirect("/login");

  const template_path = path.join(__dirname, `index.html`);
  const template_str = fs.readFileSync(template_path, "utf-8");
  const template = handlebars.compile(template_str);

  ctx.type = "html";
  ctx.body = template();
});

// POST route for sending SMS
router.post("/sms", async (ctx) => {
  if (!ctx.state.user) {
    ctx.status = 401; // Unauthorized
    ctx.body = { error: "User not authenticated" };
    return;
  }

  const { to, text } = ctx.request.body; 

  if (!to || !text) {
    ctx.status = 400; // Bad Request
    ctx.body = { error: "Missing 'to' or 'text' in request" };
    return;
  }

  try {
    const accountSid = ctx.state.user.twilio_sid;
    const authToken = ctx.state.user.twilio_auth;
    const twilioClient = client(accountSid, authToken);

    console.log('hehe');

    const message = await twilioClient.messages.create({
      body: text,
      from: ctx.state.user.phone,
      to: to,
    });

    console.log(`Message sent with SID: ${message.sid}`);
    ctx.status = 200; // OK
    ctx.body = { success: true, messageSid: message.sid };
  } catch (error) {
    console.error('Error sending message:', error);
    ctx.status = 500; // Internal Server Error
    ctx.body = { error: "Failed to send SMS" };
  }
});

module.exports = router;
