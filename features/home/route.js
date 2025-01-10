const Router = require("@koa/router");
const handlebars = require("handlebars");
const path = require("path");
const fs = require("fs");

const router = new Router();

router.get("/", async (ctx) => {
  if (!ctx.state.user) return ctx.redirect("/login");

  const template_path = path.join(__dirname, `index.hbs`);
  const template_str = fs.readFileSync(template_path, "utf-8");
  const template = handlebars.compile(template_str);

  ctx.type = "html";
  ctx.body = template({ user: ctx.state.user });
});

module.exports = router;
