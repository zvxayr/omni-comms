const Router = require("@koa/router");
const handlebars = require("handlebars");
const path = require("path");
const fs = require("fs");

const router = new Router();

const db = require("../../db");

async function authenticateUser(username, password) {
  // Query the database for the user by username
  const user = await new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.password !== password) {
    throw new Error("Invalid password");
  }

  return user;
}

router.get("/login", async (ctx) => {
  if (ctx.state.user) return ctx.redirect("/");

  const template_path = path.join(__dirname, `index.html`);
  const template_str = fs.readFileSync(template_path, "utf-8");
  const template = handlebars.compile(template_str);

  ctx.type = "html";
  ctx.body = template();
});

router.post("/login", async (ctx) => {
  // Extract username and password from the request body
  const { username, password } = ctx.request.body;

  try {
    const user = await authenticateUser(username, password);
    ctx.status = 200;
    ctx.cookies.set("user", user.id);
    ctx.redirect("/");
  } catch (error) {
    ctx.status = 401; // Unauthorized
    ctx.body = {
      err: error.message,
    };
  }
});

module.exports = router;
