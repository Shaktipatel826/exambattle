import { Subject } from '../models/Subject.js';
import { SubSubject } from '../models/SubSubject.js';
import { Topic } from '../models/Topic.js';
import { Exam } from '../models/Exam.js';

export const slugify = (str = '') => {
  return str.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
};

const DEFAULT_SUBJECTS = [
  { name: 'Indian Polity', code: 'POLITY', description: 'Constitution, Parliament, Judiciary & Governance', icon: 'Shield' },
  { name: 'History', code: 'HISTORY', description: 'Ancient, Medieval & Modern Indian History', icon: 'BookOpen' },
  { name: 'Geography', code: 'GEOGRAPHY', description: 'Indian & World Physical, Social & Economic Geography', icon: 'Globe' },
  { name: 'Economics', code: 'ECONOMICS', description: 'Indian Economy, Banking, Budget & Inflation', icon: 'TrendingUp' },
  { name: 'General Science', code: 'SCIENCE', description: 'Physics, Chemistry, Biology & Science-Tech', icon: 'Atom' },
  { name: 'Computer Knowledge', code: 'COMPUTER', description: 'Fundamentals, Hardware, Networking & MS Office', icon: 'Cpu' },
  { name: 'Mathematics', code: 'MATHS', description: 'Arithmetic & Advanced Mathematics', icon: 'Calculator' },
  { name: 'General Knowledge & Static GK', code: 'GK', description: 'Static GK, UP GK, Sports & Current Affairs', icon: 'Award' },
  { name: 'Hindi Language', code: 'HINDI', description: 'Hindi Grammar, Literature & Comprehension', icon: 'FileText' },
  { name: 'English Language', code: 'ENGLISH', description: 'English Grammar, Vocabulary & Reading Comprehension', icon: 'Languages' }
];

const DEFAULT_EXAMS = [
  { name: 'SSC CGL', shortName: 'CGL', organization: 'Staff Selection Commission', category: 'SSC', description: 'Combined Graduate Level Examination' },
  { name: 'SSC CHSL', shortName: 'CHSL', organization: 'Staff Selection Commission', category: 'SSC', description: 'Combined Higher Secondary Level' },
  { name: 'SSC MTS', shortName: 'MTS', organization: 'Staff Selection Commission', category: 'SSC', description: 'Multi-Tasking Staff' },
  { name: 'SSC GD', shortName: 'GD', organization: 'Staff Selection Commission', category: 'SSC', description: 'General Duty Constable' },
  { name: 'Railway NTPC', shortName: 'NTPC', organization: 'Indian Railways', category: 'Railway', description: 'Non-Technical Popular Categories' },
  { name: 'Railway ALP', shortName: 'ALP', organization: 'Indian Railways', category: 'Railway', description: 'Assistant Loco Pilot' },
  { name: 'Railway Group D', shortName: 'Group D', organization: 'Indian Railways', category: 'Railway', description: 'Level 1 Posts' },
  { name: 'IBPS PO / Clerk', shortName: 'IBPS', organization: 'IBPS', category: 'Banking', description: 'Probationary Officer & Clerk' },
  { name: 'SBI PO / Clerk', shortName: 'SBI', organization: 'State Bank of India', category: 'Banking', description: 'PO & Clerk Recruitment' },
  { name: 'UPSSSC PET', shortName: 'UP PET', organization: 'UPSSSC', category: 'UP State', description: 'Preliminary Eligibility Test' },
  { name: 'UP Police Constable', shortName: 'UP Constable', organization: 'UP PRPB', category: 'UP State', description: 'Uttar Pradesh Police Constable' },
  { name: 'UPSI', shortName: 'UPSI', organization: 'UP PRPB', category: 'UP State', description: 'UP Police Sub Inspector' },
  { name: 'UP Lekhpal', shortName: 'Lekhpal', organization: 'UPSSSC', category: 'UP State', description: 'Revenue Lekhpal Recruitment' }
];

/**
 * Ensures initial default taxonomy exists in DB
 */
export const ensureInitialTaxonomy = async () => {
  try {
    for (const sub of DEFAULT_SUBJECTS) {
      const exists = await Subject.findOne({ name: sub.name });
      if (!exists) {
        await Subject.create({
          ...sub,
          slug: slugify(sub.name),
          active: true
        });
      }
    }

    for (const ex of DEFAULT_EXAMS) {
      const exists = await Exam.findOne({ name: ex.name });
      if (!exists) {
        await Exam.create({
          ...ex,
          active: true
        });
      }
    }
  } catch (err) {
    console.warn('[Taxonomy Service Initialization Warning]', err.message);
  }
};
