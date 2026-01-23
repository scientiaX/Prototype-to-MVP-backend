import { invokeAgentAI } from '../config/googleAI.js';

// Use invokeAgentAI instead of invokeLLM for all functions in this service
const invokeLLM = invokeAgentAI;

/**
 * AI Agent Service - Layer 3 of 3-Layer AI Engine (Heavy/Complex Operations)
 * 
 * This layer handles:
 * - Personalized problem generation
 * - Full solution evaluation with follow-up questions
 * - Characteristics-based XP calculation
 * 
 * Cost: HIGHER (~$0.01 per call using GPT-4 / Claude Sonnet)
 */

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get language instruction for AI prompts
 */
const getLanguageInstruction = (profile) => {
  const lang = profile?.language || 'en';
  if (lang === 'id') {
    return 'Respond in Indonesian (Bahasa Indonesia).';
  }
  return 'Respond in English.';
};

/**
 * Identify weak archetypes from profile (for training)
 */
const identifyWeakArchetypes = (profile) => {
  const xpValues = {
    risk_taker: profile.xp_risk_taker || 0,
    analyst: profile.xp_analyst || 0,
    builder: profile.xp_builder || 0,
    strategist: profile.xp_strategist || 0
  };

  const total = Object.values(xpValues).reduce((a, b) => a + b, 0);
  if (total === 0) return ['risk_taker', 'analyst', 'builder', 'strategist'];

  const avgProportion = 0.25;
  const weak = [];

  Object.entries(xpValues).forEach(([key, value]) => {
    if ((value / total) < avgProportion - 0.1) {
      weak.push(key);
    }
  });

  return weak.length > 0 ? weak : ['risk_taker']; // Default to risk_taker if balanced
};

/**
 * Identify strong archetypes from profile (for sharpening)
 */
const identifyStrongArchetypes = (profile) => {
  const xpValues = {
    risk_taker: profile.xp_risk_taker || 0,
    analyst: profile.xp_analyst || 0,
    builder: profile.xp_builder || 0,
    strategist: profile.xp_strategist || 0
  };

  const total = Object.values(xpValues).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  const avgProportion = 0.25;
  const strong = [];

  Object.entries(xpValues).forEach(([key, value]) => {
    if ((value / total) > avgProportion + 0.1) {
      strong.push(key);
    }
  });

  return strong;
};

// ==========================================
// PERSONALIZED PROBLEM GENERATION
// ==========================================

/**
 * Generate a personalized problem that trains weak archetypes and sharpens strong ones
 * @param {Object} profile - User profile
 * @param {Object} sessionHistory - Optional session history
 * @param {number} durationMinutes - Target duration (10 for light, 30 for standard)
 * @param {Array} completedProblems - Previously completed problems to avoid redundancy
 */
export const generatePersonalizedProblem = async (profile, sessionHistory = null, durationMinutes = 30, completedProblems = []) => {
  const weakArchetypes = identifyWeakArchetypes(profile);
  const strongArchetypes = identifyStrongArchetypes(profile);

  // Calculate effective difficulty with experience adjustment
  const baseDifficulty = profile.current_difficulty || 1;
  const microOffset = profile.micro_difficulty_offset || 0;

  // Adjust difficulty based on experience level
  const experienceLevelMap = {
    'curious': -1,
    'beginner': -0.5,
    'learning': 0,
    'intermediate': 0.5,
    'advanced': 1,
    'expert': 1.5
  };
  const experienceAdjustment = experienceLevelMap[profile.experience_level] || 0;
  const effectiveDifficulty = Math.max(1, Math.min(10, baseDifficulty + microOffset + experienceAdjustment));

  // Age-specific language guidance
  const ageGuidance = {
    'smp': 'Use casual, friendly language. Scenarios should be relatable to teens (12-15). Avoid complex business jargon. Focus on school projects, content creation, small ventures, gaming etc.',
    'sma': 'Use moderately professional language. Scenarios can involve early business, content creation, college prep, freelance etc. Mix casual and professional.',
    'adult': 'Use professional language. Full business/tech scenarios with real stakes, team management, investment decisions etc.'
  };

  // Duration-based complexity adjustment
  const isLightMode = durationMinutes <= 10;
  const durationGuidance = isLightMode
    ? `
DURATION MODE: LIGHT (10 minutes)
- Create a SIMPLER, more focused problem
- Maximum 2 constraints (not more)
- Single clear decision to make
- Less context, more direct question
- Suitable for quick practice sessions
- Problem should be solvable with 2-3 short responses`
    : `
DURATION MODE: STANDARD (30 minutes)
- Full complexity problem
- 3-5 constraints allowed
- Multi-layered decision required
- Rich context with stakeholder considerations
- Deep exploration expected
- Problem should require 5-7 thoughtful exchanges`;

  // Build uniqueness context from completed problems
  let uniquenessGuidance = '';
  if (completedProblems && completedProblems.length > 0) {
    const problemsList = completedProblems.slice(0, 10).map((p, i) =>
      `${i + 1}. "${p.title}" (${p.domain || 'unknown'} - ${p.role || 'unknown'})`
    ).join('\n');

    uniquenessGuidance = `
UNIQUENESS REQUIREMENT - CRITICAL:
User has completed ${completedProblems.length} problems. DO NOT generate similar problems:
${problemsList}

YOU MUST:
1. Use a DIFFERENT industry/scenario than completed problems
2. Use a DIFFERENT role/perspective if possible  
3. Present a DIFFERENT type of core dilemma
4. If same domain, go DEEPER or use significantly different angle
5. User should NOT feel "I've seen this before"
`;
  }

  const prompt = `Generate a personalized problem-solving challenge.

USER PROFILE:
- Age group: ${profile.age_group || 'adult'} (${ageGuidance[profile.age_group] || ageGuidance['adult']})
- Experience level: ${profile.experience_level || 'beginner'}
- Experience proof: "${profile.experience_proof || 'No specific proof provided'}"
- Primary archetype: ${profile.primary_archetype}
- Domain: ${profile.domain || 'business'}
- Risk appetite: ${profile.risk_appetite || 0.5}/1
- Decision speed: ${profile.decision_speed || 0.5}/1
- Ambiguity tolerance: ${profile.ambiguity_tolerance || 0.5}/1
- Current difficulty level: ${profile.current_difficulty || 1}
- Thinking style: ${profile.thinking_style || 'explorative'}

PERSONALIZATION TARGETS:
- TRAIN (weak areas): ${weakArchetypes.join(', ') || 'none'}
- SHARPEN (strong areas): ${strongArchetypes.join(', ') || 'none'}
- Effective difficulty: ${effectiveDifficulty.toFixed(1)} (base ${baseDifficulty} + experience ${experienceAdjustment} + micro ${microOffset.toFixed(2)})
- Target duration: ${durationMinutes} minutes
${durationGuidance}

ARCHETYPE TRAINING GUIDE:
- risk_taker: Include high-stakes decisions with incomplete information, time pressure
- analyst: Include scenarios requiring deep data analysis with ambiguous data
- builder: Include execution-focused scenarios with resource constraints
- strategist: Include long-term planning with multiple stakeholder perspectives

ROLE OPTIONS (pick one that fits the problem AND user's age group):
ceo, product_manager, engineer, designer, founder, consultant, investor, operations, team_lead, analyst, content_creator, project_lead

Create a REAL-WORLD problem that:
1. MATCHES the user's age group and experience level
2. References their specific domain and experience proof when relevant
3. Has incomplete data (require user to make assumptions)
4. Requires decisive action (not just analysis)
5. Has clear trade-offs that hurt
6. Cannot be solved with a "safe" answer
7. Subtly requires skills from the TRAIN archetypes
8. Allows user to leverage SHARPEN archetypes
9. Is challenging but achievable for someone at this difficulty and experience level

CRITICAL: This platform confronts users with hard choices. Don't soften the problem. Make it realistic and uncomfortable for their level.
${uniquenessGuidance}
${getLanguageInstruction(profile)} Generate unique problem_id with format "PROB-{timestamp}".`;

  const response = await invokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        problem_id: { type: "string" },
        title: { type: "string" },
        context: { type: "string" },
        objective: { type: "string" },
        constraints: { type: "array", items: { type: "string" } },
        difficulty: { type: "integer" },
        level_up_criteria: { type: "array", items: { type: "string" } },
        domain: { type: "string" },
        role_label: { type: "string" },
        estimated_time_minutes: { type: "integer" },
        personalization_reasoning: { type: "string" }
      },
      required: ["problem_id", "title", "context", "objective", "difficulty", "role_label"]
    }
  });

  // Add personalization metadata
  if (response) {
    response.generated_for_user = profile.user_id;
    response.estimated_time_minutes = durationMinutes; // Ensure correct duration is set
    response.personalization_factors = {
      target_archetype_training: weakArchetypes,
      target_archetype_sharpening: strongArchetypes,
      difficulty_micro_adjustment: microOffset,
      generation_reasoning: response.personalization_reasoning || 'AI-generated based on profile'
    };
  }

  return response;
};

// ==========================================
// ORIGINAL PROBLEM GENERATION (kept for backward compatibility)
// ==========================================

export const generateProblem = async (profile, customization = null) => {
  // Extract completedProblems if provided
  const completedProblems = customization?.completedProblems || [];

  // Check if customization only contains durationMinutes (and optionally completedProblems)
  const customKeys = Object.keys(customization || {}).filter(k => k !== 'completedProblems');
  if (!customization || (customKeys.length <= 1 && customization.durationMinutes)) {
    const durationMinutes = customization?.durationMinutes || 30;
    return await generatePersonalizedProblem(profile, null, durationMinutes, completedProblems);
  }

  // Otherwise use custom parameters
  const domainText = customization.domains?.join(', ') || profile.domain || 'business';
  const problemTypeText = customization.problemType
    ? `Focus on ${customization.problemType} scenario.`
    : '';
  const contextText = customization.customContext
    ? `\n\nUser context: ${customization.customContext}`
    : '';
  const constraintsText = customization.specificConstraints
    ? `\n\nSpecific constraints to include: ${customization.specificConstraints}`
    : '';

  const prompt = `Generate a challenging real-world problem for someone with:
- Profile archetype: ${profile.primary_archetype}
- Current level: ${profile.current_difficulty}
- Risk appetite: ${profile.risk_appetite}
- Thinking style: ${profile.thinking_style}

USER CUSTOMIZATION:
- Domains: ${domainText}
- Target difficulty: ${customization.minDifficulty || profile.current_difficulty}-${customization.maxDifficulty || profile.current_difficulty + 2}
- Time limit: ${customization.timeLimit || 30} minutes
${problemTypeText}${contextText}${constraintsText}

Create a REAL-WORLD problem that:
1. Has incomplete data
2. Requires a decisive action (not just analysis)
3. Has clear trade-offs that hurt
4. Cannot be solved with a "safe" answer
5. Reflects the user's specified domains and constraints
6. Is challenging but solvable within the time limit

ROLE OPTIONS: ceo, product_manager, engineer, designer, founder, consultant, investor, operations, team_lead, analyst

CRITICAL: This is for a platform that confronts users with hard choices. Don't soften the problem. Make it realistic and uncomfortable.

${getLanguageInstruction(profile)}`;

  const response = await invokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        problem_id: { type: "string" },
        title: { type: "string" },
        context: { type: "string" },
        objective: { type: "string" },
        constraints: { type: "array", items: { type: "string" } },
        difficulty: { type: "integer" },
        level_up_criteria: { type: "array", items: { type: "string" } },
        domain: { type: "string" },
        role_label: { type: "string" },
        estimated_time_minutes: { type: "integer" }
      },
      required: ["problem_id", "title", "context", "objective", "difficulty"]
    }
  });

  return response;
};

// ==========================================
// ENHANCED SOLUTION EVALUATION
// ==========================================

export const evaluateSolution = async (problem, solution, timeElapsed, sessionMetrics = null, profile = null) => {
  // Build metrics context if available
  let metricsContext = '';
  if (sessionMetrics) {
    metricsContext = `
RESPONSE METRICS:
- Average response speed: ${sessionMetrics.avg_response_speed || 'N/A'}/10
- Decision confidence: ${sessionMetrics.decision_confidence_score || 'N/A'}/10
- Intervention count: ${sessionMetrics.intervention_count || 0}
- Keystroke rhythm: ${sessionMetrics.keystroke_rhythm || 'N/A'}
`;
  }

  const evaluationPrompt = `${profile?.language === 'en' ? 'You are a mentor testing decisions. Evaluate the following solution:' : 'Kamu adalah mentor yang menguji keputusan. Evaluasi solusi berikut:'}

${profile?.language === 'en' ? 'PROBLEM:' : 'MASALAH:'}
${problem.title}
${problem.context}

OBJECTIVE:
${problem.objective}

CONSTRAINTS:
${problem.constraints?.join(', ') || 'Tidak ada constraint khusus'}

KRITERIA NAIK LEVEL:
${problem.level_up_criteria?.join(', ') || 'Keputusan yang jelas dan reasoning yang solid'}

ROLE DALAM MASALAH: ${problem.role_label || 'decision_maker'}

SOLUSI USER:
${solution}

WAKTU: ${Math.floor(timeElapsed / 60)} menit ${timeElapsed % 60} detik
${metricsContext}

Evaluasi dengan TAJAM dan SINGKAT. Tentukan:
1. Apakah user menghadapi risiko inti atau bermain aman?
2. Apakah trade-off dijelaskan eksplisit?
3. Apakah ada keputusan nyata atau hanya deskripsi?
4. Apakah reasoning solid atau superficial?

XP ASSIGNMENT RULES:
- XP hanya diberikan kalau capability/keandalan NAIK (tidak stagnan)
- Karakteristik respon menentukan archetype mana yang dapat XP:
  * Fast + decisive response = risk_taker XP
  * Thorough analysis = analyst XP  
  * Action-oriented answer = builder XP
  * Long-term perspective = strategist XP
- Quality/level respon menentukan JUMLAH XP (0-20 per archetype)
- Jika respon stagnan (tidak ada improvement), semua XP bisa = 0

${profile?.language === 'en' ? 'Give a confrontational evaluation, not praise.' : 'Berikan evaluasi yang konfrontatif, bukan memuji.'}

${getLanguageInstruction(profile)}`;

  const evaluation = await invokeLLM({
    prompt: evaluationPrompt,
    response_json_schema: {
      type: "object",
      properties: {
        evaluation: { type: "string" },
        insight: { type: "string" },
        criteria_met: { type: "array", items: { type: "string" } },
        level_up_achieved: { type: "boolean" },
        quality_score: { type: "number" },
        xp_risk_taker: { type: "integer" },
        xp_analyst: { type: "integer" },
        xp_builder: { type: "integer" },
        xp_strategist: { type: "integer" },
        stagnation_detected: { type: "boolean" },
        improvement_areas: { type: "array", items: { type: "string" } }
      },
      required: ["evaluation", "level_up_achieved", "quality_score", "xp_risk_taker", "xp_analyst", "xp_builder", "xp_strategist"]
    }
  });

  return evaluation;
};

// ==========================================
// XP CALCULATION FROM CHARACTERISTICS
// ==========================================

/**
 * Calculate XP based on response characteristics (for fine-grained control)
 */
export const generateXPFromCharacteristics = async (metrics, problem, profile, userResponse) => {
  const prompt = `Evaluate user performance and assign XP berdasarkan KARAKTERISTIK respon, bukan hasil akhir.

PROBLEM:
${problem.title} (Difficulty: ${problem.difficulty})

USER PROFILE:
- Primary archetype: ${profile.primary_archetype}
- Current levels: risk_taker=${profile.level_risk_taker || 1}, analyst=${profile.level_analyst || 1}, builder=${profile.level_builder || 1}, strategist=${profile.level_strategist || 1}

RESPONSE METRICS:
- Response speed score: ${metrics.avg_response_speed || 5}/10 (10 = very fast)
- Understanding clarity: ${metrics.understanding_clarity || 0.5}/1
- Decision confidence: ${metrics.decision_confidence_score || 5}/10 (based on revisions)
- Intervention received: ${metrics.interventions_received || 0}
- Keystroke rhythm: ${metrics.keystroke_rhythm || 'mixed'}

USER RESPONSE PREVIEW:
${userResponse.substring(0, 500)}...

XP ASSIGNMENT RULES (STRICT):
1. XP hanya diberikan jika capability NAIK - tidak untuk performa biasa
2. Jika respon stagnan (sama karakteristik dengan session sebelumnya), XP = 0
3. Karakteristik respon menentukan archetype mana yang dapat XP:
   - Fast response + decisive action = risk_taker XP
   - Deep analysis + data consideration = analyst XP
   - Action-oriented + execution focus = builder XP
   - Long-term thinking + stakeholder awareness = strategist XP
4. Level respon (keandalan) menentukan jumlah XP per archetype (0-20)

Evaluate dan assign XP yang AKURAT untuk setiap archetype.`;

  const response = await invokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        xp_risk_taker: { type: "integer", minimum: 0, maximum: 20 },
        xp_analyst: { type: "integer", minimum: 0, maximum: 20 },
        xp_builder: { type: "integer", minimum: 0, maximum: 20 },
        xp_strategist: { type: "integer", minimum: 0, maximum: 20 },
        reasoning: { type: "string" },
        capability_improved: { type: "boolean" },
        stagnation_detected: { type: "boolean" }
      },
      required: ["xp_risk_taker", "xp_analyst", "xp_builder", "xp_strategist", "capability_improved"]
    }
  });

  return response;
};

// ==========================================
// FOLLOW-UP QUESTIONS (Complex)
// ==========================================

/**
 * Generate follow-up questions for deeper evaluation
 */
export const generateFollowUpQuestions = async (problem, userResponse, evaluationContext) => {
  const prompt = `User telah memberikan solusi untuk masalah. Generate pertanyaan follow-up untuk menguji pemahaman lebih dalam.

PROBLEM: ${problem.title}
OBJECTIVE: ${problem.objective}

USER'S SOLUTION:
${userResponse.substring(0, 500)}

Generate 2-3 pertanyaan follow-up yang:
1. Stress-test asumsi user
2. Menguji pemahaman tentang trade-off
3. Meminta penjelasan lebih detail tentang implementasi

Contoh kategori:
- "Bagaimana kalau X tidak bekerja seperti yang kamu harapkan?"
- "Apa plan B kalau asumsi utamamu salah?"
- "Siapa yang akan paling keberatan dengan keputusan ini?"

${getLanguageInstruction({ language: 'id' })}`;

  const response = await invokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              intent: { type: "string" },
              expected_depth: { type: "string", enum: ["surface", "medium", "deep"] }
            }
          }
        }
      },
      required: ["questions"]
    }
  });

  return response;
};

// ==========================================
// SOCRATIC QUESTION GENERATION
// ==========================================

export const generateSocraticQuestion = async (problem, profile, context = 'initial') => {
  const langInst = getLanguageInstruction(profile);
  let prompt;

  if (context === 'initial') {
    prompt = `Kamu adalah mentor Socratic. User baru mulai problem:

PROBLEM: ${problem.title}
CONTEXT: ${problem.context}
OBJECTIVE: ${problem.objective}
ROLE: ${problem.role_label || 'decision_maker'}

User archetype: ${profile.primary_archetype}
Thinking style: ${profile.thinking_style}

Generate 1 pertanyaan pembuka yang:
1. Memaksa user breakdown masalah inti
2. Tidak terlalu luas, tidak terlalu sempit
3. Socratic - buat user berpikir sendiri
4. 1 kalimat saja

Contoh: "Apa satu hal yang paling kamu takutkan kalau keputusan ini salah?"

Output hanya pertanyaan. ${langInst}`;
  } else if (context === 'pause') {
    prompt = `User stuck di problem:

PROBLEM: ${problem.title}
User archetype: ${profile.primary_archetype}

Generate 1 pertanyaan singkat yang:
1. Nudge tanpa spoiler
2. Socratic style
3. 1 kalimat

Output hanya pertanyaan. ${langInst}`;
  }

  const response = await invokeLLM({ prompt });
  return response;
};

// ==========================================
// ENTRY FLOW AI FUNCTIONS
// Based on arena_first_3_minutes_high_impact_entry_design.md
// ==========================================

/**
 * Generate forced choice options for the entry flow
 * Creates 2-3 concrete options that all seem reasonable but have different trade-offs
 */
export const generateEntryFlowChoices = async (problem, context, objective) => {
  const prompt = `Kamu adalah designer UX untuk arena problem-solving. User baru masuk dan perlu membuat keputusan cepat.

PROBLEM:
${problem.title}

CONTEXT:
${context}

OBJECTIVE:
${objective}

Generate 3 pilihan aksi yang:
1. Semua tampak masuk akal
2. Tidak ada yang "100% aman" atau "100% berisiko"
3. Masing-masing punya trade-off yang berbeda
4. Konkret dan actionable (bukan abstrak)
5. Bisa dipilih dalam 15-25 detik tanpa overthinking

CRITICAL: Ini untuk 3 menit pertama arena - user harus merasa langsung masuk aksi, bukan analisis.

Icons yang available: 🔥 (aggressive/bold), 🛡️ (defensive/safe), 🤝 (collaborative), ⚡ (quick/decisive), 💡 (creative/innovative), 📊 (data-driven), 🎯 (focused), 🌱 (growth), 💰 (financial)

Buat juga 1 pertanyaan refleksi yang akan ditanyakan SETELAH user memilih. Pertanyaan ini harus spesifik tentang pilihan yang dibuat.

Output in the same language as the problem.`;

  try {
    const response = await invokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          choices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                text: { type: "string" },
                icon: { type: "string" },
                hint: { type: "string" }
              },
              required: ["id", "text", "icon", "hint"]
            }
          },
          reflection_question: { type: "string" }
        },
        required: ["choices", "reflection_question"]
      }
    });

    return response;
  } catch (error) {
    console.error('generateEntryFlowChoices error:', error);
    return {
      choices: [
        { id: 'aggressive', text: 'Ambil langkah agresif', icon: '🔥', hint: 'Risiko tinggi, reward potensial tinggi' },
        { id: 'conservative', text: 'Pertahankan posisi aman', icon: '🛡️', hint: 'Lebih aman tapi lambat' },
        { id: 'collaborative', text: 'Cari bantuan eksternal', icon: '🤝', hint: 'Butuh networking dan trust' }
      ],
      reflection_question: 'Kenapa kamu memilih opsi tersebut?'
    };
  }
};

/**
 * Generate consequence based on user's choice
 * Creates the "tamparan" moment - user realizes their choice has a cost
 */
export const generateEntryFlowConsequence = async (problem, choiceId, choiceText, context) => {
  const prompt = `User baru membuat keputusan di arena. Generate konsekuensi yang membuat user menyadari bahwa keputusan mereka punya biaya.

PROBLEM:
${problem.title}

CONTEXT:
${context}

OBJECTIVE:
${problem.objective}

KEPUTUSAN USER:
${choiceText}

Generate 2 konsekuensi yang:
1. REALISTIS - bisa terjadi di dunia nyata
2. IMMEDIATE - langsung terasa, bukan "suatu hari nanti"
3. PAINFUL - ada sesuatu yang hilang atau terkompromi
4. SPESIFIK - bukan generik seperti "ada risiko"
5. CONNECTED - berhubungan langsung dengan pilihan yang dibuat

CRITICAL: Ini adalah "tamparan pertama" - user harus menyadari bahwa setiap keputusan punya biaya. Jangan terlalu sadis, tapi jangan juga terlalu lembut.

Juga generate 1 insight singkat (1 kalimat) yang menyimpulkan pembelajaran dari konsekuensi ini.

Output in the same language as the problem.`;

  try {
    const response = await invokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          consequences: {
            type: "array",
            items: { type: "string" }
          },
          insight: { type: "string" }
        },
        required: ["consequences", "insight"]
      }
    });

    return response;
  } catch (error) {
    console.error('generateEntryFlowConsequence error:', error);
    return {
      consequences: [
        'Keputusanmu membawa dampak yang tidak terduga.',
        'Ada pihak yang tidak setuju dengan arah yang kamu pilih.'
      ],
      insight: 'Setiap keputusan punya biaya yang harus dibayar.'
    };
  }
};

export default {
  generateProblem,
  generatePersonalizedProblem,
  evaluateSolution,
  generateXPFromCharacteristics,
  generateFollowUpQuestions,
  generateSocraticQuestion,
  generateEntryFlowChoices,
  generateEntryFlowConsequence,
  identifyWeakArchetypes,
  identifyStrongArchetypes
};
