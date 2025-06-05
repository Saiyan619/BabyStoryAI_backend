const express = require('express');
const axios = require('axios');
const Story = require('../models/Story');
const Settings = require('../models/Settings');
const moderate = require('../middleware/moderate');
const auth = require('../middleware/auth');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const gTTS = require('gtts');
const cloudinary = require('cloudinary').v2;

//Generate story 
// router.post('/generate', auth, moderate, async (req, res) => {
//   try {
//     const { prompt } = req.body;
// const userId = req.user.id;

//   // Fetch settings for storyLength, use default if missing
//     let settings = await Settings.findOne({ userId });
//     if (!settings) {
//       console.log(`No settings found for userId: ${userId}, using default storyLength`);
//       settings = { storyLength: 'short' };
//     }
//     // const settings = await Settings.findOne({ userId });
//     // const promptLower = prompt.toLowerCase();
//     // const isAllowed = userId.allowedThemes.some(theme => promptLower.includes(theme.toLowerCase()));
//     // if (!isAllowed) {
//     //   return res.status(400).json({ error: 'Prompt does not match allowed themes' });
//     // }

//     const maxLength = userId.storyLength === 'short' ? 5000 : userId.storyLength === 'medium' ? 9000 : 12000;
//     const storyPrompt = `Write a fun, safe story for a 6-year-old about ${prompt}. Keep it happy, appropriate, and under ${maxLength} characters and also a coverbook image.`;
//     const response = await axios.post(
//       'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
//       {
//         contents: [
//           {
//             parts: [
//               { text: storyPrompt },
//             ],
//           },
//         ],
//       },
//       {
//         params: { key: process.env.GEMINI_API_KEY },
//       }
//     );

//     const storyText = response.data.candidates[0].content.parts[0].text;

//     // const theme = promptLower.includes('pirate') ? 'pirate' :
//     //               promptLower.includes('animal') ? 'animals' :
//     //               promptLower.includes('robot') ? 'robot' :
//     //               'fantasy';

//     const story = new Story({
//       userId,
//       prompt,
//       text: storyText,
//       // theme,
//     });
//     await story.save();

//     // res.json({ storyId: story._id, text: storyText, theme });
//     res.json({ storyId: story._id, text: storyText });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to generate story' });
//   }
// });

// routes/generate.js




// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post('/generate', auth, moderate, async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = req.user.id;
    console.log(userId)

    // Get user settings or default to short
    let settings = await Settings.findOne({ userId });
    if (!settings) {
      console.log(`No settings found for userId: ${userId}, using default storyLength`);
      settings = { storyLength: 'short' };
    } else {
      console.log(settings)
    }

    const maxLength =
      settings.storyLength === 'short'
        ? 5000
        : settings.storyLength === 'medium'
        ? 9000
        : 12000;

    // Generate story
    const storyPrompt = `Write a fun, safe story for a 6-year-old about ${prompt}. Keep it happy, appropriate, and under ${maxLength} characters. adn aslo remove this is your response:**Title:**"**Summary:**`;

    const geminiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{ parts: [{ text: storyPrompt }] }],
      },
      {
        params: { key: process.env.GEMINI_API_KEY },
      }
    );

    const storyText =
      geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Generate title and summary
    const metaPrompt = `Give a short, fun title and a 1-sentence summary for this story:\n\n${storyText}`;
    const metaResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{ parts: [{ text: metaPrompt }] }],
      },
      {
        params: { key: process.env.GEMINI_API_KEY },
      }
    );

    const metaText =
      metaResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const [titleLine, summaryLine] = metaText.split('\n').filter(Boolean);
    const title = titleLine?.replace(/^Title:\s*/i, '') || 'Untitled';
    const summary = summaryLine?.replace(/^Summary:\s*/i, '') || '';

   // Create local mp3 file
const audioFileName = `${uuidv4()}.mp3`;
const tmpDir = path.join(__dirname, '..', 'tmp');

// Ensure tmp directory exists
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const audioFilePath = path.join(tmpDir, audioFileName);

const gtts = new gTTS(storyText, 'en');
await new Promise((resolve, reject) => {
  gtts.save(audioFilePath, (err) => {
    if (err) return reject(err);
    resolve();
  });
});

    // Upload to Cloudinary
    const cloudinaryResult = await cloudinary.uploader.upload(audioFilePath, {
      resource_type: 'video', // Use 'video' for audio files
      folder: 'story-audio',
      public_id: audioFileName.split('.')[0],
    });

    // Delete local file
    fs.unlinkSync(audioFilePath);

    const audioUrl = cloudinaryResult.secure_url;

    // Save story to DB
    const story = new Story({
      userId,
      prompt,
      title,
      summary,
      text: storyText,
      audioUrl,
    });

    await story.save();

    res.json({
      storyId: story._id,
      title,
      summary,
      text: storyText,
      audioUrl,
    });
  } catch (error) {
    console.error('Error generating story:', error?.response?.data || error.message);
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

router.delete('/:id', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    // Only allow the creator to delete their story
    if (story.userId.toString() !== req.user.id)
      return res.status(403).json({ error: 'Unauthorized' });

    await story.remove(); // Or use Story.findByIdAndDelete(req.params.id)
    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});


module.exports = router;