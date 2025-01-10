// Import required modules
const Koa = require("koa");
const serve = require("koa-static");
const bodyParser = require("koa-bodyparser");
const compose = require("koa-compose");
const { Server } = require("socket.io");
const path = require("path");

const app = new Koa();


const http = require("http");

const server = http.createServer(app.callback());
const io = new Server(server);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("A user connected");

  // Handle user joining a chat room
  socket.on("joinRoom", (chatRoomId) => {
    console.log("user joined: " + chatRoomId);
    socket.join(chatRoomId);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

app.context.io = io;

app.use(bodyParser());

// Logger middleware
app.use(async (ctx, next) => {
  const start = Date.now(); // Record the start time
  await next(); // Pass control to the next middleware
  const ms = Date.now() - start; // Calculate the response time
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`); // Log method, URL, and response time
});

// Define the path to the static directory
const staticPath = path.join(__dirname, "public");
const uploadsPath = path.join(__dirname, "uploads");

// Serve static files
app.use(serve(staticPath));
app.use(serve(uploadsPath));

const db = require("./db");

async function getUserFromId(id) {
  const [err, row] = await new Promise((resolve) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) =>
      resolve([err, row])
    );
  });

  if (err) throw err;
  return row;
}

app.use(async (ctx, next) => {
  const userCookie = ctx.cookies.get("user");

  if (userCookie) {
    try {
      // Query the database for user details using the cookie value
      const user = await getUserFromId(userCookie);

      // If user is found, assign it to ctx.state.user
      if (user) {
        ctx.state.user = user;
      } else {
        ctx.state.user = null;
      }
    } catch (error) {
      console.error("Database query error:", error);
      ctx.status = 500;
      ctx.body = { error: "Internal Server Error" };
      return; // Stop further processing
    }
  }

  // Proceed to the next middleware
  await next();
});

app.use(async (ctx, next) => {
  try {
    await next();
    const status = ctx.status || 404;
    if (status === 404) {
      ctx.throw(404);
    }
  } catch (err) {
    ctx.status = err.status || 500;
    if (ctx.status === 404) {
      ctx.body = err.message;
    } else {
      ctx.body = err.message;
    }
  }
});

const routes = [];
const route_ = ["call", "chat", "home", "login", "logout", "mail", "sms"];
for (const route of route_) {
  const router_path = path.join(__dirname, 'features', route, 'route.js');
  const router = require(router_path);

  routes.push(router.routes());
  routes.push(router.allowedMethods());
}

// Apply the routes to the application
app.use(compose(routes));

// Define a port for the server to listen on
const PORT = process.env.PORT || 3000;

// Start the server
server.listen(3000, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});