/**
 * Orchestrator Service - Coordinator for 3-Layer AI Engine
 * 
 * This service coordinates:
 * 1. System Layer (free) - timing, tracking
 * 2. AI Simple (low-cost) - warnings, hints
 * 3. AI Agent (high-cost) - problem generation, evaluation
 * 
 * It initializes sessions, processes user activity, and determines next actions.
 */

import ArenaSessionMetrics from '../models/ArenaSessionMetrics.js';
import SessionMemory from '../models/SessionMemory.js';
import Problem from '../models/Problem.js';
import UserProfile from '../models/UserProfile.js';

import * as systemLayer from './systemLayerService.js';
import * as aiSimple from './aiSimpleService.js';
import { generatePersonalizedProblem, generateXPFromCharacteristics, evaluateSolution } from './aiService.js';

// ==========================================
// SESSION INITIALIZATION
// ==========================================

/**
 * Initialize session context for orchestrated AI interactions
 */
export const initializeSession = async (sessionId, problemId, userId) => {
    try {
        // Get problem and profile
        const problem = await Problem.findOne({ problem_id: problemId });
        const profile = await UserProfile.findOne({ user_id: userId });

        if (!problem || !profile) {
            throw new Error('Problem or profile not found');
        }

        // Calculate adaptive timeouts based on profile
        const timeouts = systemLayer.getAdaptiveTimeouts(profile, problem.difficulty);

        // Create session metrics
        const metrics = await ArenaSessionMetrics.create({
            session_id: sessionId,
            is_active: true
        });

        // Create session memory
        const memory = await SessionMemory.create({
            session_id: sessionId,
            problem_snapshot: {
                problem_id: problem.problem_id,
                title: problem.title,
                context: problem.context,
                objective: problem.objective,
                constraints: problem.constraints || [],
                difficulty: problem.difficulty,
                role_label: problem.role_label,
                level_up_criteria: problem.level_up_criteria || []
            },
            user_profile_snapshot: {
                user_id: profile.user_id,
                primary_archetype: profile.primary_archetype,
                risk_appetite: profile.risk_appetite,
                decision_speed: profile.decision_speed,
                ambiguity_tolerance: profile.ambiguity_tolerance,
                experience_depth: profile.experience_depth,
                current_difficulty: profile.current_difficulty,
                xp_proportions: {
                    risk_taker: profile.xp_risk_taker,
                    analyst: profile.xp_analyst,
                    builder: profile.xp_builder,
                    strategist: profile.xp_strategist
                },
                levels: {
                    risk_taker: profile.level_risk_taker || 1,
                    analyst: profile.level_analyst || 1,
                    builder: profile.level_builder || 1,
                    strategist: profile.level_strategist || 1
                }
            },
            adaptive_state: {
                current_time_limits: {
                    response_warning: timeouts.warning,
                    comprehension_check: timeouts.check,
                    force_change: timeouts.force
                },
                current_pressure_level: 1,
                current_question_index: 0,
                questions_asked: [],
                user_state: 'active',
                last_keystroke_at: new Date()
            },
            is_active: true
        });

        // Log initialization decision
        memory.logDecision(
            'system',
            'set_timeout',
            `Initialized timeouts based on ${profile.primary_archetype} archetype and difficulty ${problem.difficulty}`,
            { archetype: profile.primary_archetype, difficulty: problem.difficulty },
            { timeouts }
        );
        await memory.save();

        return {
            metrics,
            memory,
            timeouts,
            initialized: true
        };
    } catch (error) {
        console.error('Session initialization error:', error);
        throw error;
    }
};

// ==========================================
// KEYSTROKE PROCESSING
// ==========================================

/**
 * Process incoming keystroke data from frontend
 */
export const processUserKeystrokes = async (sessionId, keystrokeData) => {
    try {
        // Track in system layer (free)
        await systemLayer.trackKeystroke(sessionId, keystrokeData);

        return { processed: true };
    } catch (error) {
        console.error('Keystroke processing error:', error);
        return { processed: false, error: error.message };
    }
};

// ==========================================
// NEXT ACTION DETERMINATION
// ==========================================

/**
 * Determine and return next action for frontend (polling endpoint)
 */
export const requestNextAction = async (sessionId) => {
    try {
        const memory = await SessionMemory.findOne({ session_id: sessionId });
        if (!memory || !memory.is_active) {
            return { action: 'none', reason: 'session_inactive' };
        }

        // Check if intervention is needed (System Layer)
        const interventionCheck = await systemLayer.checkInterventionNeeded(sessionId);

        if (!interventionCheck.needed) {
            return { action: 'none', reason: interventionCheck.reason };
        }

        // Intervention is needed - handle based on type
        const profile = memory.user_profile_snapshot;
        const problem = memory.problem_snapshot;

        let action;

        switch (interventionCheck.type) {
            case 'warning':
                // Use AI Simple for warning message
                const warning = await aiSimple.generateWarningMessage(
                    profile,
                    { type: 'pause', seconds: interventionCheck.seconds_idle, problem_title: problem.title }
                );

                await systemLayer.recordIntervention(sessionId, {
                    type: 'warning',
                    reason: `User idle for ${interventionCheck.seconds_idle}s`,
                    user_state: memory.adaptive_state.user_state
                });

                action = {
                    action: 'show_warning',
                    message: warning,
                    seconds_idle: interventionCheck.seconds_idle
                };
                break;

            case 'comprehension_check':
                // Ask if user understands the question
                const currentQuestion = memory.adaptive_state.questions_asked.length > 0
                    ? memory.adaptive_state.questions_asked[memory.adaptive_state.questions_asked.length - 1]
                    : problem.objective;

                await systemLayer.recordIntervention(sessionId, {
                    type: 'comprehension_check',
                    reason: `User still idle after warning`,
                    user_state: memory.adaptive_state.user_state
                });

                action = {
                    action: 'comprehension_check',
                    message: `Kamu belum mulai menulis. Apakah pertanyaan ini terlalu kabur? "${currentQuestion}"`,
                    options: ['understood', 'not_understood']
                };
                break;

            case 'force_change':
                // Force question evolution
                const newQuestion = await aiSimple.generateComprehensionCheck(problem,
                    memory.adaptive_state.questions_asked[memory.adaptive_state.questions_asked.length - 1] || problem.objective
                );

                // Update memory with new question
                memory.adaptive_state.questions_asked.push(newQuestion);
                memory.adaptive_state.current_question_index += 1;
                memory.adaptive_state.intervention_in_progress = false;
                await memory.save();

                await systemLayer.recordIntervention(sessionId, {
                    type: 'question_change',
                    reason: `User did not respond after comprehension check`,
                    user_state: memory.adaptive_state.user_state
                });

                action = {
                    action: 'change_question',
                    new_question: newQuestion,
                    reason: 'timeout'
                };
                break;

            default:
                action = { action: 'none' };
        }

        return action;
    } catch (error) {
        console.error('Next action determination error:', error);
        return { action: 'error', error: error.message };
    }
};

// ==========================================
// INTERVENTION RESPONSE HANDLING
// ==========================================

/**
 * Handle user response to AI intervention
 */
export const handleInterventionResponse = async (sessionId, responseType) => {
    try {
        const memory = await SessionMemory.findOne({ session_id: sessionId });
        if (!memory) {
            return { error: 'Session not found' };
        }

        const problem = memory.problem_snapshot;
        let result;

        switch (responseType) {
            case 'understood':
                // User claims to understand - start countdown
                memory.adaptive_state.intervention_in_progress = true;
                await memory.save();

                result = {
                    action: 'start_countdown',
                    seconds: 30,
                    message: "Oke. Kamu punya 30 detik untuk mulai menulis atau pertanyaan akan diganti agar lebih spesifik."
                };
                break;

            case 'not_understood':
                // User doesn't understand - evolve question immediately
                const newQuestion = await aiSimple.generateComprehensionCheck(
                    problem,
                    memory.adaptive_state.questions_asked[memory.adaptive_state.questions_asked.length - 1] || problem.objective
                );

                memory.adaptive_state.questions_asked.push(newQuestion);
                memory.adaptive_state.current_question_index += 1;
                memory.adaptive_state.intervention_in_progress = false;
                await memory.save();

                result = {
                    action: 'change_question',
                    new_question: newQuestion,
                    reason: 'user_requested'
                };
                break;

            case 'started_typing':
                // User started typing - clear intervention
                memory.adaptive_state.intervention_in_progress = false;
                memory.adaptive_state.last_keystroke_at = new Date();
                memory.adaptive_state.user_state = 'active';
                await memory.save();

                result = {
                    action: 'clear_intervention',
                    message: 'Good, keep going!'
                };
                break;

            default:
                result = { action: 'none' };
        }

        // Log the decision
        memory.logDecision(
            'system',
            'evaluate_response',
            `User responded with "${responseType}" to intervention`,
            { response_type: responseType },
            result
        );
        await memory.save();

        return result;
    } catch (error) {
        console.error('Intervention response handling error:', error);
        return { error: error.message };
    }
};

// ==========================================
// RESPONSE SUBMISSION PROCESSING
// ==========================================

/**
 * Process user's final response submission
 */
export const processUserResponse = async (sessionId, response, timeElapsed) => {
    try {
        const memory = await SessionMemory.findOne({ session_id: sessionId });
        const metrics = await ArenaSessionMetrics.findOne({ session_id: sessionId });

        if (!memory || !metrics) {
            throw new Error('Session data not found');
        }

        // Add response to conversation
        memory.addConversation('user', response, 'answer');

        // Record response timing in metrics
        const lastQuestion = memory.adaptive_state.questions_asked.length > 0
            ? memory.adaptive_state.questions_asked[memory.adaptive_state.questions_asked.length - 1]
            : memory.problem_snapshot.objective;

        await systemLayer.recordResponseTiming(sessionId, {
            question_id: `q_${memory.adaptive_state.current_question_index}`,
            question_text: lastQuestion,
            time_to_submit_ms: timeElapsed * 1000,
            response_length: response.length,
            revision_count: 0 // Would need frontend tracking
        });

        // Check if we need follow-up questions or can proceed to final evaluation
        const shouldDelegate = await aiSimple.shouldDelegateToAgent({
            task_type: 'full_evaluation',
            conversation_length: memory.conversation.length,
            intervention_count: metrics.interventions.length
        });

        if (shouldDelegate.delegate) {
            // Log delegation to AI Agent
            memory.logDecision(
                'ai_simple',
                'delegate_to_agent',
                shouldDelegate.reason,
                { response_length: response.length, time_elapsed: timeElapsed },
                { delegate_to: 'ai_agent', task: 'full_evaluation' }
            );
            await memory.save();
        }

        return {
            processed: true,
            delegate_to_agent: shouldDelegate.delegate,
            reason: shouldDelegate.reason
        };
    } catch (error) {
        console.error('Response processing error:', error);
        throw error;
    }
};

// ==========================================
// SESSION FINALIZATION
// ==========================================

/**
 * Finalize session and prepare for XP calculation
 */
export const finalizeSession = async (sessionId) => {
    try {
        const memory = await SessionMemory.findOne({ session_id: sessionId });
        const metrics = await ArenaSessionMetrics.findOne({ session_id: sessionId });

        if (!memory || !metrics) {
            throw new Error('Session data not found');
        }

        // Mark session as inactive
        memory.is_active = false;
        metrics.is_active = false;

        // Recalculate aggregate metrics
        metrics.recalculateAggregates();

        await memory.save();
        await metrics.save();

        // Return data needed for XP calculation
        return {
            session_id: sessionId,
            metrics: metrics.aggregate_metrics,
            interventions: metrics.interventions,
            conversation: memory.conversation,
            problem_snapshot: memory.problem_snapshot,
            user_profile_snapshot: memory.user_profile_snapshot,
            ai_decisions: memory.ai_decisions
        };
    } catch (error) {
        console.error('Session finalization error:', error);
        throw error;
    }
};

// ==========================================
// CLEANUP
// ==========================================

/**
 * Clean up abandoned session
 */
export const abandonSession = async (sessionId) => {
    try {
        await SessionMemory.findOneAndUpdate(
            { session_id: sessionId },
            { is_active: false }
        );

        await ArenaSessionMetrics.findOneAndUpdate(
            { session_id: sessionId },
            { is_active: false }
        );

        return { abandoned: true };
    } catch (error) {
        console.error('Session abandonment error:', error);
        return { abandoned: false, error: error.message };
    }
};

export default {
    initializeSession,
    processUserKeystrokes,
    requestNextAction,
    handleInterventionResponse,
    processUserResponse,
    finalizeSession,
    abandonSession
};
