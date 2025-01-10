const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

// Create tables
db.serialize(() => {
    // Create users table
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        email_pass TEXT,
        twilio_sid TEXT,
        twilio_auth TEXT
    )`); // email_pass should be replaced with Outh

    // Create connections table
    db.run(`CREATE TABLE connections (
        user1_id INTEGER,
        user2_id INTEGER,
        FOREIGN KEY (user1_id) REFERENCES users(id),
        FOREIGN KEY (user2_id) REFERENCES users(id)
    )`);

    // Create chat_rooms table
    db.run(`CREATE TABLE chat_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )`);

    // Create chat_room_members table
    db.run(`CREATE TABLE chat_room_members (
        chat_room_id INTEGER,
        user_id INTEGER,
        FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Create messages table with updated structure
    db.run(`CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_room_id INTEGER,
        sender_id INTEGER,
        content TEXT,
        FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
    )`);

    // Create attachments table
    db.run(`CREATE TABLE attachments (
        message_id INTEGER,
        url TEXT,
        type TEXT,
        FOREIGN KEY (message_id) REFERENCES messages(id)
    )`);

    // Prepopulate users
    const insertUser = db.prepare(`INSERT INTO users (username, password, phone, twilio_sid, twilio_auth, email, email_pass) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    insertUser.run("user1", "pass", "num1", "sid", "auth-token", "email@gmail.com", "pass");
    insertUser.run("user2", "pass", null, null, null, null, null);
    insertUser.finalize();

    // Prepopulate connections
    const insertConnection = db.prepare(`INSERT INTO connections (user1_id, user2_id) VALUES (?, ?)`);
    insertConnection.run(1, 2); // Assuming user1 has id 1 and user2 has id 2
    insertConnection.finalize();

    // Prepopulate a chat room
    const insertChatRoom = db.prepare(`INSERT INTO chat_rooms (name) VALUES (?)`);
    insertChatRoom.run("General Chat");
    insertChatRoom.finalize();

    // Prepopulate chat room members
    const insertChatRoomMember = db.prepare(`INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (?, ?)`);
    insertChatRoomMember.run(1, 1); // Assuming user1 has id 1
    insertChatRoomMember.run(1, 2); // Assuming user2 has id 2
    insertChatRoomMember.finalize();

    // Prepopulate a message in the chat room
    const insertMessage = db.prepare(`INSERT INTO messages (chat_room_id, sender_id, content) VALUES (?, ?, ?)`);
    insertMessage.run(1, 1, "Hello from user1!"); // Assuming from user1 in chat room 1
    insertMessage.finalize();

    // Prepopulate an attachment for the message
    const insertAttachment = db.prepare(`INSERT INTO attachments (message_id, url, type) VALUES (?, ?, ?)`);
    insertAttachment.run(1, "https://images4.fanpop.com/image/photos/17700000/Ash-ash-ketchum-17729805-640-480.jpg", "image");
    insertAttachment.finalize();
});

module.exports = db;
