/**
 * Onboarding Arena Service
 * 
 * Handles the Arena Onboarding PBL flow:
 * - Curated problem pool by domain
 * - Consequence templates
 * - Silent calibration from decisions
 */

import { invokeAgentAI } from '../config/awsBedrock.js';

const invokeLLM = invokeAgentAI;

// ============================================
// CURATED PROBLEM POOL BY DOMAIN
// Problems designed for 20-second comprehension
// ============================================

const PROBLEM_POOL = {
    tech: {
        id: [
            {
                id: 'onboard_tech_1',
                title: 'Deadline vs Quality',
                context: 'Kamu punya 2 hari untuk menyelesaikan fitur baru. Kode yang ada sekarang bisa jalan, tapi berantakan dan susah di-maintain. Tim QA bilang masih ada 3 bug kecil.',
                objective: 'Tentukan prioritasmu untuk 2 hari ke depan.',
                role: 'developer'
            },
            {
                id: 'onboard_tech_2',
                title: 'Build vs Buy',
                context: 'Ada library open-source yang bisa menghemat 2 minggu development, tapi dokumentasinya kurang bagus dan maintainer-nya kurang aktif.',
                objective: 'Pilih pendekatanmu.',
                role: 'tech_lead'
            }
        ],
        en: [
            {
                id: 'onboard_tech_1',
                title: 'Deadline vs Quality',
                context: 'You have 2 days to complete a new feature. The current code works but is messy and hard to maintain. QA found 3 minor bugs.',
                objective: 'Decide your priority for the next 2 days.',
                role: 'developer'
            },
            {
                id: 'onboard_tech_2',
                title: 'Build vs Buy',
                context: 'There\'s an open-source library that could save 2 weeks of development, but the documentation is poor and the maintainer is less active.',
                objective: 'Choose your approach.',
                role: 'tech_lead'
            }
        ]
    },
    business: {
        id: [
            {
                id: 'onboard_biz_1',
                title: 'Ide Menarik',
                context: 'Sebuah ide sederhana terlihat menarik, tapi waktumu terbatas. Minggu ini, kamu cuma bisa fokus ke satu hal.',
                objective: 'Pilih langkah pertamamu.',
                role: 'founder'
            },
            {
                id: 'onboard_biz_2',
                title: 'Partner or Solo',
                context: 'Ada orang yang tertarik jadi partner bisnismu. Dia punya skill yang kamu ga punya, tapi kalian belum pernah kerja bareng.',
                objective: 'Tentukan keputusanmu.',
                role: 'entrepreneur'
            }
        ],
        en: [
            {
                id: 'onboard_biz_1',
                title: 'Simple Idea',
                context: 'A simple idea looks attractive, but your time is limited. This week, you can only focus on one thing.',
                objective: 'Choose your first step.',
                role: 'founder'
            },
            {
                id: 'onboard_biz_2',
                title: 'Partner or Solo',
                context: 'Someone is interested in becoming your business partner. They have skills you don\'t, but you\'ve never worked together.',
                objective: 'Make your decision.',
                role: 'entrepreneur'
            }
        ]
    },
    creative: {
        id: [
            {
                id: 'onboard_creative_1',
                title: 'Viral vs Authentic',
                context: 'Konten yang paling banyak view biasanya bukan konten yang paling kamu banggakan. Ada tren baru yang bisa bikin viral, tapi ga sesuai style-mu.',
                objective: 'Pilih konten minggu ini.',
                role: 'content_creator'
            }
        ],
        en: [
            {
                id: 'onboard_creative_1',
                title: 'Viral vs Authentic',
                context: 'Content that gets the most views usually isn\'t content you\'re most proud of. There\'s a new trend that could go viral, but it\'s not your style.',
                objective: 'Choose this week\'s content.',
                role: 'content_creator'
            }
        ]
    },
    finance: {
        id: [
            {
                id: 'onboard_finance_1',
                title: 'Risk vs Safety',
                context: 'Ada peluang investasi dengan return tinggi tapi risiko besar. Uang yang kamu punya sekarang hasil kerja keras 6 bulan.',
                objective: 'Tentukan berapa persen yang mau kamu alokasikan.',
                role: 'investor'
            }
        ],
        en: [
            {
                id: 'onboard_finance_1',
                title: 'Risk vs Safety',
                context: 'There\'s an investment opportunity with high returns but big risk. The money you have now is from 6 months of hard work.',
                objective: 'Decide what percentage to allocate.',
                role: 'investor'
            }
        ]
    },
    gaming: {
        id: [
            {
                id: 'onboard_gaming_1',
                title: 'Grind vs Fun',
                context: 'Kamu bisa jadi pro player kalau latihan serius, tapi itu artinya main jadi kurang fun. Ada turnamen dalam 2 bulan.',
                objective: 'Tentukan pendekatanmu.',
                role: 'esports_player'
            }
        ],
        en: [
            {
                id: 'onboard_gaming_1',
                title: 'Grind vs Fun',
                context: 'You could become a pro player with serious practice, but that means playing becomes less fun. There\'s a tournament in 2 months.',
                objective: 'Decide your approach.',
                role: 'esports_player'
            }
        ]
    },
    social: {
        id: [
            {
                id: 'onboard_social_1',
                title: 'Quantity vs Quality',
                context: 'Komunitasmu berkembang pesat. Sekarang ada 2 pilihan: terima semua orang yang mau join, atau seleksi ketat untuk jaga kualitas.',
                objective: 'Pilih pendekatanmu.',
                role: 'community_builder'
            }
        ],
        en: [
            {
                id: 'onboard_social_1',
                title: 'Quantity vs Quality',
                context: 'Your community is growing fast. Now there are 2 options: accept everyone who wants to join, or strict selection to maintain quality.',
                objective: 'Choose your approach.',
                role: 'community_builder'
            }
        ]
    },
    science: {
        id: [
            {
                id: 'onboard_science_1',
                title: 'Publish vs Perfect',
                context: 'Hasil risetmu sudah cukup bagus untuk dipublish, tapi ada beberapa eksperimen tambahan yang bisa memperkuat temuan.',
                objective: 'Tentukan kapan publish.',
                role: 'researcher'
            }
        ],
        en: [
            {
                id: 'onboard_science_1',
                title: 'Publish vs Perfect',
                context: 'Your research results are good enough to publish, but there are some additional experiments that could strengthen the findings.',
                objective: 'Decide when to publish.',
                role: 'researcher'
            }
        ]
    },
    leadership: {
        id: [
            {
                id: 'onboard_leadership_1',
                title: 'Team Conflict',
                context: 'Dua anggota tim terbaikmu punya konflik pribadi. Performa tim mulai menurun. Keduanya sama-sama penting.',
                objective: 'Tentukan langkah pertamamu.',
                role: 'team_lead'
            }
        ],
        en: [
            {
                id: 'onboard_leadership_1',
                title: 'Team Conflict',
                context: 'Two of your best team members have a personal conflict. Team performance is declining. Both are equally important.',
                objective: 'Decide your first step.',
                role: 'team_lead'
            }
        ]
    },
    product: {
        id: [
            {
                id: 'onboard_product_1',
                title: 'Feature Creep',
                context: 'Stakeholder minta 5 fitur baru, tapi deadline tetap. Data menunjukkan 2 fitur yang paling diminta user.',
                objective: 'Tentukan apa yang masuk release.',
                role: 'product_manager'
            }
        ],
        en: [
            {
                id: 'onboard_product_1',
                title: 'Feature Creep',
                context: 'Stakeholders want 5 new features, but the deadline stays the same. Data shows 2 features most requested by users.',
                objective: 'Decide what goes into the release.',
                role: 'product_manager'
            }
        ]
    },
    explore: {
        id: [
            {
                id: 'onboard_explore_1',
                title: 'Focus vs Explore',
                context: 'Kamu punya banyak minat tapi waktu terbatas. Ada satu skill yang sudah lumayan vs coba hal baru yang menarik.',
                objective: 'Pilih fokusmu bulan ini.',
                role: 'learner'
            }
        ],
        en: [
            {
                id: 'onboard_explore_1',
                title: 'Focus vs Explore',
                context: 'You have many interests but limited time. There\'s one skill you\'re decent at vs trying something new that\'s interesting.',
                objective: 'Choose your focus this month.',
                role: 'learner'
            }
        ]
    }
};

// ============================================
// CHOICE TEMPLATES BY DECISION TYPE
// ============================================

const CHOICE_TEMPLATES = {
    id: {
        speed_vs_quality: [
            { id: 'speed', text: 'Selesaikan sekarang, perbaiki nanti', icon: '⚡', archetype_signal: 'risk_taker' },
            { id: 'quality', text: 'Perbaiki dulu, baru lanjut', icon: '🎯', archetype_signal: 'analyst' },
            { id: 'balance', text: 'Fix yang paling kritis, sisanya later', icon: '⚖️', archetype_signal: 'strategist' }
        ],
        risk_vs_safe: [
            { id: 'aggressive', text: 'Ambil kesempatan sekarang', icon: '🔥', archetype_signal: 'risk_taker' },
            { id: 'conservative', text: 'Tunggu momen yang lebih pasti', icon: '🛡️', archetype_signal: 'analyst' },
            { id: 'partial', text: 'Coba dengan skala kecil dulu', icon: '🌱', archetype_signal: 'builder' }
        ],
        build_vs_leverage: [
            { id: 'build', text: 'Buat sendiri dari awal', icon: '🔧', archetype_signal: 'builder' },
            { id: 'leverage', text: 'Pakai yang sudah ada', icon: '📦', archetype_signal: 'strategist' },
            { id: 'hybrid', text: 'Kombinasi keduanya', icon: '🔀', archetype_signal: 'analyst' }
        ],
        solo_vs_team: [
            { id: 'solo', text: 'Kerjakan sendiri', icon: '🚀', archetype_signal: 'builder' },
            { id: 'team', text: 'Ajak orang lain', icon: '🤝', archetype_signal: 'strategist' },
            { id: 'delegate', text: 'Delegasikan sepenuhnya', icon: '📋', archetype_signal: 'risk_taker' }
        ]
    },
    en: {
        speed_vs_quality: [
            { id: 'speed', text: 'Finish now, fix later', icon: '⚡', archetype_signal: 'risk_taker' },
            { id: 'quality', text: 'Fix first, then proceed', icon: '🎯', archetype_signal: 'analyst' },
            { id: 'balance', text: 'Fix critical issues, rest later', icon: '⚖️', archetype_signal: 'strategist' }
        ],
        risk_vs_safe: [
            { id: 'aggressive', text: 'Take the opportunity now', icon: '🔥', archetype_signal: 'risk_taker' },
            { id: 'conservative', text: 'Wait for a better moment', icon: '🛡️', archetype_signal: 'analyst' },
            { id: 'partial', text: 'Try with small scale first', icon: '🌱', archetype_signal: 'builder' }
        ],
        build_vs_leverage: [
            { id: 'build', text: 'Build from scratch', icon: '🔧', archetype_signal: 'builder' },
            { id: 'leverage', text: 'Use what exists', icon: '📦', archetype_signal: 'strategist' },
            { id: 'hybrid', text: 'Combine both', icon: '🔀', archetype_signal: 'analyst' }
        ],
        solo_vs_team: [
            { id: 'solo', text: 'Do it yourself', icon: '🚀', archetype_signal: 'builder' },
            { id: 'team', text: 'Bring others in', icon: '🤝', archetype_signal: 'strategist' },
            { id: 'delegate', text: 'Delegate completely', icon: '📋', archetype_signal: 'risk_taker' }
        ]
    }
};

// ============================================
// CONSEQUENCE TEMPLATES
// ============================================

const CONSEQUENCE_TEMPLATES = {
    id: {
        speed: 'Langkah cepat, tapi ada yang mungkin terlewat.',
        quality: 'Lebih solid, tapi waktu jadi lebih sempit.',
        balance: 'Kompromi yang masuk akal, tapi tidak optimal di kedua sisi.',
        aggressive: 'Berani, tapi risikonya nyata kalau gagal.',
        conservative: 'Aman, tapi mungkin kehilangan momen.',
        partial: 'Pintar, tapi hasilnya tidak akan maksimal.',
        build: 'Kontrol penuh, tapi butuh waktu dan energi.',
        leverage: 'Efisien, tapi kamu bergantung pada orang lain.',
        hybrid: 'Fleksibel, tapi bisa jadi kompleks.',
        solo: 'Bebas, tapi semua tanggung jawab di pundakmu.',
        team: 'Ada bantuan, tapi ada koordinasi yang harus dikelola.',
        delegate: 'Waktu tersedia, tapi kontrol berkurang.',
    },
    en: {
        speed: 'Quick move, but something might be missed.',
        quality: 'More solid, but time becomes tighter.',
        balance: 'Reasonable compromise, but not optimal on either side.',
        aggressive: 'Bold, but the risk is real if it fails.',
        conservative: 'Safe, but might miss the moment.',
        partial: 'Smart, but results won\'t be maximal.',
        build: 'Full control, but takes time and energy.',
        leverage: 'Efficient, but you depend on others.',
        hybrid: 'Flexible, but could become complex.',
        solo: 'Free, but all responsibility is on you.',
        team: 'Support available, but coordination needed.',
        delegate: 'Time freed up, but less control.',
    }
};

// ============================================
// INSIGHT TEMPLATES
// ============================================

const INSIGHT_TEMPLATES = {
    id: {
        risk_taker: [
            'Kecepatan sering memenangkan game, tapi bukan kalau kamu jatuh duluan.',
            'Berani itu bagus. Berani dengan perhitungan itu lebih bagus.',
        ],
        analyst: [
            'Data itu penting, tapi kadang keputusan harus dibuat sebelum data lengkap.',
            'Analisis tanpa batas waktu bisa jadi prokrastinasi.',
        ],
        builder: [
            'Eksekusi mengalahkan rencana sempurna yang tidak pernah jadi.',
            'Build fast, learn faster.',
        ],
        strategist: [
            'Memikirkan long-term itu bagus, asal jangan lupa bertahan di short-term.',
            'Strategi tanpa aksi adalah mimpi. Aksi tanpa strategi adalah chaos.',
        ]
    },
    en: {
        risk_taker: [
            'Speed often wins the game, but not if you fall first.',
            'Bold is good. Calculated boldness is better.',
        ],
        analyst: [
            'Data is important, but sometimes decisions must be made before data is complete.',
            'Analysis without a deadline can become procrastination.',
        ],
        builder: [
            'Execution beats a perfect plan that never happens.',
            'Build fast, learn faster.',
        ],
        strategist: [
            'Thinking long-term is good, just don\'t forget to survive short-term.',
            'Strategy without action is a dream. Action without strategy is chaos.',
        ]
    }
};

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get a random problem from the pool based on domain
 */
export function getOnboardingProblem(domain, language = 'id') {
    const lang = language === 'en' ? 'en' : 'id';
    const problems = PROBLEM_POOL[domain]?.[lang] || PROBLEM_POOL['business'][lang];

    const randomIndex = Math.floor(Math.random() * problems.length);
    return problems[randomIndex];
}

/**
 * Get choice options based on problem type
 */
export function getChoiceOptions(problemId, language = 'id') {
    const lang = language === 'en' ? 'en' : 'id';

    // Determine choice type based on problem
    let choiceType = 'risk_vs_safe';
    if (problemId.includes('tech')) choiceType = 'speed_vs_quality';
    else if (problemId.includes('biz')) choiceType = 'risk_vs_safe';
    else if (problemId.includes('creative')) choiceType = 'build_vs_leverage';
    else if (problemId.includes('social') || problemId.includes('leadership')) choiceType = 'solo_vs_team';

    return CHOICE_TEMPLATES[lang][choiceType] || CHOICE_TEMPLATES[lang]['risk_vs_safe'];
}

/**
 * Get consequence for a choice
 */
export function getConsequence(choiceId, language = 'id') {
    const lang = language === 'en' ? 'en' : 'id';
    return CONSEQUENCE_TEMPLATES[lang][choiceId] || CONSEQUENCE_TEMPLATES[lang]['balance'];
}

/**
 * Get insight based on archetype signal
 */
export function getInsight(archetypeSignal, language = 'id') {
    const lang = language === 'en' ? 'en' : 'id';
    const insights = INSIGHT_TEMPLATES[lang][archetypeSignal] || INSIGHT_TEMPLATES[lang]['strategist'];

    const randomIndex = Math.floor(Math.random() * insights.length);
    return insights[randomIndex];
}

/**
 * Calculate silent calibration from onboarding arena decisions
 */
export function calculateSilentCalibration(decisions, ageGroup) {
    // Initialize base values
    let risk_appetite = 0.5;
    let decision_speed = 0.5;
    let ambiguity_tolerance = 0.5;
    let experience_depth = 0.5;

    // Count archetype signals
    const archetypeCounts = {
        risk_taker: 0,
        analyst: 0,
        builder: 0,
        strategist: 0
    };

    // Analyze decisions
    decisions.forEach(decision => {
        if (decision.archetype_signal) {
            archetypeCounts[decision.archetype_signal] = (archetypeCounts[decision.archetype_signal] || 0) + 1;
        }

        // Adjust based on choice speed
        if (decision.time_to_decide) {
            if (decision.time_to_decide < 5000) { // Less than 5 seconds
                decision_speed += 0.1;
                risk_appetite += 0.05;
            } else if (decision.time_to_decide > 15000) { // More than 15 seconds
                decision_speed -= 0.1;
                ambiguity_tolerance += 0.05;
            }
        }
    });

    // Determine primary archetype
    const primary_archetype = Object.entries(archetypeCounts)
        .reduce((a, b) => archetypeCounts[a[0]] > archetypeCounts[b[0]] ? a : b)[0];

    // Adjust based on archetype
    switch (primary_archetype) {
        case 'risk_taker':
            risk_appetite += 0.2;
            decision_speed += 0.1;
            break;
        case 'analyst':
            ambiguity_tolerance -= 0.1;
            decision_speed -= 0.1;
            break;
        case 'builder':
            decision_speed += 0.15;
            experience_depth += 0.1;
            break;
        case 'strategist':
            ambiguity_tolerance += 0.15;
            experience_depth += 0.1;
            break;
    }

    // Adjust experience depth based on age
    if (ageGroup === 'smp') {
        experience_depth = Math.min(experience_depth, 0.4);
    } else if (ageGroup === 'sma') {
        experience_depth = Math.min(experience_depth, 0.6);
    }

    // Clamp values
    risk_appetite = Math.max(0.1, Math.min(0.9, risk_appetite));
    decision_speed = Math.max(0.1, Math.min(0.9, decision_speed));
    ambiguity_tolerance = Math.max(0.1, Math.min(0.9, ambiguity_tolerance));
    experience_depth = Math.max(0.1, Math.min(0.9, experience_depth));

    // Calculate starting difficulty
    const avgScore = (risk_appetite + decision_speed + ambiguity_tolerance + experience_depth) / 4;
    let current_difficulty = Math.ceil(avgScore * 5);

    // Limit by age
    if (ageGroup === 'smp') {
        current_difficulty = Math.min(3, current_difficulty);
    } else if (ageGroup === 'sma') {
        current_difficulty = Math.min(5, current_difficulty);
    }

    return {
        risk_appetite,
        decision_speed,
        ambiguity_tolerance,
        experience_depth,
        current_difficulty,
        primary_archetype,
        age_group: ageGroup,
        calibration_completed: true,
        // Initialize XP
        xp_risk_taker: 0,
        xp_analyst: 0,
        xp_builder: 0,
        xp_strategist: 0,
        total_arenas_completed: 0,
        highest_difficulty_conquered: 0
    };
}

/**
 * Generate AI-powered problem for onboarding (optional, if curated pool not sufficient)
 */
export async function generateAIOnboardingProblem(domain, language = 'id', ageGroup = 'adult') {
    const langInstruction = language === 'en' ? 'Respond in English.' : 'Respond in Indonesian (Bahasa Indonesia).';

    const ageGuidance = {
        'smp': 'Use casual, friendly language for teens (12-15). Simple scenarios.',
        'sma': 'Use moderately professional language for high schoolers (16-18).',
        'adult': 'Use professional language for adults (19+).'
    };

    const prompt = `Generate a MICRO problem for onboarding arena. This should be:
- Readable in 20 seconds
- Universal (no specific domain knowledge needed)
- Single decision point
- Clear trade-offs

Domain: ${domain}
Age group: ${ageGroup} - ${ageGuidance[ageGroup] || ageGuidance['adult']}

Create a problem with 3 concrete choices. Each choice should signal a different archetype:
- risk_taker: Bold, fast, high-risk
- analyst: Careful, data-driven, thorough
- builder: Action-oriented, execution-focused
- strategist: Long-term thinking, stakeholder-aware

${langInstruction}`;

    try {
        const response = await invokeLLM({
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    context: { type: "string" },
                    objective: { type: "string" },
                    role: { type: "string" },
                    choices: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                text: { type: "string" },
                                icon: { type: "string" },
                                archetype_signal: { type: "string" }
                            }
                        }
                    }
                },
                required: ["id", "title", "context", "objective", "choices"]
            }
        });

        return response;
    } catch (error) {
        console.error('generateAIOnboardingProblem error:', error);
        // Fallback to curated problem
        return getOnboardingProblem(domain, language);
    }
}

export default {
    getOnboardingProblem,
    getChoiceOptions,
    getConsequence,
    getInsight,
    calculateSilentCalibration,
    generateAIOnboardingProblem,
    PROBLEM_POOL,
    CHOICE_TEMPLATES,
    CONSEQUENCE_TEMPLATES,
    INSIGHT_TEMPLATES
};
