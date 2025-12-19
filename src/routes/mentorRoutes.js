import express from 'express';
import { generateSocraticQuestion, generateFollowUpQuestions } from '../services/aiService.js';
import * as aiSimple from '../services/aiSimpleService.js';
import Problem from '../models/Problem.js';
import UserProfile from '../models/UserProfile.js';

const router = express.Router();

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
    const { problem_id, user_response, exchange_count = 1, user_id } = req.body;

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

    // Build personalized mentor prompt
    const mentorPrompt = buildMentorPrompt(problem, user_response, profile, exchange_count, responseType);

    // Generate response using OpenAI
    const openai = (await import('../config/openai.js')).default;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: mentorPrompt.system },
        { role: 'user', content: mentorPrompt.user }
      ],
      temperature: 0.8,
      max_tokens: 300
    });

    const response = completion.choices[0]?.message?.content?.trim();

    // Check if mentor decides to conclude (after minimum exchanges)
    const shouldConclude = exchange_count >= 4 && response?.toLowerCase().includes('[selesai]');

    res.json({
      question: response?.replace('[selesai]', '').trim() || "Bisa ceritakan lebih lanjut tentang alasanmu?",
      type: responseType,
      should_conclude: shouldConclude
    });
  } catch (error) {
    console.error('Follow-up generation error:', error);
    // Personalized fallback based on exchange count
    const fallbacks = [
      "Oke, menarik. Tapi apa yang membuatmu yakin dengan pilihan ini?",
      "Hmm, saya lihat alasanmu. Tapi bagaimana kalau ternyata asumsimu salah?",
      "Coba bayangkan kamu adalah stakeholder yang paling dirugikan. Apa reaksimu?",
      "Sebelum lanjut - apa satu hal yang masih bikin kamu ragu?"
    ];
    res.json({
      question: fallbacks[(req.body.exchange_count || 0) % fallbacks.length],
      type: 'follow_up'
    });
  }
});

/**
 * Build personalized mentor prompt based on archetype and behavior
 */
function buildMentorPrompt(problem, userResponse, profile, exchangeCount, responseType) {
  const archetype = profile?.primary_archetype || 'analyst';
  const thinkingStyle = profile?.thinking_style || 'explorative';
  const language = profile?.language || 'id';

  // Archetype-specific mentoring style
  const archetypeStyles = {
    risk_taker: {
      style: 'langsung, to the point, menantang',
      focus: 'risiko, speed, keberanian, trade-off',
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

  const style = archetypeStyles[archetype] || archetypeStyles.analyst;

  const systemPrompt = `Kamu adalah mentor bisnis yang ${style.style}. Kamu sedang memandu user dalam menyelesaikan masalah nyata.

ATURAN PENTING:
1. JANGAN gunakan kata-kata sulit seperti "reasoning", "trade-off". Gunakan: alasan, untung-rugi, pertimbangan
2. Responmu bisa berupa: pertanyaan lanjutan, penjelasan singkat, tugas kecil, atau refleksi
3. Bicara seperti mentor yang peduli, bukan chatbot
4. Fokus pada: ${style.focus}
5. Waspadai kelemahan archetype ini: ${style.challenge}
6. Maksimal 2-3 kalimat
7. Bahasa Indonesia yang natural dan sederhana

TIPE RESPONMU:
- Exchange 1-2: Gali lebih dalam, minta klarifikasi, pecah jadi sub-masalah
- Exchange 3+: Beri tekanan, stress test, challenge asumsi
- Jika sudah cukup (4+ exchange dan user konsisten), tambahkan [selesai] di akhir

JANGAN:
- Bilang "menarik" atau "bagus" berlebihan
- Gunakan template yang terasa bot
- Tanya hal yang sudah dijawab
- Beri jawaban langsung`;

  const userPrompt = `MASALAH:
${problem.title}
${problem.context}

JAWABAN USER (exchange ke-${exchangeCount}):
"${userResponse}"

Beri respon mentor yang ${responseType === 'stress_test' ? 'menantang dan stress-test' : 'menggali lebih dalam'}:`;

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
    const result = await aiSimple.generateSimpleFollowUp(problem, user_response || '', 0.7);

    // Fallback if generation fails
    const question = result?.question ||
      "Bagaimana kalau asumsi terbesarmu ternyata salah? Apa contingency plan-mu?";

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

export default router;
