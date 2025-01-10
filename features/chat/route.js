const Router = require("@koa/router");
const handlebars = require("handlebars");
const path = require("path");
const fs = require("fs");
const { koaBody } = require("koa-body");

const router = new Router();

handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

router.use(
  koaBody({
    multipart: true,
    formidable: {
      uploadDir: path.join(__dirname, "../../uploads"),
      keepExtensions: true,
    },
  })
);

const db = require("../../db");

async function getUserConnections(userId) {
  return new Promise((resolve, reject) => {
    const query = `
          SELECT u.id, u.username, u.phone, u.email
          FROM connections c
          JOIN users u ON (u.id = c.user2_id OR u.id = c.user1_id)
          WHERE (c.user1_id = ? OR c.user2_id = ?) AND u.id != ?;
      `;

    db.all(query, [userId, userId, userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getMessageAttachments(messageId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT url, type
      FROM attachments
      WHERE message_id = ?;
    `;

    db.all(query, [messageId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getUserChatRooms(userId) {
  return new Promise((resolve, reject) => {
    const query = `
          SELECT cr.id, cr.name
          FROM chat_rooms cr
          JOIN chat_room_members crm ON cr.id = crm.chat_room_id
          WHERE crm.user_id = ?;
      `;

    db.all(query, [userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getMessagesByChatRoomId(chatRoomId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT m.id, m.sender_id, m.content, u.username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_room_id = ?;
    `;

    db.all(query, [chatRoomId], async (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // For each message, fetch its attachments
        const messagesWithAttachments = await Promise.all(
          rows.map(async (message) => {
            const attachments = await getMessageAttachments(message.id);
            console.log(attachments);
            return { ...message, attachments }; // Add attachments to the message object
          })
        );

        resolve(messagesWithAttachments);
      }
    });
  });
}

router.get("/chat", async (ctx, next) => {
  if (!ctx.state.user) return ctx.redirect("/login");

  const chatRooms = await getUserChatRooms(ctx.state.user.id);
  if (chatRooms.length > 0) {
    ctx.redirect(`/chat/${chatRooms[0].id}`);
    return next();
  }

  const template_path = path.join(__dirname, `index.hbs`);
  const template_str = fs.readFileSync(template_path, "utf-8");
  const template = handlebars.compile(template_str);

  ctx.type = "html";
  ctx.body = template({
    user: ctx.state.user,
  });
});

function groupConsecutiveMessages(messages) {
  if (messages.length === 0) return [];

  const groupedMessages = [];
  let currentGroup = [messages[0]]; // Start with the first message

  for (let i = 1; i < messages.length; i++) {
    if (messages[i].sender_id === messages[i - 1].sender_id) {
      // If the sender is the same as the previous message, add to current group
      currentGroup.push(messages[i]);
    } else {
      // If the sender changes, push the current group and start a new one
      groupedMessages.push(currentGroup);
      currentGroup = [messages[i]];
    }
  }

  // Push the last group after finishing the loop
  groupedMessages.push(currentGroup);

  return groupedMessages;
}

router.get("/chat/:id", async (ctx, next) => {
  if (!ctx.state.user) return ctx.redirect("/login");

  const chatRooms = await getUserChatRooms(ctx.state.user.id);
  const messages = await getMessagesByChatRoomId(ctx.params.id);
  const groupedMessages = groupConsecutiveMessages(messages);

  const template_path = path.join(__dirname, `index.hbs`);
  const template_str = fs.readFileSync(template_path, "utf-8");
  const template = handlebars.compile(template_str);

  ctx.type = "html";
  ctx.body = template({
    user: ctx.state.user,
    chatRooms,
    messages: groupedMessages,
  });
});

async function createMessage(chatRoomId, senderId, content) {
  return new Promise((resolve, reject) => {
    const query = `
          INSERT INTO messages (chat_room_id, sender_id, content)
          VALUES (?, ?, ?);
      `;

    db.run(query, [chatRoomId, senderId, content], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID }); // Return the ID of the newly created message
      }
    });
  });
}

const extensionToTypeMap = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".gif": "image",
  ".bmp": "image",
  ".tiff": "image",
  ".pdf": "document",
  ".doc": "document",
  ".docx": "document",
  ".xls": "document",
  ".xlsx": "document",
  ".ppt": "document",
  ".pptx": "document",
  ".txt": "text",
  ".zip": "archive",
  ".rar": "archive",
  ".mp4": "video",
  ".avi": "video",
  ".mkv": "video",
  ".mp3": "audio",
  ".wav": "audio",
};

function deduceFileType(filename) {
  const extension = filename
    .slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2)
    .toLowerCase();

  return extensionToTypeMap[`.${extension}`] || "unknown"; // Default to 'unknown' if not found
}

async function createAttachment(messageId, url, type) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO attachments (message_id, url, type)
      VALUES (?, ?, ?);
    `;

    db.run(query, [messageId, url, type], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID }); // Return the ID of the newly created attachment
      }
    });
  });
}

router.post("/chat/:id", async (ctx) => {
  const { message } = ctx.request.body;
  const attachments = ctx.request.files.attachments;
  const chatRoomId = ctx.params.id; // Get the chat room ID from the URL
  const senderId = ctx.state.user.id; // Get the sender's user ID from the context

  console.log("Message:", message);

  try {
    // Insert the new message into the database
    const newMessage = await createMessage(chatRoomId, senderId, message);
    console.log("New Message ID:", newMessage.id);

    // Handle attachments if they exist
    const attachments_ = [];
    if (Array.isArray(attachments)) {
      for (const file of attachments) {
        // Create an attachment entry for each file
        const type = deduceFileType(file.newFilename);
        await createAttachment(newMessage.id, "/" + file.newFilename, type); // Assuming file.type contains the type of attachment
        attachments_.push({"url": "/" + file.newFilename, type});
        console.log("Attachment:", file.newFilename);
      }
    } else if (attachments) {
      // Handle single attachment case
      const type = deduceFileType(attachments.newFilename);
      await createAttachment(
        newMessage.id,
        "/" + attachments.newFilename,
        type
      );
      attachments_.push({"url": "/" + attachments.newFilename, type});
      console.log("Attachment:", attachments.newFilename);
    } else {
      console.log("No attachments.");
    }

    ctx.io.to(chatRoomId).emit("newMessage", {
      id: newMessage.id,
      content: message,
      senderId,
      username: ctx.state.user.username,
      timestamp: new Date(),
      attachments: attachments_
    });

    // Respond back to client
    ctx.status = 200;
    ctx.body = {
      message: "Message received",
      success: true,
      messageId: newMessage.id,
    };
  } catch (error) {
    console.error("Error creating message:", error);
    ctx.status = 500;
    ctx.body = { error: "Failed to send message" };
  }
});

module.exports = router;
