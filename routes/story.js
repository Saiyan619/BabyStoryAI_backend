const express = require('express');
const axios = require('axios');
const Story = require('../models/Story');
const Settings = require('../models/Settings');
const moderate = require('../middleware/moderate');
const auth = require('../middleware/auth');
const router = express.Router();

//Generate story 
router.post('/generate', auth, moderate, async (req, res) => {
  try {
    const { prompt, userId } = req.body;

    if (userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const settings = await Settings.findOne({ userId });
    const promptLower = prompt.toLowerCase();
    const isAllowed = settings.allowedThemes.some(theme => promptLower.includes(theme.toLowerCase()));
    if (!isAllowed) {
      return res.status(400).json({ error: 'Prompt does not match allowed themes' });
    }

    const maxLength = settings.storyLength === 'short' ? 200 : settings.storyLength === 'medium' ? 400 : 600;
    const storyPrompt = `Write a fun, safe story for a 6-year-old about ${prompt}. Keep it happy, appropriate, and under ${maxLength} characters.`;
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      {
        contents: [
          {
            parts: [
              { text: storyPrompt },
            ],
          },
        ],
      },
      {
        params: { key: process.env.GEMINI_API_KEY },
      }
    );

    const storyText = response.data.candidates[0].content.parts[0].text;

    const theme = promptLower.includes('pirate') ? 'pirate' :
                  promptLower.includes('animal') ? 'animals' :
                  promptLower.includes('robot') ? 'robot' :
                  'fantasy';

    const story = new Story({
      userId,
      prompt,
      text: storyText,
      theme,
    });
    await story.save();

    res.json({ storyId: story._id, text: storyText, theme });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate story' });
  }
});


router.get('/:id', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (story.userId.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    res.json(story);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const stories = await Story.find({ userId: req.user.id });
    res.json(stories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

router.put('/:id/approve', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (story.userId.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    story.approved = true;
    await story.save();
    res.json(story);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to approve story' });
  }
});

module.exports = router;