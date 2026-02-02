import express from 'express';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import { calculateProfile } from '../services/profileService.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.post('/calibrate', async (req, res) => {
  try {
    const { user_id, email, answers, language, name } = req.body;

    if (!user_id || !email || !answers) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const calculatedProfile = calculateProfile(answers);

    // Get user's name if not provided in request
    let userName = name || '';
    if (!userName) {
      const user = await User.findOne({ email: email.toLowerCase() });
      userName = user?.name || '';
    }

    let profile = await UserProfile.findOne({ user_id });

    if (profile) {
      Object.assign(profile, calculatedProfile);
      profile.language = language || 'en';
      profile.name = userName || profile.name;
      await profile.save();
    } else {
      profile = await UserProfile.create({
        user_id,
        email,
        name: userName,
        language: language || 'en',
        ...calculatedProfile
      });
    }

    res.json(profile);
  } catch (error) {
    console.error('Calibration error:', error);
    res.status(500).json({ error: 'Failed to calibrate profile' });
  }
});

router.get('/:user_id', async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user_id: req.params.user_id });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.put('/:user_id', async (req, res) => {
  try {
    const profile = await UserProfile.findOneAndUpdate(
      { user_id: req.params.user_id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/', async (req, res) => {
  try {
    const profiles = await UserProfile.aggregate([
      {
        $addFields: {
          total_xp: {
            $add: [
              { $ifNull: ["$xp_risk_taker", 0] },
              { $ifNull: ["$xp_analyst", 0] },
              { $ifNull: ["$xp_builder", 0] },
              { $ifNull: ["$xp_strategist", 0] }
            ]
          }
        }
      },
      { $sort: { total_xp: -1, total_arenas_completed: -1 } },
      { $limit: 100 }
    ]);

    res.json(profiles);
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: 'Failed to get profiles' });
  }
});

export default router;
