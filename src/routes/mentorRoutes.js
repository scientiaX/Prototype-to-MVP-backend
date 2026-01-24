import express from 'express';
import { generateSocraticQuestion, generateFollowUpQuestions } from '../services/aiService.js';
import * as aiSimple from '../services/aiSimpleService.js';
import Problem from '../models/Problem.js';
import UserProfile from '../models/UserProfile.js';

const router = express.Router();

/**
 * ============================================
 * FRIKSI #3: EXTERNALIZED FAILURE LANGUAGE
 * ============================================
 * Templates untuk menyalahkan sistem/skenario, bukan user
 * "Skenario ini memang menipu" bukan "Kamu salah"
 */

// Externalized failure templates - blame the scenario, not the user
const externalizedFailureTemplates = {
  id: {
    scenario_trap: [
      "Skenario ini memang dirancang menipu. Banyak {archetype} terjebak di titik ini.",
      "Ini salah satu jebakan klasik dalam problem ini. Kamu tidak sendirian.",
      "Desain masalah ini memang bias. Itu by design untuk menguji intuisi.",
      "Banyak orang dengan gaya berpikir {archetype} melewatkan hal yang sama."
    ],
    model_critique: [
      "Model berpikir ini mengabaikan variabel penting: {missing_var}.",
      "Pendekatan ini tidak salah, tapi ada blind spot di area {blind_spot}.",
      "Framework yang kamu pakai kuat untuk X, tapi lemah untuk Y.",
      "Cara berpikir ini punya trade-off tersembunyi yang jarang terlihat di awal."
    ],
    archetype_framing: [
      "Sebagai {archetype}, wajar kalau kamu prioritaskan {priority}. Tapi skenario ini butuh {alternative}.",
      "Gaya {archetype} punya kekuatan di {strength}, tapi skenario ini menguji {weakness}.",
      "Ini bukan soal benar-salah. Ini soal gaya {archetype} vs konteks yang berbeda."
    ],
    normalization: [
      "87% orang memilih hal yang sama di titik ini.",
      "Ini pola umum. Kamu sedang belajar mengenali jebakan ini.",
      "Bahkan expert sering terjebak di sini. Kamu sekarang tahu polanya."
    ]
  },
  en: {
    scenario_trap: [
      "This scenario is designed to be tricky. Many {archetype}s get caught here.",
      "This is a classic trap in this problem. You're not alone.",
      "This problem is biased by design. It tests intuition.",
      "Many people with {archetype} thinking style miss the same thing."
    ],
    model_critique: [
      "This mental model overlooks an important variable: {missing_var}.",
      "This approach isn't wrong, but there's a blind spot in {blind_spot}.",
      "The framework you used is strong for X, but weak for Y.",
      "This thinking style has hidden trade-offs that aren't obvious at first."
    ],
    archetype_framing: [
      "As a {archetype}, it makes sense you prioritized {priority}. But this scenario needs {alternative}.",
      "The {archetype} style is strong in {strength}, but this scenario tests {weakness}.",
      "This isn't about right or wrong. It's about {archetype} style vs different context."
    ],
    normalization: [
      "87% of people make the same choice at this point.",
      "This is a common pattern. You're learning to recognize this trap.",
      "Even experts often fall for this. Now you know the pattern."
    ]
  }
};

// Archetype characteristics for framing
const archetypeCharacteristics = {
  risk_taker: {
    label: { id: 'Risk Taker', en: 'Risk Taker' },
    priority: { id: 'kecepatan dan hasil cepat', en: 'speed and quick results' },
    strength: { id: 'keberanian mengambil risiko', en: 'courage to take risks' },
    weakness: { id: 'pertimbangan jangka panjang', en: 'long-term considerations' },
    alternative: { id: 'kehati-hatian', en: 'caution' }
  },
  analyst: {
    label: { id: 'Analyst', en: 'Analyst' },
    priority: { id: 'data dan bukti', en: 'data and evidence' },
    strength: { id: 'analisis mendalam', en: 'deep analysis' },
    weakness: { id: 'kecepatan eksekusi', en: 'execution speed' },
    alternative: { id: 'keputusan cepat', en: 'quick decisions' }
  },
  builder: {
    label: { id: 'Builder', en: 'Builder' },
    priority: { id: 'eksekusi dan hasil konkret', en: 'execution and concrete results' },
    strength: { id: 'implementasi praktis', en: 'practical implementation' },
    weakness: { id: 'perencanaan strategis', en: 'strategic planning' },
    alternative: { id: 'analisis lebih dalam', en: 'deeper analysis' }
  },
  strategist: {
    label: { id: 'Strategist', en: 'Strategist' },
    priority: { id: 'visi jangka panjang', en: 'long-term vision' },
    strength: { id: 'pemikiran big-picture', en: 'big-picture thinking' },
    weakness: { id: 'detail operasional', en: 'operational details' },
    alternative: { id: 'fokus taktis', en: 'tactical focus' }
  }
};

/**
 * Generate externalized feedback - shifts blame from user to scenario
 */
function generateExternalizedFeedback(archetype, feedbackType, language = 'id') {
  const templates = externalizedFailureTemplates[language] || externalizedFailureTemplates.id;
  const archetypeInfo = archetypeCharacteristics[archetype] || archetypeCharacteristics.analyst;

  let templateArray;
  switch (feedbackType) {
    case 'trap':
      templateArray = templates.scenario_trap;
      break;
    case 'model':
      templateArray = templates.model_critique;
      break;
    case 'archetype':
      templateArray = templates.archetype_framing;
      break;
    case 'normalize':
      templateArray = templates.normalization;
      break;
    default:
      templateArray = templates.scenario_trap;
  }

  // Pick random template
  const template = templateArray[Math.floor(Math.random() * templateArray.length)];

  // Replace placeholders
  return template
    .replace(/{archetype}/g, archetypeInfo.label[language] || archetype)
    .replace(/{priority}/g, archetypeInfo.priority[language] || '')
    .replace(/{strength}/g, archetypeInfo.strength[language] || '')
    .replace(/{weakness}/g, archetypeInfo.weakness[language] || '')
    .replace(/{alternative}/g, archetypeInfo.alternative[language] || '')
    .replace(/{missing_var}/g, language === 'id' ? 'faktor eksternal' : 'external factors')
    .replace(/{blind_spot}/g, language === 'id' ? 'asumsi tersembunyi' : 'hidden assumptions');
}

router.post('/question', async (req, res) => {
  try {
    const { user_id, problem_id, context = 'initial' } = req.body;

    if (!user_id || !problem_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const problem = await Problem.findOne({ problem_id });
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const profile = await UserProfile.findOne({ user_id });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const question = await generateSocraticQuestion(problem, profile, context);

    res.json({ question });
  } catch (error) {
    console.error('Generate question error:', error);
    res.status(500).json({ error: 'Failed to generate question' });
  }
});

/**
 * Generate personalized mentor response based on user's answer
 * Responses can be: follow-up questions, small explanations, tasks, reflections
 */
router.post('/follow-up', async (req, res) => {
  try {
    const { problem_id, user_response, exchange_count = 1, user_id, visual_state = 'calm' } = req.body;

    if (!problem_id || !user_response) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const problem = await Problem.findOne({ problem_id });
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // Get user profile for personalization
    const profile = user_id ? await UserProfile.findOne({ user_id }) : null;

    // Determine response type based on exchange count and user behavior
    let responseType = 'follow_up';
    if (exchange_count >= 3) {
      responseType = 'stress_test';
    }

    // Build personalized mentor prompt with visual state tone
    const mentorPrompt = buildMentorPrompt(problem, user_response, profile, exchange_count, responseType, visual_state);

    // Generate response using Cloudflare AI (no RPM limit for realtime)
    const { invokeMidLevelAI } = await import('../config/cloudflareAI.js');
    const fullPrompt = `${mentorPrompt.system}\n\n${mentorPrompt.user}`;
    const response = await invokeMidLevelAI({ prompt: fullPrompt });

    // Check if mentor decides to conclude (after minimum exchanges)
    const lang = profile?.language || 'en';
    const concludeMarker = lang === 'id' ? '[selesai]' : '[conclude]';
    const shouldConclude = exchange_count >= 4 && response?.toLowerCase().includes(concludeMarker.toLowerCase());

    const defaultFollowUp = lang === 'id'
      ? "Bisa ceritakan lebih lanjut tentang alasanmu?"
      : "Can you tell me more about your reasoning?";

    res.json({
      question: response?.replace(concludeMarker, '').replace('[selesai]', '').replace('[conclude]', '').trim() || defaultFollowUp,
      type: responseType,
      should_conclude: shouldConclude
    });
  } catch (error) {
    console.error('Follow-up generation error:', error);
    // Personalized fallback based on exchange count - more variety to prevent repetition
    const profile = req.body.user_id ? await UserProfile.findOne({ user_id: req.body.user_id }).catch(() => null) : null;
    const lang = profile?.language || 'en';
    const exchangeIdx = req.body.exchange_count || 0;
    const fallbacks = lang === 'id' ? [
      "Apa yang membuatmu yakin dengan pilihan ini?",
      "Kalau ternyata asumsimu salah, apa yang terjadi?",
      "Siapa yang paling dirugikan dari keputusan ini?",
      "Apa satu hal yang masih bikin kamu ragu?",
      "Langkah konkret pertamamu apa?",
      "Apa risiko terburuk yang bisa terjadi?",
      "Berapa lama kamu butuh untuk eksekusi ini?",
      "Ada alternatif lain yang kamu pertimbangkan?",
      "Kalau deadline maju seminggu, apa yang berubah?",
      "Apa yang akan kamu korbankan untuk ini?",
      "Siapa yang perlu kamu ajak bicara dulu?",
      "Apa ukuran suksesnya?"
    ] : [
      "What makes you confident about this choice?",
      "If your assumption is wrong, what happens?",
      "Who loses the most from this decision?",
      "What's one thing that still makes you doubt?",
      "What's your first concrete step?",
      "What's the worst-case risk?",
      "How long do you need to execute this?",
      "Any alternatives you considered?",
      "If deadline moves up a week, what changes?",
      "What are you willing to sacrifice for this?",
      "Who do you need to talk to first?",
      "What's the success metric?"
    ];
    // Use random selection instead of sequential to avoid obvious patterns
    const randomIdx = (exchangeIdx + Math.floor(Math.random() * 5)) % fallbacks.length;
    res.json({
      question: fallbacks[randomIdx],
      type: 'follow_up'
    });
  }
});

/**
 * Build personalized mentor prompt based on archetype, behavior, and visual state
 * Visual states: calm, focused, urgent, critical
 */
function buildMentorPrompt(problem, userResponse, profile, exchangeCount, responseType, visualState = 'calm') {
  const archetype = profile?.primary_archetype || 'analyst';
  const thinkingStyle = profile?.thinking_style || 'explorative';
  const language = profile?.language || 'id';

  // Archetype-specific mentoring style
  const archetypeStyles = {
    risk_taker: {
      style: 'langsung, to the point, menantang',
      focus: 'risiko, speed, keberanian, untung-rugi',
      challenge: 'terlalu cepat tanpa pertimbangan'
    },
    analyst: {
      style: 'detail, sistematis, data-driven',
      focus: 'data, evidence, analisis, implikasi',
      challenge: 'overthinking, takut bertindak'
    },
    builder: {
      style: 'praktis, action-oriented, konkret',
      focus: 'eksekusi, langkah nyata, resource',
      challenge: 'skip planning, terlalu fokus doing'
    },
    strategist: {
      style: 'big picture, jangka panjang, multi-stakeholder',
      focus: 'visi, alignment, positioning',
      challenge: 'terlalu abstrak, kurang grounded'
    }
  };

  // Visual state tone mapping from Experience Layer
  const visualStateTones = {
    calm: {
      style: 'reflektif dan tenang',
      instruction: 'Bicara dengan sabar, beri ruang berpikir',
      examples: ['Menarik, coba pikirkan...', 'Apa yang jadi pertimbanganmu?']
    },
    focused: {
      style: 'langsung dan jelas',
      instruction: 'Fokus pada pertanyaan inti, tidak bertele-tele',
      examples: ['Apa keputusanmu?', 'Langkah konkretnya?']
    },
    urgent: {
      style: 'singkat dan tegas',
      instruction: 'Maksimal 1-2 kalimat. Tekan untuk segera memutuskan.',
      examples: ['Putuskan sekarang.', 'Waktu terbatas.']
    },
    critical: {
      style: 'sangat tegas dan final',
      instruction: 'Paling singkat mungkin. Ini kesempatan terakhir.',
      examples: ['Waktu habis. Kunci.', 'Final.']
    }
  };

  const archetypeStyle = archetypeStyles[archetype] || archetypeStyles.analyst;
  const toneStyle = visualStateTones[visualState] || visualStateTones.calm;
  const isEnglish = language === 'en';

  // Language-aware system prompt
  const systemPrompt = isEnglish
    ? `You are a business mentor who is ${archetypeStyle.style}. 

CURRENT TONE: ${toneStyle.style}
${toneStyle.instruction}

IMPORTANT RULES:
1. DON'T use complex jargon. Use simple: reason, pros-cons, consideration
2. Your response can be: follow-up questions, short explanations, small tasks, or reflections
3. Talk like a mentor who cares, not a chatbot
4. Focus on: ${archetypeStyle.focus}
5. Watch for this archetype's weakness: ${archetypeStyle.challenge}
6. Natural and simple English
7. Example tone: "${toneStyle.examples[0]}"

SENTENCE COUNT BASED ON STATE:
- Calm/Focused: 2-3 sentences
- Urgent: 1-2 sentences
- Critical: 1 sentence only

RESPONSE TYPE:
- Exchange 1-2: Dig deeper, ask for clarification, break into sub-problems
- Exchange 3+: Apply pressure, stress test, challenge assumptions
- If sufficient (4+ exchange and user is consistent), add [conclude] at the end

DON'T:
- Say "interesting" or "good" too much
- Use templates that feel like a bot
- Ask what was already answered
- Give direct answers`
    : `Kamu adalah mentor bisnis yang ${archetypeStyle.style}. 

TONE SAAT INI: ${toneStyle.style}
${toneStyle.instruction}

ATURAN PENTING:
1. JANGAN gunakan kata-kata sulit seperti "reasoning", "trade-off". Gunakan: alasan, untung-rugi, pertimbangan
2. Responmu bisa berupa: pertanyaan lanjutan, penjelasan singkat, tugas kecil, atau refleksi
3. Bicara seperti mentor yang peduli, bukan chatbot
4. Fokus pada: ${archetypeStyle.focus}
5. Waspadai kelemahan archetype ini: ${archetypeStyle.challenge}
6. Bahasa Indonesia yang natural dan sederhana
7. Contoh tone: "${toneStyle.examples[0]}"

JUMLAH KALIMAT BERDASARKAN KONDISI:
- Calm/Focused: 2-3 kalimat
- Urgent: 1-2 kalimat
- Critical: 1 kalimat saja

TIPE RESPONMU:
- Exchange 1-2: Gali lebih dalam, minta klarifikasi, pecah jadi sub-masalah
- Exchange 3+: Beri tekanan, stress test, challenge asumsi
- Jika sudah cukup (4+ exchange dan user konsisten), tambahkan [selesai] di akhir

JANGAN:
- Bilang "menarik" atau "bagus" berlebihan
- Gunakan template yang terasa bot
- Tanya hal yang sudah dijawab
- Beri jawaban langsung`;

  const userPrompt = isEnglish
    ? `PROBLEM:
${problem.title}
${problem.context}

USER'S ANSWER (exchange #${exchangeCount}):
"${userResponse}"

Give mentor response with ${toneStyle.style} tone:`
    : `MASALAH:
${problem.title}
${problem.context}

JAWABAN USER (exchange ke-${exchangeCount}):
"${userResponse}"

Beri respon mentor dengan tone ${toneStyle.style}:`;

  return { system: systemPrompt, user: userPrompt };
}



/**
 * Generate stress-test question
 */
router.post('/stress-test', async (req, res) => {
  try {
    const { problem_id, user_response } = req.body;

    if (!problem_id) {
      return res.status(400).json({ error: 'Missing problem_id' });
    }

    const problem = await Problem.findOne({ problem_id });
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // Use AI Simple for stress test generation
    const profile = req.body.user_id ? await UserProfile.findOne({ user_id: req.body.user_id }) : null;
    const result = await aiSimple.generateSimpleFollowUp(problem, user_response || '', 0.7, profile);

    // Fallback if generation fails
    const fallback = profile?.language === 'id'
      ? "Bagaimana kalau asumsi terbesarmu ternyata salah? Apa contingency plan-mu?"
      : "What if your biggest assumption turns out to be wrong? What's your contingency plan?";
    const question = result?.question || fallback;

    res.json({
      question,
      type: result?.type || 'stress_test'
    });
  } catch (error) {
    console.error('Stress-test generation error:', error);
    res.status(500).json({ error: 'Failed to generate stress-test' });
  }
});

/**
 * Generate hint for user who is stuck
 */
router.post('/hint', async (req, res) => {
  try {
    const { problem_id, user_id, partial_answer = '' } = req.body;

    if (!problem_id) {
      return res.status(400).json({ error: 'Missing problem_id' });
    }

    const problem = await Problem.findOne({ problem_id });
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const profile = user_id ? await UserProfile.findOne({ user_id }) : null;

    const hint = await aiSimple.generateHint(problem, profile, partial_answer);

    res.json({ hint });
  } catch (error) {
    console.error('Hint generation error:', error);
    res.status(500).json({ error: 'Failed to generate hint' });
  }
});

/**
 * ============================================
 * FRIKSI #3: EXTERNALIZED FEEDBACK ENDPOINT
 * ============================================
 * Generate feedback that blames the scenario, not the user
 */
router.post('/externalized-feedback', async (req, res) => {
  try {
    const { user_id, feedback_type = 'trap' } = req.body;

    // Get user profile for archetype and language
    const profile = user_id ? await UserProfile.findOne({ user_id }) : null;
    const archetype = profile?.primary_archetype || 'analyst';
    const language = profile?.language || 'id';

    // Generate externalized feedback
    const feedback = generateExternalizedFeedback(archetype, feedback_type, language);

    // Get archetype info for additional context
    const archetypeInfo = archetypeCharacteristics[archetype] || archetypeCharacteristics.analyst;

    res.json({
      feedback,
      feedback_type,
      archetype: {
        id: archetype,
        label: archetypeInfo.label[language],
        strength: archetypeInfo.strength[language],
        weakness: archetypeInfo.weakness[language]
      },
      is_externalized: true // Flag to indicate this is externalized language
    });
  } catch (error) {
    console.error('Externalized feedback error:', error);
    // Fallback to generic externalized message
    const lang = req.body.language || 'id';
    res.json({
      feedback: lang === 'id'
        ? "Ini salah satu jebakan klasik. Kamu tidak sendirian."
        : "This is a classic trap. You're not alone.",
      feedback_type: 'normalize',
      is_externalized: true
    });
  }
});

/**
 * Get available externalized feedback types
 */
router.get('/feedback-types', (req, res) => {
  res.json({
    types: [
      { id: 'trap', description: 'Blame the scenario design' },
      { id: 'model', description: 'Critique the mental model, not the person' },
      { id: 'archetype', description: 'Frame as archetype consequence' },
      { id: 'normalize', description: 'Show that this is common' }
    ]
  });
});

export default router;

