const axios = require('axios');

const blocklist = ['scary', 'fight', 'hurt', 'kill', 'violence'];

const moderate = async (req, res, next) => {
  const { prompt } = req.body;

  if (blocklist.some(word => prompt.toLowerCase().includes(word))) {
    return res.status(400).json({ error: 'Please try a happier idea!' });
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/moderations',
      { input: prompt },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );

    if (response.data.results[0].flagged) {
      return res.status(400).json({ error: 'Please try a different idea!' });
    }

    next();
  } catch (error) {
    console.error('Moderation error:', error);
    res.status(500).json({ error: 'Moderation failed' });
  }
};

module.exports = moderate;