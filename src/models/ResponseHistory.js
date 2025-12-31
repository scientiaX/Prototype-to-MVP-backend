import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * ResponseHistory - Stores response patterns for similarity detection
 * 
 * SPEC #3: Exploit Surface Lockdown
 * - Detects pattern replay across scenarios
 * - Enables similarity detection on reasoning paths
 * - Used for cooldown/freeze decisions
 */
const responseHistorySchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        index: true
    },
    session_id: {
        type: String,
        required: true,
        index: true
    },
    problem_id: {
        type: String,
        required: true
    },
    // Hash of normalized response for quick comparison
    response_hash: {
        type: String,
        required: true,
        index: true
    },
    // Extracted keywords for semantic similarity
    keywords: [{
        type: String
    }],
    // Key phrases that represent decision patterns
    decision_patterns: [{
        type: String
    }],
    // Response metadata
    response_length: {
        type: Number
    },
    word_count: {
        type: Number
    },
    // Archetype used in this response
    archetype_used: {
        type: String,
        enum: ['risk_taker', 'analyst', 'builder', 'strategist']
    },
    // Difficulty level at time of response
    difficulty_level: {
        type: Number
    },
    // XP earned from this response
    xp_earned: {
        type: Number,
        default: 0
    },
    // Similarity scores with previous responses (populated on creation)
    similarity_scores: [{
        compared_to_session: String,
        similarity: Number,  // 0-1 scale
        method: String       // 'hash', 'keyword', 'pattern'
    }],
    // Was this flagged as potential exploit?
    exploit_flag: {
        type: Boolean,
        default: false
    },
    exploit_reason: {
        type: String
    },
    created_at: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Static method to create hash from response
responseHistorySchema.statics.createResponseHash = function (response) {
    // Normalize: lowercase, remove extra whitespace, remove punctuation
    const normalized = response
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return crypto.createHash('sha256').update(normalized).digest('hex');
};

// Static method to extract keywords
responseHistorySchema.statics.extractKeywords = function (response) {
    // Simple keyword extraction - remove common words
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
        'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
        'below', 'between', 'under', 'again', 'further', 'then', 'once',
        'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
        'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but',
        'if', 'or', 'because', 'until', 'while', 'although', 'though',
        'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
        'she', 'her', 'it', 'its', 'they', 'them', 'their', 'this', 'that',
        'saya', 'aku', 'kamu', 'dia', 'mereka', 'kita', 'kami', 'ini', 'itu',
        'dan', 'atau', 'yang', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada',
        'akan', 'sudah', 'belum', 'tidak', 'bisa', 'harus', 'mau', 'jika',
        'karena', 'tetapi', 'namun', 'sehingga', 'agar', 'supaya'
    ]);

    const words = response
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));

    // Get unique keywords, limit to 20
    return [...new Set(words)].slice(0, 20);
};

// Static method to calculate similarity between two keyword sets
responseHistorySchema.statics.calculateKeywordSimilarity = function (keywords1, keywords2) {
    if (!keywords1.length || !keywords2.length) return 0;

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);

    const intersection = [...set1].filter(x => set2.has(x)).length;
    const union = new Set([...set1, ...set2]).size;

    return intersection / union; // Jaccard similarity
};

// Method to check similarity with recent responses
responseHistorySchema.statics.checkSimilarity = async function (userId, newResponse, limit = 10) {
    const newHash = this.createResponseHash(newResponse);
    const newKeywords = this.extractKeywords(newResponse);

    // Get recent responses from this user
    const recentResponses = await this.find({ user_id: userId })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();

    const similarities = [];
    let maxSimilarity = 0;
    let exploitDetected = false;
    let exploitReason = null;

    for (const resp of recentResponses) {
        // Check exact hash match
        if (resp.response_hash === newHash) {
            similarities.push({
                compared_to_session: resp.session_id,
                similarity: 1.0,
                method: 'hash'
            });
            maxSimilarity = 1.0;
            exploitDetected = true;
            exploitReason = 'Exact response replay detected';
            continue;
        }

        // Check keyword similarity
        const keywordSim = this.calculateKeywordSimilarity(newKeywords, resp.keywords || []);
        if (keywordSim > 0.7) {
            similarities.push({
                compared_to_session: resp.session_id,
                similarity: keywordSim,
                method: 'keyword'
            });
            if (keywordSim > maxSimilarity) maxSimilarity = keywordSim;
            if (keywordSim > 0.85) {
                exploitDetected = true;
                exploitReason = `High keyword similarity (${Math.round(keywordSim * 100)}%)`;
            }
        }
    }

    return {
        response_hash: newHash,
        keywords: newKeywords,
        similarities,
        max_similarity: maxSimilarity,
        exploit_detected: exploitDetected,
        exploit_reason: exploitReason
    };
};

// Indexes
responseHistorySchema.index({ user_id: 1, created_at: -1 });
responseHistorySchema.index({ response_hash: 1 });

export default mongoose.model('ResponseHistory', responseHistorySchema);
