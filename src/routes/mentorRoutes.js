import express from 'express';
import { generateSocraticQuestion, generateFollowUpQuestions } from '../services/aiService.js';
import * as aiSimple from '../services/aiSimpleService.js';
import Problem from '../models/Problem.js';
import UserProfile from '../models/UserProfile.js';

const router = express.Router();

/**
 * ============================================
 * CONTEXTUAL COUNTDOWN SYSTEM
 * ============================================
 * Determines when to show pressure/countdown based on:
 * - Problem type (quick vs standard)
 * - User archetype (analyst = tends to overthink)
 * - Exchange count (later = more pressure)
 * - Response patterns (short responses = might need options)
 */
function calculateCountdownSignal(problem, profile, exchangeCount, userResponse, visualState) {
  const archetype = profile?.primary_archetype || 'analyst';
  const isQuickMode = problem?.duration_type === 'quick';
  const responseLength = userResponse?.length || 0;

  let showCountdown = false;
  let urgencyReason = null;
  let suggestedVisualState = visualState || 'calm';

  // Rule 1: Quick mode = earlier pressure
  const pressureThreshold = isQuickMode ? 2 : 3;

  // Rule 2: Archetype-based pressure
  const archetypePressureRules = {
    analyst: {
      pressureAt: pressureThreshold,
      reason_id: 'Analyst cenderung overthink. Waktunya decide.',
      reason_en: 'Analysts tend to overthink. Time to decide.'
    },
    risk_taker: {
      pressureAt: pressureThreshold + 1, // More lenient, they decide fast anyway
      reason_id: 'Sudah cukup info. Kunci.',
      reason_en: 'Enough info. Lock it.'
    },
    builder: {
      pressureAt: pressureThreshold,
      reason_id: 'Action time. Jangan terlalu banyak planning.',
      reason_en: 'Action time. Don\'t over-plan.'
    },
    strategist: {
      pressureAt: pressureThreshold + 1, // They need big picture time
      reason_id: 'Big picture sudah terbentuk. Commit.',
      reason_en: 'Big picture is formed. Commit.'
    }
  };

  const rule = archetypePressureRules[archetype] || archetypePressureRules.analyst;
  const lang = profile?.language || 'id';

  // Rule 3: Exchange count triggers
  if (exchangeCount >= rule.pressureAt) {
    showCountdown = true;
    urgencyReason = lang === 'id' ? rule.reason_id : rule.reason_en;
    suggestedVisualState = 'urgent';
  }

  // Rule 4: Very high exchange = critical
  if (exchangeCount >= rule.pressureAt + 2) {
    suggestedVisualState = 'critical';
    urgencyReason = lang === 'id' ? 'Waktu hampir habis.' : 'Time almost up.';
  }

  // Rule 5: Very short responses might indicate confusion - don't pressure
  if (responseLength < 20 && exchangeCount <= 2) {
    showCountdown = false;
    suggestedVisualState = 'calm';
    urgencyReason = null;
  }

  return {
    show_countdown: showCountdown,
    urgency_reason: urgencyReason,
    suggested_visual_state: suggestedVisualState
  };
}

/**
 * ============================================
 * SOCIAL COMPARISON SYSTEM (Event-based)
 * ============================================
 * Occasionally shows how other users with similar archetype decided
 * NOT every exchange - only ~30% chance and on specific conditions
 */
function generateSocialComparison(profile, exchangeCount, userResponse) {
  const archetype = profile?.primary_archetype || 'analyst';
  const lang = profile?.language || 'id';

  // Only trigger occasionally (30% chance) and after exchange 2
  if (exchangeCount < 2 || Math.random() > 0.30) {
    return null;
  }

  // Social comparison templates by archetype
  const comparisons = {
    id: {
      analyst: [
        '68% analyst lain memilih opsi yang lebih berani di sini.',
        'Kebanyakan analyst menghabiskan waktu di detail ini juga.',
        '72% dengan gaya berpikirmu memilih alternatif lain.'
      ],
      risk_taker: [
        '54% risk-taker lain justru lebih hati-hati di titik ini.',
        'Surprisingly, kebanyakan risk-taker pause di sini.',
        '61% dengan gayamu memilih mitigasi risiko dulu.'
      ],
      builder: [
        '65% builder lain langsung eksekusi di sini.',
        'Kebanyakan builder sudah move on ke langkah berikutnya.',
        '78% dengan gayamu fokus pada quick wins dulu.'
      ],
      strategist: [
        '59% strategist lain melihat implikasi jangka panjang.',
        'Kebanyakan strategist menimbang stakeholder lain di sini.',
        '71% dengan gayamu mempertimbangkan skenario alternatif.'
      ]
    },
    en: {
      analyst: [
        '68% of analysts chose a bolder option here.',
        'Most analysts also spent time on this detail.',
        '72% with your thinking style chose differently.'
      ],
      risk_taker: [
        '54% of risk-takers were more cautious here.',
        'Surprisingly, most risk-takers paused here.',
        '61% with your style chose risk mitigation first.'
      ],
      builder: [
        '65% of builders executed immediately here.',
        'Most builders already moved to the next step.',
        '78% with your style focused on quick wins first.'
      ],
      strategist: [
        '59% of strategists considered long-term implications.',
        'Most strategists weighed other stakeholders here.',
        '71% with your style considered alternative scenarios.'
      ]
    }
  };

  const archetypeComparisons = comparisons[lang]?.[archetype] || comparisons.id.analyst;
  const randomComparison = archetypeComparisons[Math.floor(Math.random() * archetypeComparisons.length)];

  return {
    text: randomComparison,
    type: 'social_comparison'
  };
}

/**
 * ============================================
 * MICRO FEEDBACK SYSTEM (Event-based, varied)
 * ============================================
 * Short 2-3 word feedback, NOT every exchange
 * Based on response patterns and conditions
 */
function generateMicroFeedback(profile, exchangeCount, userResponse, responseType) {
  const lang = profile?.language || 'id';
  const responseLength = userResponse?.length || 0;

  // Only trigger 40% of the time for variety
  if (Math.random() > 0.40) {
    return null;
  }

  // Different feedback types based on conditions
  let feedbackPool = [];

  if (responseLength > 100) {
    // Long, thoughtful response
    feedbackPool = lang === 'id'
      ? ['Reasoning solid.', 'Argumen kuat.', 'Detail bagus.', 'Well thought.']
      : ['Solid reasoning.', 'Strong argument.', 'Good detail.', 'Well thought.'];
  } else if (responseLength > 50) {
    // Medium response
    feedbackPool = lang === 'id'
      ? ['Noted.', 'Got it.', 'Dicatat.', 'Oke.']
      : ['Noted.', 'Got it.', 'Recorded.', 'Okay.'];
  } else {
    // Short/decisive response
    feedbackPool = lang === 'id'
      ? ['Quick call.', 'Tegas.', 'Decisive.', 'To the point.']
      : ['Quick call.', 'Decisive.', 'Sharp.', 'To the point.'];
  }

  // Add stress-test specific feedback
  if (responseType === 'stress_test') {
    const stressFeedback = lang === 'id'
      ? ['Diuji.', 'Challenge noted.', 'Tested.']
      : ['Tested.', 'Challenge noted.', 'Stressed.'];
    feedbackPool = [...feedbackPool, ...stressFeedback];
  }

  // Add exchange-based feedback
  if (exchangeCount >= 3) {
    const progressFeedback = lang === 'id'
      ? ['Hampir stabil.', 'Forming pattern.', 'Konsisten.']
      : ['Almost stable.', 'Forming pattern.', 'Consistent.'];
    feedbackPool = [...feedbackPool, ...progressFeedback];
  }

  const randomFeedback = feedbackPool[Math.floor(Math.random() * feedbackPool.length)];

  return {
    text: randomFeedback,
    type: 'micro_feedback'
  };
}

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
 * Now with dynamic interaction type selection (text vs options)
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
    const lang = profile?.language || 'en';

    // Determine if this is quick mode (shorter session)
    const isQuickMode = problem.duration_type === 'quick';
    const conclusionThreshold = isQuickMode ? 2 : 3; // Quick: 2 exchanges, Standard: 3

    // Determine response type based on exchange count
    let responseType = 'follow_up';
    if (exchange_count >= conclusionThreshold - 1) {
      responseType = 'stress_test';
    }

    // Build personalized mentor prompt with visual state tone
    const mentorPrompt = buildMentorPrompt(problem, user_response, profile, exchange_count, responseType, visual_state);
    const fullPrompt = `${mentorPrompt.system}\n\n${mentorPrompt.user}`;

    // Try Cloudflare first, fallback to Groq if null
    let response = null;
    try {
      const { invokeMidLevelAI } = await import('../config/cloudflareAI.js');
      response = await invokeMidLevelAI({ prompt: fullPrompt });
      if (response) {
        console.log('[Mentor] Cloudflare AI response received');
      }
    } catch (cfErr) {
      console.error('[Mentor] Cloudflare AI error:', cfErr.message);
    }

    // Fallback to Groq if Cloudflare failed
    if (!response) {
      console.log('[Mentor] Cloudflare null, trying Groq fallback...');
      try {
        const { invokeLowLevelAI } = await import('../config/groqAI.js');
        response = await invokeLowLevelAI({ prompt: fullPrompt });
        if (response) {
          console.log('[Mentor] Groq AI fallback response received');
        }
      } catch (groqErr) {
        console.error('[Mentor] Groq fallback error:', groqErr.message);
      }
    }

    // Parse interaction type from AI response markers
    let interactionType = 'TEXT_COMMIT';
    let generatedOptions = null;
    let cleanedResponse = response || '';

    // Check for [OPSI] or [OPTION] marker
    if (cleanedResponse.includes('[OPSI]') || cleanedResponse.includes('[OPTION]')) {
      interactionType = 'OPTION_SELECT';
      cleanedResponse = cleanedResponse.replace('[OPSI]', '').replace('[OPTION]', '').trim();

      // Extract A) B) options from response
      const optionMatches = cleanedResponse.match(/[A-B]\)\s*[^A-B\)]+/g);
      if (optionMatches && optionMatches.length >= 2) {
        generatedOptions = optionMatches.map(opt => ({
          text: opt.replace(/^[A-B]\)\s*/, '').trim()
        }));
        // Remove options from question text
        cleanedResponse = cleanedResponse.replace(/[A-B]\)\s*[^A-B\)]+/g, '').trim();
      }
    }
    // Check for [TASK] marker
    else if (cleanedResponse.includes('[TASK]')) {
      interactionType = 'TASK_EXECUTE';
      cleanedResponse = cleanedResponse.replace('[TASK]', '').trim();
    }
    // Check for [TEXT] marker (explicit) or default
    else {
      cleanedResponse = cleanedResponse.replace('[TEXT]', '').trim();
    }

    // Check if mentor decides to conclude
    const concludeMarker = lang === 'id' ? '[selesai]' : '[conclude]';
    const shouldConclude = exchange_count >= conclusionThreshold && cleanedResponse.toLowerCase().includes(concludeMarker.toLowerCase());
    cleanedResponse = cleanedResponse.replace(/\[selesai\]|\[conclude\]/gi, '').trim();

    // Calculate contextual countdown signals
    const countdownSignal = calculateCountdownSignal(problem, profile, exchange_count, user_response, visual_state);

    // Generate social comparison (event-based, ~30% chance)
    const socialComparison = generateSocialComparison(profile, exchange_count, user_response);

    // Generate micro feedback (event-based, ~40% chance)
    const microFeedback = generateMicroFeedback(profile, exchange_count, user_response, responseType);

    const defaultFollowUp = lang === 'id'
      ? "Apa langkah pertamamu?"
      : "What's your first step?";

    res.json({
      question: cleanedResponse || defaultFollowUp,
      type: responseType,
      should_conclude: shouldConclude,
      interaction_type: interactionType,
      options: generatedOptions,
      // Contextual countdown signals
      show_countdown: countdownSignal.show_countdown,
      urgency_reason: countdownSignal.urgency_reason,
      suggested_visual_state: countdownSignal.suggested_visual_state,
      // Social comparison and micro feedback (event-based)
      social_comparison: socialComparison,
      micro_feedback: microFeedback
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
 * Build personalized mentor prompt - STRICT SHORT RESPONSES
 * 1 question per exchange, AI decides interaction type
 */
function buildMentorPrompt(problem, userResponse, profile, exchangeCount, responseType, visualState = 'calm') {
  const language = profile?.language || 'id';
  const isQuickMode = problem?.duration_type === 'quick';
  const maxExchanges = isQuickMode ? 2 : 3;

  // Determine if AI should conclude
  const shouldConsiderConclusion = exchangeCount >= maxExchanges;

  // Visual state affects length
  const isUrgent = visualState === 'urgent' || visualState === 'critical';

  const systemPrompt = language === 'id'
    ? `Kamu mentor yang berpikir seperti user. Tugasmu: TANYA 1 PERTANYAAN SAJA per giliran.

ATURAN KETAT:
1. MAKSIMAL 2 KALIMAT. Tidak boleh lebih.
2. SATU PERTANYAAN per response. Bukan daftar pertanyaan.
3. Jangan prediksi jawaban user atau exchange selanjutnya.
4. Jangan jelaskan kenapa kamu bertanya.
5. Bahasa santai, natural, seperti teman diskusi.

PILIH JENIS INTERAKSI (tulis di awal response dengan format [TIPE]):
- [TEXT] = User menjawab bebas (default)
- [OPSI] = Beri 2 pilihan jelas, user pilih satu. Format: A) ... B) ...
- [TASK] = Minta user melakukan sesuatu spesifik

KAPAN PAKAI [OPSI]:
- Saat ada trade-off jelas
- Saat user ragu antara 2 hal
- Untuk mempercepat keputusan

${shouldConsiderConclusion ? 'Jika user sudah konsisten dan jelas, tambahkan [selesai] di akhir.' : ''}

JANGAN: kata "menarik", "bagus", jargon bisnis, penjelasan panjang.`

    : `You are a mentor who thinks like the user. Your job: ASK 1 QUESTION ONLY per turn.

STRICT RULES:
1. MAX 2 SENTENCES. No more.
2. ONE QUESTION per response. Not a list.
3. Don't predict user's answer or next exchanges.
4. Don't explain why you're asking.
5. Casual, natural language, like a friend discussing.

CHOOSE INTERACTION TYPE (write at start with format [TYPE]):
- [TEXT] = User answers freely (default)
- [OPTION] = Give 2 clear choices, user picks one. Format: A) ... B) ...
- [TASK] = Ask user to do something specific

WHEN TO USE [OPTION]:
- When there's a clear trade-off
- When user is torn between 2 things
- To speed up decision

${shouldConsiderConclusion ? 'If user is already consistent and clear, add [conclude] at end.' : ''}

DON'T: "interesting", "good", business jargon, long explanations.`;

  // MINIMAL problem context - just title, not full description
  const userPrompt = language === 'id'
    ? `Konteks: ${problem.title}
Jawaban user: "${userResponse}"
Exchange ke-${exchangeCount}. ${isUrgent ? 'SINGKAT.' : ''}`
    : `Context: ${problem.title}
User answer: "${userResponse}"
Exchange #${exchangeCount}. ${isUrgent ? 'BE BRIEF.' : ''}`;

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

