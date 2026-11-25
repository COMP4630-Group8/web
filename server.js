require('dotenv').config();

const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('./routes');
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

/* API Routes */
app.use('/', routes);

server.listen(port, async () => {
    await connectDB();
    console.log(`Server is live on Port ${port}`);
});