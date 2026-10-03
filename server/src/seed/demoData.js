import { User } from '../models/User.js';
import { Question } from '../models/Question.js';
import { CurrentAffair } from '../models/GamificationModels.js';
import { ensureInitialTaxonomy } from '../services/taxonomyService.js';
import bcrypt from 'bcryptjs';

export const seedInitialData = async () => {
  try {
    await ensureInitialTaxonomy();
    const adminExists = await User.findOne({ role: 'ADMIN' });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const adminPass = await bcrypt.hash('admin123', salt);
      const studentPass = await bcrypt.hash('student123', salt);

      await User.create({
        name: 'Super Admin',
        email: 'admin@shakti.com',
        password: adminPass,
        role: 'ADMIN',
        targetExams: ['SSC CGL', 'UPSI'],
        xp: 1500,
        level: 4
      });

      await User.create({
        name: 'Shakti Student',
        email: 'student@shakti.com',
        password: studentPass,
        role: 'STUDENT',
        targetExams: ['SSC CGL', 'UP Police', 'Railway NTPC'],
        xp: 650,
        level: 2,
        streak: 7
      });

      console.log('[Seed] Created default Admin (admin@shakti.com / admin123) and Student (student@shakti.com / student123)');
    }

    const questionCount = await Question.countDocuments();
    if (questionCount === 0) {
      const demoQuestions = [
        // POLITY
        {
          question: 'Which article of the Indian Constitution provides for the impeachment procedure of the President of India?',
          options: ['Article 52', 'Article 61', 'Article 72', 'Article 123'],
          correctAnswer: 1,
          explanation: 'Article 61 lays down the detailed procedure for the impeachment of the President of India for violation of the Constitution.',
          subject: 'Indian Polity',
          topic: 'President',
          exam: 'SSC CGL',
          examYear: 2023,
          difficulty: 'Hard',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        },
        {
          question: 'Under which Fundamental Right is the "Prohibition of employment of children in factories" specified?',
          options: ['Right to Equality', 'Right to Freedom', 'Right against Exploitation', 'Right to Freedom of Religion'],
          correctAnswer: 2,
          explanation: 'Article 24 under Right against Exploitation prohibits employment of children under 14 in hazardous factories and mines.',
          subject: 'Indian Polity',
          topic: 'Fundamental Rights',
          exam: 'UP Police',
          examYear: 2024,
          difficulty: 'Medium',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        },
        // HISTORY
        {
          question: 'Who among the following was the founder of the Mauryan Empire in Ancient India?',
          options: ['Ashoka the Great', 'Chandragupta Maurya', 'Bindusara', 'Bimbisara'],
          correctAnswer: 1,
          explanation: 'Chandragupta Maurya founded the Mauryan Empire in 322 BCE with the strategic assistance of Chanakya (Kautilya).',
          subject: 'History',
          topic: 'Mauryan Empire',
          exam: 'SSC CHSL',
          examYear: 2022,
          difficulty: 'Easy',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        },
        {
          question: 'The famous "Poona Pact" of 1932 was signed between Mahatma Gandhi and which political leader?',
          options: ['Subhash Chandra Bose', 'Dr. B.R. Ambedkar', 'Jawaharlal Nehru', 'Sardar Vallabhbhai Patel'],
          correctAnswer: 1,
          explanation: 'The Poona Pact was signed on 24 September 1932 between Dr. B.R. Ambedkar and Mahatma Gandhi regarding electoral representation for depressed classes.',
          subject: 'History',
          topic: 'Freedom Movement',
          exam: 'UPSSSC PET',
          examYear: 2023,
          difficulty: 'Medium',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        },
        // GEOGRAPHY
        {
          question: 'Which Indian river crosses the Tropic of Cancer twice during its course?',
          options: ['Narmada River', 'Mahi River', 'Tapti River', 'Chambal River'],
          correctAnswer: 1,
          explanation: 'Mahi River in Western India originates in Madhya Pradesh, flows through Rajasthan and Gujarat, crossing the Tropic of Cancer twice.',
          subject: 'Geography',
          topic: 'Rivers',
          exam: 'Railway NTPC',
          examYear: 2021,
          difficulty: 'Hard',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        },
        // ECONOMICS
        {
          question: 'Which institution serves as the Central Bank of India and regulates monetary policy?',
          options: ['State Bank of India', 'Reserve Bank of India', 'NABARD', 'NITI Aayog'],
          correctAnswer: 1,
          explanation: 'The Reserve Bank of India (RBI), established under RBI Act 1934, is India’s central banking and monetary authority.',
          subject: 'Economics',
          topic: 'RBI',
          exam: 'IBPS PO',
          examYear: 2023,
          difficulty: 'Easy',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        },
        // SCIENCE
        {
          question: 'What is the chemical name of common household baking soda?',
          options: ['Sodium Carbonate', 'Sodium Bicarbonate', 'Calcium Carbonate', 'Sodium Chloride'],
          correctAnswer: 1,
          explanation: 'Baking soda is chemically known as Sodium Bicarbonate with chemical formula NaHCO3.',
          subject: 'Science',
          topic: 'Chemistry',
          exam: 'SSC MTS',
          examYear: 2023,
          difficulty: 'Easy',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        },
        // COMPUTER
        {
          question: 'In computer networking, what does the abbreviation HTTP stand for?',
          options: ['Hypertext Transfer Protocol', 'High Technical Transfer Program', 'Hyperlink Terminal Text Process', 'Home Transfer Protocol'],
          correctAnswer: 0,
          explanation: 'HTTP stands for Hypertext Transfer Protocol used for data transmission over the web.',
          subject: 'Computer',
          topic: 'Internet & Networking',
          exam: 'Railway ALP',
          examYear: 2024,
          difficulty: 'Easy',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        },
        // MATHEMATICS
        {
          question: 'If the price of petrol increases by 25%, by what percentage must a motorist reduce consumption so that expenditure remains unchanged?',
          options: ['15%', '20%', '25%', '30%'],
          correctAnswer: 1,
          explanation: 'Required percentage reduction = [r / (100 + r)] * 100 = [25 / 125] * 100 = 20%.',
          subject: 'Mathematics',
          topic: 'Percentage',
          exam: 'SSC CGL',
          examYear: 2023,
          difficulty: 'Medium',
          sourceType: 'VERIFIED_PYQ',
          verified: true,
          status: 'PUBLISHED'
        }
      ];

      await Question.insertMany(demoQuestions);
      console.log(`[Seed] Seeded ${demoQuestions.length} verified PYQ exam questions across Polity, History, Geography, Science, Economics, Computer, and Maths.`);
    }

    const affairsCount = await CurrentAffair.countDocuments();
    if (affairsCount === 0) {
      await CurrentAffair.create({
        title: 'G20 Digital Economy Initiative & India AI Governance Framework',
        category: 'Science & Technology',
        topic: 'AI and Digital Infrastructure',
        summary: 'India presented its open digital public infrastructure framework focusing on ethical AI deployment and inclusive education technology.',
        question: 'Which country chaired the Global Partnership on Artificial Intelligence (GPAI) summit focusing on digital public infrastructure?',
        options: ['India', 'France', 'Japan', 'Brazil'],
        correctAnswer: 0,
        explanation: 'India assumed the lead chair of GPAI promoting democratized AI for developing nations.',
        verified: true
      });
    }
  } catch (err) {
    console.error('[Seed Error]', err.message);
  }
};
