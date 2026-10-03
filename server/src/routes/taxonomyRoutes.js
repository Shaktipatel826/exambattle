import express from 'express';
import { Subject } from '../models/Subject.js';
import { SubSubject } from '../models/SubSubject.js';
import { Topic } from '../models/Topic.js';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { authMiddleware, adminGuard } from '../middleware/auth.js';
import { slugify, ensureInitialTaxonomy } from '../services/taxonomyService.js';

const router = express.Router();

// Helper to count question usage
const getQuestionCountForFilter = async (filter) => {
  try {
    return await Question.countDocuments(filter);
  } catch (e) {
    return 0;
  }
};

// ==================================================
// PUBLIC / STUDENT DYNAMIC TAXONOMY ENDPOINTS
// ==================================================

router.get('/managed', async (req, res) => {
  try {
    await ensureInitialTaxonomy();

    const subjects = await Subject.find({ active: true }).sort({ name: 1 }).lean();
    const subSubjects = await SubSubject.find({ active: true }).sort({ name: 1 }).lean();
    const topics = await Topic.find({ active: true }).sort({ name: 1 }).lean();
    const exams = await Exam.find({ active: true }).sort({ category: 1, name: 1 }).lean();

    return res.json({
      success: true,
      subjects,
      subSubjects,
      topics,
      exams
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==================================================
// ADMIN TAXONOMY MANAGEMENT ENDPOINTS
// ==================================================

// --- 1. SUBJECTS MANAGEMENT ---
router.get('/admin/subjects', authMiddleware, adminGuard, async (req, res) => {
  try {
    await ensureInitialTaxonomy();
    const subjects = await Subject.find({}).sort({ createdAt: -1 }).lean();

    const result = await Promise.all(subjects.map(async (s) => {
      const questionCount = await getQuestionCountForFilter({ subject: s.name });
      const subSubjectCount = await SubSubject.countDocuments({ subjectId: s._id.toString() });
      const topicCount = await Topic.countDocuments({ subjectId: s._id.toString() });
      return {
        ...s,
        questionCount,
        subSubjectCount,
        topicCount
      };
    }));

    return res.json({ success: true, subjects: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/subjects', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { name, code, description, icon } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Subject name is required.' });
    }

    const trimmedName = name.trim();
    const existing = await Subject.findOne({ name: { $regex: `^${trimmedName}$`, $options: 'i' } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Subject "${trimmedName}" already exists.` });
    }

    const subject = await Subject.create({
      name: trimmedName,
      slug: slugify(trimmedName),
      code: code ? code.trim().toUpperCase() : slugify(trimmedName).toUpperCase(),
      description: description || '',
      icon: icon || 'BookOpen',
      active: true
    });

    return res.status(201).json({ success: true, message: 'Subject created successfully!', subject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/subjects/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const { name, code, description, icon, active } = req.body;
    if (name && name.trim() !== subject.name) {
      const duplicate = await Subject.findOne({ _id: { $ne: req.params.id }, name: { $regex: `^${name.trim()}$`, $options: 'i' } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Another subject named "${name.trim()}" already exists.` });
      }
      subject.name = name.trim();
      subject.slug = slugify(name.trim());
    }

    if (code !== undefined) subject.code = code.trim().toUpperCase();
    if (description !== undefined) subject.description = description;
    if (icon !== undefined) subject.icon = icon;
    if (active !== undefined) subject.active = !!active;

    await subject.save();
    return res.json({ success: true, message: 'Subject updated successfully!', subject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/subjects/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    // Soft delete to prevent breaking existing questions
    subject.active = false;
    await subject.save();
    return res.json({ success: true, message: 'Subject deactivated successfully (Soft Delete).', subject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- 2. SUB SUBJECTS MANAGEMENT ---
router.get('/admin/sub-subjects', authMiddleware, adminGuard, async (req, res) => {
  try {
    const subSubjects = await SubSubject.find({}).sort({ createdAt: -1 }).lean();
    const subjects = await Subject.find({}).lean();
    const subMap = new Map(subjects.map(s => [s._id.toString(), s.name]));

    const result = await Promise.all(subSubjects.map(async (ss) => {
      const parentName = subMap.get(ss.subjectId) || 'General';
      const questionCount = await getQuestionCountForFilter({ subSubject: ss.name });
      return {
        ...ss,
        subjectName: parentName,
        questionCount
      };
    }));

    return res.json({ success: true, subSubjects: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/sub-subjects', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { subjectId, name, description } = req.body;
    if (!subjectId || !name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Parent subjectId and SubSubject name required.' });
    }

    const trimmedName = name.trim();
    const duplicate = await SubSubject.findOne({
      subjectId,
      name: { $regex: `^${trimmedName}$`, $options: 'i' }
    });

    if (duplicate) {
      return res.status(400).json({ success: false, message: `SubSubject "${trimmedName}" already exists for this subject.` });
    }

    const subSubject = await SubSubject.create({
      subjectId,
      name: trimmedName,
      slug: slugify(trimmedName),
      description: description || '',
      active: true
    });

    return res.status(201).json({ success: true, message: 'SubSubject created successfully!', subSubject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/sub-subjects/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const subSubject = await SubSubject.findById(req.params.id);
    if (!subSubject) {
      return res.status(404).json({ success: false, message: 'SubSubject not found.' });
    }

    const { subjectId, name, description, active } = req.body;
    const targetSubjectId = subjectId || subSubject.subjectId;
    const targetName = name ? name.trim() : subSubject.name;

    if (name || subjectId) {
      const duplicate = await SubSubject.findOne({
        _id: { $ne: req.params.id },
        subjectId: targetSubjectId,
        name: { $regex: `^${targetName}$`, $options: 'i' }
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Another SubSubject named "${targetName}" already exists in this subject.` });
      }
    }

    if (subjectId) subSubject.subjectId = subjectId;
    if (name) {
      subSubject.name = targetName;
      subSubject.slug = slugify(targetName);
    }
    if (description !== undefined) subSubject.description = description;
    if (active !== undefined) subSubject.active = !!active;

    await subSubject.save();
    return res.json({ success: true, message: 'SubSubject updated successfully!', subSubject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/sub-subjects/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const subSubject = await SubSubject.findById(req.params.id);
    if (!subSubject) {
      return res.status(404).json({ success: false, message: 'SubSubject not found.' });
    }
    subSubject.active = false;
    await subSubject.save();
    return res.json({ success: true, message: 'SubSubject deactivated successfully.', subSubject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- 3. TOPICS MANAGEMENT ---
router.get('/admin/topics', authMiddleware, adminGuard, async (req, res) => {
  try {
    const topics = await Topic.find({}).sort({ createdAt: -1 }).lean();
    const subjects = await Subject.find({}).lean();
    const subSubjects = await SubSubject.find({}).lean();

    const subMap = new Map(subjects.map(s => [s._id.toString(), s.name]));
    const subSubMap = new Map(subSubjects.map(ss => [ss._id.toString(), ss.name]));

    const result = await Promise.all(topics.map(async (t) => {
      const subjectName = subMap.get(t.subjectId) || 'General';
      const subSubjectName = t.subSubjectId ? subSubMap.get(t.subSubjectId) : '';
      const questionCount = await getQuestionCountForFilter({ topic: t.name });
      return {
        ...t,
        subjectName,
        subSubjectName,
        questionCount
      };
    }));

    return res.json({ success: true, topics: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/topics', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { subjectId, subSubjectId, name, description } = req.body;
    if (!subjectId || !name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Parent subjectId and Topic name required.' });
    }

    const trimmedName = name.trim();
    const duplicate = await Topic.findOne({
      subjectId,
      name: { $regex: `^${trimmedName}$`, $options: 'i' }
    });

    if (duplicate) {
      return res.status(400).json({ success: false, message: `Topic "${trimmedName}" already exists for this subject.` });
    }

    const topic = await Topic.create({
      subjectId,
      subSubjectId: subSubjectId || '',
      name: trimmedName,
      slug: slugify(trimmedName),
      description: description || '',
      active: true
    });

    return res.status(201).json({ success: true, message: 'Topic created successfully!', topic });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/topics/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found.' });
    }

    const { subjectId, subSubjectId, name, description, active } = req.body;
    const targetSubjectId = subjectId || topic.subjectId;
    const targetName = name ? name.trim() : topic.name;

    if (name || subjectId) {
      const duplicate = await Topic.findOne({
        _id: { $ne: req.params.id },
        subjectId: targetSubjectId,
        name: { $regex: `^${targetName}$`, $options: 'i' }
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Another Topic named "${targetName}" already exists in this subject.` });
      }
    }

    if (subjectId) topic.subjectId = subjectId;
    if (subSubjectId !== undefined) topic.subSubjectId = subSubjectId;
    if (name) {
      topic.name = targetName;
      topic.slug = slugify(targetName);
    }
    if (description !== undefined) topic.description = description;
    if (active !== undefined) topic.active = !!active;

    await topic.save();
    return res.json({ success: true, message: 'Topic updated successfully!', topic });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/topics/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found.' });
    }
    topic.active = false;
    await topic.save();
    return res.json({ success: true, message: 'Topic deactivated successfully.', topic });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- 4. EXAMS MANAGEMENT ---
router.get('/admin/exams', authMiddleware, adminGuard, async (req, res) => {
  try {
    await ensureInitialTaxonomy();
    const exams = await Exam.find({}).sort({ category: 1, name: 1 }).lean();

    const result = await Promise.all(exams.map(async (ex) => {
      const questionCount = await getQuestionCountForFilter({ exam: ex.name });
      return {
        ...ex,
        questionCount
      };
    }));

    return res.json({ success: true, exams: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/exams', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { name, shortName, organization, category, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Exam name is required.' });
    }

    const trimmedName = name.trim();
    const existing = await Exam.findOne({ name: { $regex: `^${trimmedName}$`, $options: 'i' } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Exam "${trimmedName}" already exists.` });
    }

    const exam = await Exam.create({
      name: trimmedName,
      shortName: shortName ? shortName.trim() : trimmedName,
      organization: organization ? organization.trim() : '',
      category: ['SSC', 'Railway', 'Banking', 'UP State', 'Other'].includes(category) ? category : 'Other',
      description: description || '',
      active: true
    });

    return res.status(201).json({ success: true, message: 'Exam created successfully!', exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/exams/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    const { name, shortName, organization, category, description, active } = req.body;
    if (name && name.trim() !== exam.name) {
      const duplicate = await Exam.findOne({ _id: { $ne: req.params.id }, name: { $regex: `^${name.trim()}$`, $options: 'i' } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Another exam named "${name.trim()}" already exists.` });
      }
      exam.name = name.trim();
    }

    if (shortName !== undefined) exam.shortName = shortName.trim();
    if (organization !== undefined) exam.organization = organization.trim();
    if (category && ['SSC', 'Railway', 'Banking', 'UP State', 'Other'].includes(category)) exam.category = category;
    if (description !== undefined) exam.description = description;
    if (active !== undefined) exam.active = !!active;

    await exam.save();
    return res.json({ success: true, message: 'Exam updated successfully!', exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/exams/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }
    exam.active = false;
    await exam.save();
    return res.json({ success: true, message: 'Exam deactivated successfully (Soft Delete).', exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
