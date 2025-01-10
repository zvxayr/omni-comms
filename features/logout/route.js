const Router = require("@koa/router");

const router = new Router();

router.get("/logout", (ctx) => {
  ctx.cookies.set("user", null);
  ctx.redirect("/login");
});

module.exports = router;
