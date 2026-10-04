import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { processAIContentJob } from '../services/ai/chunkProcessor.js';
import { AIJob } from '../models/AIJob.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const sampleLongTranscript = `
INDIAN POLITY AND CONSTITUTION COMPREHENSIVE LECTURE TRANSCRIPT

SECTION 1: PREAMBLE AND HISTORICAL BACKGROUND
The Preamble to the Constitution of India is based on the 'Objectives Resolution', drafted and moved by Pandit Jawaharlal Nehru on December 13, 1946, and adopted by the Constituent Assembly on January 22, 1947. The Preamble was amended only once by the 42nd Constitutional Amendment Act of 1976, which added three new words—Socialist, Secular, and Integrity. The Preamble declares India to be a Sovereign, Socialist, Secular, Democratic, Republic. The date of adoption mentioned in the Preamble is November 26, 1949.

In the Berubari Union case (1960), the Supreme Court held that the Preamble is not a part of the Constitution. However, in the landmark Kesavananda Bharati case (1973), the Supreme Court rejected the earlier opinion and held that the Preamble is an integral part of the Constitution and can be amended under Article 368, subject to the condition that no amendment is made to the 'basic structure' of the Constitution. In the LIC of India case (1995), the Supreme Court again held that the Preamble is an integral part of the Constitution.

The Regulating Act of 1773 was the first step taken by the British Government to control and regulate the affairs of the East India Company in India. It designated the Governor of Bengal as the 'Governor-General of Bengal' and created an Executive Council of four members to assist him. Lord Warren Hastings was the first Governor-General of Bengal. The Act established a Supreme Court at Calcutta in 1774 comprising one Chief Justice and three other judges. Sir Elijah Impey was the first Chief Justice.

Pitts India Act of 1784 established a system of double government by creating the Board of Control to manage political affairs while leaving commercial affairs to the Court of Directors. Charter Act of 1833 made the Governor-General of Bengal as the 'Governor-General of India' and vested in him all civil and military powers. Lord William Bentinck was the first Governor-General of India. Charter Act of 1853 introduced an open competition system of selection and recruitment of civil servants (Macaulay Committee appointed in 1854).

Government of India Act of 1858 changed the designation of the Governor-General of India to that of Viceroy of India. Lord Canning became the first Viceroy of India. It created a new office, Secretary of State for India, vested with complete authority and control over Indian administration, assisted by a 15-member Council of India.

Indian Councils Act of 1861 introduced portfolio system (initiated by Lord Canning in 1859) and empowered the Viceroy to issue ordinances during emergency with a life of six months. Government of India Act of 1919 (Montagu-Chelmsford Reforms) introduced Dyarchy in the provinces by dividing provincial subjects into transferred and reserved. It introduced bicameralism and direct elections in the country for the first time.

Government of India Act of 1935 provided for the establishment of an All-India Federation and divided powers between the Centre and units into three lists: Federal List (59 items), Provincial List (54 items), and Concurrent List (36 items). Residuary powers were given to the Viceroy. It abolished dyarchy in the provinces and introduced 'provincial autonomy'. It introduced dyarchy at the Centre. It established a Federal Court (set up in 1937).

SECTION 2: CITIZENSHIP AND FUNDAMENTAL RIGHTS
Part II of the Constitution (Articles 5 to 11) deals with Citizenship. Article 5 deals with citizenship at the commencement of the Constitution. Article 6 deals with citizenship rights of certain persons who migrated to India from Pakistan. Article 11 empowers Parliament to regulate the right of citizenship by law. The Citizenship Act of 1955 prescribes five ways of acquiring citizenship: Birth, Descent, Registration, Naturalization, and Incorporation of Territory. Citizenship can be lost in three ways: Renunciation, Termination, and Deprivation.

Part III of the Constitution (Articles 12 to 35) contains Fundamental Rights, described as the Magna Carta of India. Originally there were seven Fundamental Rights, but the Right to Property (Article 31) was deleted from the list of Fundamental Rights by the 44th Amendment Act of 1978 and made a legal right under Article 300-A in Part XII. Currently there are six Fundamental Rights.

Article 12 defines the term 'State'. Article 13 declares that all laws that are inconsistent with or in derogation of any of the fundamental rights shall be void (Doctrine of Judicial Review). Article 14 guarantees Equality before Law (concept derived from British origin) and Equal Protection of Laws (concept derived from American Constitution).

Article 15 prohibits discrimination on grounds only of religion, race, caste, sex, or place of birth. Article 16 guarantees equality of opportunity in matters of public employment. Article 17 abolishes Untouchability and forbids its practice in any form. Protection of Civil Rights Act 1955 enforces Article 17. Article 18 abolishes titles except military and academic distinctions.

Article 19 guarantees six democratic freedoms: (a) Freedom of speech and expression, (b) Freedom to assemble peacefully without arms, (c) Freedom to form associations or unions or co-operative societies, (d) Freedom to move freely throughout the territory of India, (e) Freedom to reside and settle in any part of India, and (g) Freedom to practice any profession or to carry on any occupation, trade or business.

Article 20 provides protection in respect of conviction for offences: No ex-post-facto law, No double jeopardy (no person shall be prosecuted and punished for the same offence more than once), and No self-incrimination (no person accused of any offence shall be compelled to be a witness against himself).

Article 21 guarantees Protection of Life and Personal Liberty. In Maneka Gandhi case (1978), Supreme Court gave a wider interpretation of Article 21 introducing the concept of 'due process of law'. Article 21-A mandates free and compulsory education to all children of the age of 6 to 14 years, inserted by the 86th Constitutional Amendment Act of 2002.

Article 22 grants protection against arrest and detention. Preventive detention cannot exceed three months unless an advisory board reports sufficient cause. Article 23 prohibits human trafficking and forced labor (begar). Article 24 prohibits employment of children below the age of 14 years in factories, mines, or hazardous occupations.

Articles 25 to 28 deal with Right to Freedom of Religion. Article 25 guarantees freedom of conscience and free profession, practice, and propagation of religion. Article 26 guarantees freedom to manage religious affairs. Article 27 prohibits taxation for promotion of any particular religion. Article 28 prohibits religious instruction in educational institutions wholly maintained out of State funds.

Articles 29 and 30 protect Cultural and Educational Rights of minorities. Article 32 gives the Right to Constitutional Remedies, which Dr. B.R. Ambedkar called the 'heart and soul of the Constitution'. Under Article 32, Supreme Court can issue five types of writs: Habeas Corpus ('to have the body of'), Mandamus ('we command'), Prohibition ('to forbid'), Certiorari ('to be certified'), and Quo-Warranto ('by what authority'). High Courts can issue writs under Article 226 for fundamental rights as well as ordinary legal rights (writs jurisdiction of High Court under Art 226 is broader than Supreme Court under Art 32).

SECTION 3: DIRECTIVE PRINCIPLES AND FUNDAMENTAL DUTIES
Part IV of the Constitution (Articles 36 to 51) contains Directive Principles of State Policy (DPSP), borrowed from the Irish Constitution (which borrowed it from Spanish Constitution). DPSPs are non-justiciable in nature (cannot be legally enforced by courts). They aim at establishing a Social and Economic Democracy and a Welfare State in India. Granville Austin described DPSPs and Fundamental Rights as the 'Conscience of the Constitution'.

Key DPSPs: Article 38 (to promote welfare of people), Article 39-A (equal justice and free legal aid to poor, added by 42nd Amendment), Article 40 (organization of village panchayats), Article 41 (right to work, education and public assistance), Article 42 (just and humane conditions of work and maternity relief), Article 43 (living wage for workers), Article 43-A (participation of workers in management of industries, added by 42nd Amendment), Article 43-B (promotion of co-operative societies, added by 97th Amendment 2011).

Article 44 mandates Uniform Civil Code for citizens (Goa is the only state with operational UCC). Article 45 deals with early childhood care and education for children below six years (modified by 86th Amendment 2002). Article 47 (level of nutrition, standard of living and public health; prohibition of intoxicating drinks). Article 48 (organization of agriculture and animal husbandry, prohibition of slaughter of cows and calves). Article 48-A (protection and improvement of environment, forests, and wildlife, added by 42nd Amendment 1976). Article 49 (protection of monuments and places of national importance). Article 50 (separation of judiciary from executive in public services). Article 51 (promotion of international peace and security).

Part IV-A (Article 51-A) contains Fundamental Duties, recommended by Swaran Singh Committee in 1976 and incorporated by 42nd Constitutional Amendment Act of 1976. Originally 10 Fundamental Duties were added. The 11th Fundamental Duty (duty of parent/guardian to provide education to child aged 6-14 years) was added by the 86th Constitutional Amendment Act of 2002. Fundamental Duties are non-justiciable and apply only to citizens of India.

SECTION 4: UNION EXECUTIVE — PRESIDENT, VICE-PRESIDENT, PRIME MINISTER
Part V (Articles 52 to 78) deals with the Union Executive. Article 52 states there shall be a President of India. Article 53 vests executive power of Union in President. Article 54 details Electoral College for President: elected members of both Houses of Parliament, elected members of Legislative Assemblies of States, and elected members of Legislative Assemblies of Delhi and Puducherry (added by 70th Amendment 1992). Nominated members do NOT participate in Presidential election.

Article 55 provides election of President by proportional representation by means of single transferable vote and voting by secret ballot. Article 56 provides term of office as 5 years. Article 58 sets qualifications: citizen of India, completed 35 years of age, qualified for election as member of Lok Sabha, and holds no office of profit.

Article 61 deals with Impeachment of President for 'violation of the Constitution' (phrase not defined in Constitution). Impeachment charges can be initiated in either House of Parliament, signed by 1/4th members of House, with 14 days prior notice given to President. Impeachment resolution must be passed by majority of not less than two-thirds of total membership of each House. Both elected and nominated members of Parliament participate in impeachment, while members of state assemblies do NOT participate.

Article 72 empowers President to grant pardons, reprieves, respites and remissions of punishment or suspend, remit or commute sentence. Pardoning power of President applies in all cases where punishment is by Court Martial or sentence is a death sentence.

Article 63 states there shall be a Vice-President of India. Vice-President is ex-officio Chairman of Rajya Sabha (Article 64). Vice-President is elected by Electoral College consisting of members of both Houses of Parliament (both elected and nominated members, but state assembly members do not participate). Qualification: minimum 35 years, qualified for election as member of Rajya Sabha.

Article 74 provides Council of Ministers headed by Prime Minister to aid and advise President (advice binding under 42nd and 44th Amendments). Article 75 states Prime Minister is appointed by President. Total number of ministers including PM shall not exceed 15% of total strength of Lok Sabha (91st Amendment Act 2003). Council of Ministers is collectively responsible to Lok Sabha (Article 75(3)).

Article 76 provides Attorney General for India, appointed by President, qualified to be appointed a Judge of Supreme Court. Highest law officer in the country. Right of audience in all courts in India and right to speak and take part in proceedings of either House of Parliament without right to vote (Article 88).

SECTION 5: PARLIAMENT OF INDIA AND JUDICIARY
Article 79 states Parliament consists of President, Council of States (Rajya Sabha), and House of the People (Lok Sabha). Rajya Sabha maximum strength is 250 (238 elected from States/UTs, 12 nominated by President for expertise in Literature, Science, Art, Social Service). Present strength is 245. Rajya Sabha is a permanent body not subject to dissolution; 1/3rd members retire every second year. Term of member is 6 years. Minimum age for Rajya Sabha member is 30 years. Vice-President presides as Chairman.

Lok Sabha maximum strength fixed at 550 (530 from States, 20 from UTs; nomination of 2 Anglo-Indians abolished by 104th Amendment 2019). Present strength is 543. Normal term is 5 years. Minimum age for Lok Sabha member is 25 years. Speaker of Lok Sabha presides over meetings and joint sittings of Parliament (Article 108). Speaker decides whether a bill is a Money Bill or not (Article 110), and decision is final.

Article 108 provides Joint Sitting of both Houses summoned by President and presided over by Speaker of Lok Sabha. Joint sitting applies only to Ordinary Bills and Financial Bills, NOT to Money Bills or Constitutional Amendment Bills.

Money Bill defined under Article 110. Can be introduced ONLY in Lok Sabha with prior recommendation of President. Rajya Sabha has restricted powers: cannot reject or amend Money Bill, can only make recommendations within 14 days, after which bill is deemed passed.

Annual Financial Statement (Budget) under Article 112. Contingency Fund of India under Article 267 placed at disposal of President. Consolidated Fund of India under Article 266.

Part V Chapter IV (Articles 124 to 147) deals with Supreme Court of India. Established on January 28, 1950. Present sanctioned strength is 34 judges (1 Chief Justice + 33 judges). Supreme Court judges appointed by President under Collegium System. Retirement age is 65 years. Judge can be removed by President on ground of proved misbehaviour or incapacity, after address by Parliament supported by special majority (majority of total membership + 2/3rd members present and voting).

Article 129 makes Supreme Court a Court of Record with power to punish for contempt of court. Article 131 gives Original Jurisdiction (disputes between Centre and States or between States). Article 132-136 details Appellate Jurisdiction. Article 143 gives Advisory Jurisdiction (President can consult Supreme Court on question of law or fact).

Part VI Chapter V (Articles 214 to 231) deals with High Courts in States. First High Courts established in Calcutta, Bombay, and Madras in 1862. Total 25 High Courts in India (25th is Andhra Pradesh High Court at Amaravati, 2019). High Court judges appointed by President, retire at age 62 years. Article 226 gives writ jurisdiction to High Court.

SECTION 6: EMERGENCY PROVISIONS AND AMENDMENTS
Part XVIII (Articles 352 to 360) deals with Emergency Provisions borrowed from Weimar Constitution of Germany (Government of India Act 1935 for administrative setup). Three types of emergencies:

1. National Emergency (Article 352): Declared on grounds of War, External Aggression, or Armed Rebellion (word 'Armed Rebellion' substituted for 'Internal Disturbance' by 44th Amendment 1978). Declared by President only after receiving written recommendation of Cabinet (added by 44th Amendment). Must be approved by Parliament within 1 month by special majority. Valid for 6 months at a time, can be extended indefinitely. During National Emergency, Fundamental Rights under Article 19 automatically suspended under Article 358 only in case of war/external aggression. Articles 20 and 21 CANNOT be suspended even during emergency (44th Amendment). Declared 3 times so far: 1962 (Indo-China war), 1971 (Indo-Pak war), 1975 (internal disturbance).

2. President's Rule / State Emergency (Article 356 & Article 365): Declared when governance of state cannot be carried on in accordance with provisions of Constitution. Must be approved by Parliament within 2 months by simple majority. Maximum period is 3 years (beyond 1 year requires Election Commission certification that general elections cannot be held). First imposed in Punjab in 1951.

3. Financial Emergency (Article 360): Declared if financial stability or credit of India is threatened. Must be approved by Parliament within 2 months by simple majority. Has NEVER been declared in India so far.

Part XX (Article 368) deals with Amendment of Constitution borrowed from South African Constitution. Three types of amendments: (1) By simple majority of Parliament, (2) By special majority of Parliament (2/3rd present and voting + majority of total membership), (3) By special majority of Parliament + ratification by at least half of State Legislatures by simple majority. Constitutional Amendment Bill can be introduced in either House of Parliament without prior permission of President. No joint sitting allowed for Constitutional Amendment Bills. President MUST give assent to Constitutional Amendment Bill (24th Amendment Act 1971 made assent mandatory).

Key Constitutional Amendments:
- 1st Amendment Act (1951): Added 9th Schedule to protect land reform laws from judicial review.
- 7th Amendment Act (1956): Reorganization of states on linguistic basis, abolished Class A, B, C, D states, created 14 states and 6 UTs.
- 42nd Amendment Act (1976): Known as 'Mini-Constitution'. Added Socialist, Secular, Integrity to Preamble. Added Part IV-A (Fundamental Duties). Added Part XIV-A (Tribunals). Made Cabinet advice binding on President.
- 44th Amendment Act (1978): Reversed several 42nd Amendment provisions. Substituted 'Armed Rebellion' for 'Internal Disturbance' in Art 352. Removed Right to Property from Fundamental Rights. Protected Art 20 & 21 during emergency.
- 52nd Amendment Act (1985): Added 10th Schedule (Anti-Defection Law).
- 61st Amendment Act (1989): Reduced voting age from 21 years to 18 years for Lok Sabha and Assembly elections (Art 326).
- 73rd Amendment Act (1992): Added Part IX and 11th Schedule (29 functional items) giving constitutional status to Panchayati Raj Institutions. 24th April celebrated as National Panchayati Raj Day.
- 74th Amendment Act (1992): Added Part IX-A and 12th Schedule (18 functional items) giving constitutional status to Urban Local Bodies (Municipalities).
- 86th Amendment Act (2002): Added Article 21-A (Right to Education), modified Article 45, and added 11th Fundamental Duty under Article 51-A(k).
- 101st Amendment Act (2016): Introduced Goods and Services Tax (GST) under Article 246A and established GST Council under Article 279A.
- 103rd Amendment Act (2019): Provided 10% reservation for Economically Weaker Sections (EWS) in education and public employment (amended Art 15 & 16).
- 104th Amendment Act (2019): Extended SC/ST reservation in Lok Sabha and Assemblies for 10 years, and abolished nomination of Anglo-Indians to Lok Sabha and State Assemblies.
- 105th Amendment Act (2021): Restored power of State Governments to identify and specify Socially and Educationally Backward Classes (SEBCs).
- 106th Amendment Act (2023): Nari Shakti Vandan Adhiniyam providing 33% reservation for women in Lok Sabha, State Assemblies, and Delhi Assembly.
`;

async function runTest() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected successfully!');

    const jobId = `test_job_${Date.now()}`;
    
    // Create initial test job record
    const job = await AIJob.create({
      jobId,
      sourceDocumentName: 'Indian Polity Lecture Master Transcript',
      createdBy: 'Test Script',
      provider: 'Gemini',
      model: 'gemini-3.8-flash',
      status: 'QUEUED',
      generationType: 'MCQS',
      subject: 'Indian Polity',
      topic: 'Constitutional Framework & Governance',
      exam: 'SSC CGL',
      difficulty: 'Medium',
      totalChars: sampleLongTranscript.length
    });

    console.log(`[TEST RUN] Starting processAIContentJob for job ${jobId}...`);
    console.log(`[TEST RUN] Document Length: ${sampleLongTranscript.length} characters.`);

    const startTime = Date.now();
    const resultJob = await processAIContentJob({
      jobId,
      extractedText: sampleLongTranscript,
      subject: 'Indian Polity',
      topic: 'Constitutional Framework & Governance',
      exam: 'SSC CGL',
      difficulty: 'Medium',
      createdBy: 'Test Script'
    });

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n==================================================');
    console.log('               AI EXTRACTION PROOF RESULTS        ');
    console.log('==================================================');
    console.log(`Source Document: ${resultJob.sourceDocumentName}`);
    console.log(`Source Characters Extracted: ${resultJob.totalChars}`);
    console.log(`Chunks Processed: ${resultJob.completedChunks} / ${resultJob.totalChunks}`);
    console.log(`Raw MCQs Extracted: ${resultJob.generatedMcqs.length + resultJob.duplicateCount}`);
    console.log(`Duplicates Flagged/Removed: ${resultJob.duplicateCount}`);
    console.log(`FINAL UNIQUE MCQs SAVED TO MONGODB: ${resultJob.generatedMcqCount}`);
    console.log(`Execution Time: ${elapsedSeconds} seconds`);
    console.log('==================================================\n');

    if (resultJob.generatedMcqCount > 15) {
      console.log('✅ SUCCESS PROOF: Successfully extracted far more than 8 questions without artificial caps!');
    } else {
      console.error('❌ FAIL: Extraction count is still low!');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTest();
