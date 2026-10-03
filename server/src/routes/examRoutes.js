import express from 'express';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { Exam } from '../models/Exam.js';
import { CurrentAffair } from '../models/GamificationModels.js';
import { ensureInitialTaxonomy } from '../services/taxonomyService.js';

const router = express.Router();

// Get All Subjects & Topics Taxonomy (Active Database Managed Taxonomy)
router.get('/taxonomy', async (req, res) => {
  try {
    await ensureInitialTaxonomy();

    const dbSubjects = await Subject.find({ active: true }).lean();
    const dbTopics = await Topic.find({ active: true }).lean();

    const topicMap = new Map();
    dbTopics.forEach(t => {
      if (!topicMap.has(t.subjectId)) topicMap.set(t.subjectId, []);
      topicMap.get(t.subjectId).push(t.name);
    });

    const taxonomy = dbSubjects.map(s => {
      const customTopics = topicMap.get(s._id.toString()) || [];
      const legacyTopics = s.topics || [];
      const combinedTopics = Array.from(new Set([...legacyTopics, ...customTopics]));

      return {
        _id: s._id,
        name: s.name,
        code: s.code || s.slug || s.name.toUpperCase(),
        description: s.description || '',
        icon: s.icon || 'BookOpen',
        topics: combinedTopics.length > 0 ? combinedTopics : ['General']
      };
    });

    return res.json({ success: true, taxonomy });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Get Supported Exams List (Active Database Managed Exams)
router.get('/exams-list', async (req, res) => {
  try {
    await ensureInitialTaxonomy();

    const dbExams = await Exam.find({ active: true }).sort({ category: 1, name: 1 }).lean();
    const exams = dbExams.map(e => ({
      _id: e._id,
      name: e.name,
      shortName: e.shortName || e.name,
      category: e.category || 'Other',
      organization: e.organization || '',
      description: e.description || ''
    }));

    return res.json({ success: true, exams });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Get Current Affairs Feed
router.get('/current-affairs', async (req, res) => {
  try {
    const affairs = await CurrentAffair.find({ verified: true }).sort({ date: -1 }).limit(20);
    return res.json({ success: true, currentAffairs: affairs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
