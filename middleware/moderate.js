const axios = require('axios');

// const blocklist = ['scary', 'fight', 'hurt', 'kill', 'violence'];

// Basic blocklist filter (free)
const blocklist = ['scary', 'fight', 'hurt', 'kill', 'violence'];

const moderate = (req, res, next) => {
  const { prompt } = req.body;
  

  if (blocklist.some(word => prompt?.toLowerCase().includes(word))) {
    return res.status(400).json({ error: 'Please try a happier idea!' });
  }

  next();
};



module.exports = moderate;