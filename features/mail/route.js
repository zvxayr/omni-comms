const Router = require("@koa/router");
const handlebars = require("handlebars");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const Imap = require("imap");
const { simpleParser } = require("mailparser");
const { koaBody } = require("koa-body");

const router = new Router();

router.use(koaBody({
  multipart: true,
  formidable: {
    uploadDir: path.join(__dirname, '../../uploads'),
    keepExtensions: true,
  }
}));

async function getEmails(ctx) {
  const imapConfig = {
    user: ctx.state.user.email,
    password: ctx.state.user.email_pass,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  };

  const imap = new Imap(imapConfig);

  return new Promise((resolve, reject) => {
    imap.once("ready", () => {
      console.log("Connection ready!");
      imap.openBox("INBOX", false, (err) => {
        if (err) throw err;

        imap.search(
          ["UNSEEN", ["SINCE", new Date().toISOString()]],
          (err, results) => {
            if (err) throw err;

            if (!results.length) {
              console.log("No unseen messages found.");
              imap.end();
              return resolve([]);
            }

            const mails = [];
            const f = imap.fetch(results, { bodies: "" });
            f.on("message", (msg) => {
              msg.on("body", (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) console.error("Parsing error:", err);
                  mails.push(parsed);
                });
              });
            });

            f.once("error", (ex) => {
              console.error("Fetch error:", ex);
            });

            f.once("end", () => {
              console.log(`Done fetching ${mails.length} messages!`);
              mails.forEach(mail => console.log(mail.attachments));
              resolve(mails);
              imap.end();
            });
          }
        );
      });
    });

    imap.once("error", (err) => {
      reject(err);
    });

    imap.once("end", () => {
      console.log("Connection ended.");
    });

    imap.connect();
  });
}

router.get("/mail", async (ctx) => {
  if (!ctx.state.user) return ctx.redirect("/login");

  const template_path = path.join(__dirname, `index.hbs`);
  const template_str = fs.readFileSync(template_path, "utf-8");
  const template = handlebars.compile(template_str);

  ctx.type = "html";
  ctx.body = template({ mails: await getEmails(ctx) });
});

async function sendEmail(ctx, to, subject, text, attachments) {
  // Create a transporter object using Gmail service
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: ctx.state.user.email,
      pass: ctx.state.user.email_pass,
    },
  });

  // Setup email data
  const mailOptions = {
    from: ctx.state.user.email,
    to,
    subject,
    text,
    attachments // Add attachments here
  };

  await new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      }
      resolve(info);
    });
  });
}

// Add the send-email route
router.post("/send-email", async (ctx) => {
  if (!ctx.state.user) return ctx.redirect("/login");

  const { to, subject, text } = ctx.request.body;
  
  // Access attachments from the request
  const attachments = ctx.request.files ? Object.values(ctx.request.files).map(file => ({
    filename: file.originalFilename,
    path: file.path // Path to the uploaded file
  })) : [];

  console.log(attachments);

  // Basic validation
  if (!to || !subject || !text) {
    ctx.status = 400; // Bad Request
    ctx.body = { error: "All fields are required." };
    return;
  }

  try {
    await sendEmail(ctx, to, subject, text, attachments);
    ctx.status = 200;
    ctx.body = { success: "Email sent successfully!" };
  } catch (error) {
    console.error("Error sending email:", error);
    ctx.status = 500; // Internal Server Error
    ctx.body = { error: "Failed to send email." };
  }
});

module.exports = router;
